/**
 * MIP Channel Manager
 *
 * SNS/메신저 채널을 디바이스와 분리하여 별도 관리합니다.
 * - 채널 등록 (SMS, 카카오톡, WhatsApp, LINE, Telegram, Instagram, RCS)
 * - 채널 해제
 * - 채널 목록 조회
 * - 보호 수준 변경
 * - 메시지 검사 시 채널 상태 확인
 */
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { mipChannels, type MipChannel, type InsertMipChannel } from "../../drizzle/schema";
import { nanoid } from "nanoid";

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export type ChannelType = "sms" | "kakaotalk" | "whatsapp" | "line" | "telegram" | "instagram" | "rcs";
export type ProtectionLevel = "full" | "monitor_only" | "disabled";
export type ChannelStatus = "active" | "disconnected" | "suspended" | "pending_verification";
export type ChannelProtocol = "websocket" | "webhook" | "polling";

export interface RegisterChannelInput {
  channelType: ChannelType;
  protocol?: ChannelProtocol;
  accountId: string;           // 전화번호 또는 계정 ID
  displayName?: string;
  accountMetadata?: Record<string, unknown>;
  protectionLevel?: ProtectionLevel;
  connectionConfig?: Record<string, unknown>;
  ownerId: string;
}

export interface UpdateChannelSettingsInput {
  protectionLevel?: ProtectionLevel;
  displayName?: string;
  connectionConfig?: Record<string, unknown>;
}

export interface ChannelListFilter {
  ownerId: string;
  channelType?: ChannelType;
  status?: ChannelStatus;
}

export interface ChannelSummary {
  id: string;
  channelType: ChannelType;
  accountId: string;
  displayName: string | null;
  protectionLevel: ProtectionLevel;
  status: ChannelStatus;
  totalChecked: number;
  totalBlocked: number;
  lastMessageAt: number | null;
  createdAt: number;
}

// ─── 채널 타입별 기본 프로토콜 매핑 ──────────────────────────────────────────

const DEFAULT_PROTOCOL: Record<ChannelType, ChannelProtocol> = {
  sms: "webhook",
  kakaotalk: "webhook",
  whatsapp: "webhook",
  line: "webhook",
  telegram: "webhook",
  instagram: "webhook",
  rcs: "webhook",
};

// ─── 채널 타입별 연결 방식 설명 ──────────────────────────────────────────────

export const CHANNEL_INFO: Record<ChannelType, { name: string; description: string; authMethod: string }> = {
  sms: {
    name: "SMS/MMS",
    description: "통신사 문자 메시지 (SKT, KT, LGU+)",
    authMethod: "전화번호 인증 (통신사 API 연동)",
  },
  kakaotalk: {
    name: "카카오톡",
    description: "카카오톡 메시지 (알림톡/친구톡 포함)",
    authMethod: "알림 접근 권한 허용 (Android Notification Listener)",
  },
  whatsapp: {
    name: "WhatsApp",
    description: "WhatsApp 메시지 (개인/비즈니스)",
    authMethod: "WhatsApp Business API QR 코드 스캔",
  },
  line: {
    name: "LINE",
    description: "LINE 메시지",
    authMethod: "LINE Login OAuth 2.0",
  },
  telegram: {
    name: "Telegram",
    description: "텔레그램 메시지",
    authMethod: "Telegram Bot API 토큰",
  },
  instagram: {
    name: "Instagram DM",
    description: "인스타그램 다이렉트 메시지",
    authMethod: "Instagram Messaging API (비즈니스 계정)",
  },
  rcs: {
    name: "RCS (차세대 문자)",
    description: "Rich Communication Services",
    authMethod: "통신사 RCS API 연동",
  },
};

// ─── 채널 등록 ──────────────────────────────────────────────────────────────

export async function registerChannel(input: RegisterChannelInput): Promise<MipChannel> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = Date.now();
  const id = nanoid();

  const protocol = input.protocol ?? DEFAULT_PROTOCOL[input.channelType];

  const channelData: InsertMipChannel = {
    id,
    channelType: input.channelType,
    protocol,
    accountId: input.accountId,
    displayName: input.displayName ?? null,
    accountMetadata: input.accountMetadata ? JSON.stringify(input.accountMetadata) : null,
    protectionLevel: input.protectionLevel ?? "full",
    status: "pending_verification",
    connectionConfig: input.connectionConfig ? JSON.stringify(input.connectionConfig) : null,
    lastMessageAt: null,
    totalChecked: 0,
    totalBlocked: 0,
    ownerId: input.ownerId,
    createdAt: now,
    updatedAt: now,
    disconnectedAt: null,
  };

  await db.insert(mipChannels).values(channelData);

  // 등록 후 바로 active로 전환 (실제로는 인증 절차 후 전환)
  await db
    .update(mipChannels)
    .set({ status: "active", updatedAt: Date.now() })
    .where(eq(mipChannels.id, id));

  const [channel] = await db.select().from(mipChannels).where(eq(mipChannels.id, id));
  return channel;
}

// ─── 채널 해제 ──────────────────────────────────────────────────────────────

export async function disconnectChannel(channelId: string, ownerId: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [channel] = await db
    .select()
    .from(mipChannels)
    .where(and(eq(mipChannels.id, channelId), eq(mipChannels.ownerId, ownerId)));

  if (!channel) {
    return { success: false, error: "채널을 찾을 수 없습니다." };
  }

  if (channel.status === "disconnected") {
    return { success: false, error: "이미 해제된 채널입니다." };
  }

  await db
    .update(mipChannels)
    .set({
      status: "disconnected",
      disconnectedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(mipChannels.id, channelId));

  return { success: true };
}

// ─── 채널 목록 조회 ─────────────────────────────────────────────────────────

export async function listChannels(filter: ChannelListFilter): Promise<ChannelSummary[]> {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: mipChannels.id,
      channelType: mipChannels.channelType,
      accountId: mipChannels.accountId,
      displayName: mipChannels.displayName,
      protectionLevel: mipChannels.protectionLevel,
      status: mipChannels.status,
      totalChecked: mipChannels.totalChecked,
      totalBlocked: mipChannels.totalBlocked,
      lastMessageAt: mipChannels.lastMessageAt,
      createdAt: mipChannels.createdAt,
    })
    .from(mipChannels)
    .where(eq(mipChannels.ownerId, filter.ownerId))
    .orderBy(desc(mipChannels.createdAt));

  // 필터 적용 (channelType, status)
  let filtered = results as ChannelSummary[];
  if (filter.channelType) {
    filtered = filtered.filter((c) => c.channelType === filter.channelType);
  }
  if (filter.status) {
    filtered = filtered.filter((c) => c.status === filter.status);
  }

  return filtered;
}

// ─── 채널 설정 변경 ─────────────────────────────────────────────────────────

export async function updateChannelSettings(
  channelId: string,
  ownerId: string,
  settings: UpdateChannelSettingsInput
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [channel] = await db
    .select()
    .from(mipChannels)
    .where(and(eq(mipChannels.id, channelId), eq(mipChannels.ownerId, ownerId)));

  if (!channel) {
    return { success: false, error: "채널을 찾을 수 없습니다." };
  }

  const updateData: Partial<InsertMipChannel> = { updatedAt: Date.now() };

  if (settings.protectionLevel !== undefined) {
    updateData.protectionLevel = settings.protectionLevel;
  }
  if (settings.displayName !== undefined) {
    updateData.displayName = settings.displayName;
  }
  if (settings.connectionConfig !== undefined) {
    updateData.connectionConfig = JSON.stringify(settings.connectionConfig);
  }

  await db.update(mipChannels).set(updateData).where(eq(mipChannels.id, channelId));

  return { success: true };
}

// ─── 채널 상태 조회 (단일) ──────────────────────────────────────────────────

export async function getChannel(channelId: string): Promise<MipChannel | null> {
  const db = await getDb();
  if (!db) return null;

  const [channel] = await db.select().from(mipChannels).where(eq(mipChannels.id, channelId));
  return channel ?? null;
}

// ─── 채널 검사 카운터 증가 ──────────────────────────────────────────────────

export async function incrementCheckCount(channelId: string, blocked: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(mipChannels)
    .set({
      totalChecked: sql`${mipChannels.totalChecked} + 1`,
      ...(blocked ? { totalBlocked: sql`${mipChannels.totalBlocked} + 1` } : {}),
      lastMessageAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(mipChannels.id, channelId));
}

// ─── 채널 ID로 보호 수준 확인 (메시지 검사 전 호출) ─────────────────────────

export async function getChannelProtectionLevel(channelId: string): Promise<{
  allowed: boolean;
  protectionLevel: ProtectionLevel | null;
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { allowed: true, protectionLevel: null };

  const [channel] = await db
    .select({ protectionLevel: mipChannels.protectionLevel, status: mipChannels.status })
    .from(mipChannels)
    .where(eq(mipChannels.id, channelId));

  if (!channel) {
    // channelId가 제공됐지만 등록되지 않은 채널 → 거부
    return { allowed: false, protectionLevel: null, error: "등록되지 않은 채널입니다." };
  }

  if (channel.status !== "active") {
    return { allowed: false, protectionLevel: channel.protectionLevel, error: "비활성 채널입니다." };
  }

  if (channel.protectionLevel === "disabled") {
    return { allowed: false, protectionLevel: "disabled", error: "보호가 비활성화된 채널입니다." };
  }

  return { allowed: true, protectionLevel: channel.protectionLevel };
}

// ─── 채널 통계 요약 ─────────────────────────────────────────────────────────

export async function getChannelStats(ownerId: string): Promise<{
  totalChannels: number;
  activeChannels: number;
  totalChecked: number;
  totalBlocked: number;
}> {
  const db = await getDb();
  if (!db) return { totalChannels: 0, activeChannels: 0, totalChecked: 0, totalBlocked: 0 };

  const channels = await db
    .select({
      status: mipChannels.status,
      totalChecked: mipChannels.totalChecked,
      totalBlocked: mipChannels.totalBlocked,
    })
    .from(mipChannels)
    .where(eq(mipChannels.ownerId, ownerId));

  return {
    totalChannels: channels.length,
    activeChannels: channels.filter((c) => c.status === "active").length,
    totalChecked: channels.reduce((sum, c) => sum + c.totalChecked, 0),
    totalBlocked: channels.reduce((sum, c) => sum + c.totalBlocked, 0),
  };
}
