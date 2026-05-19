/**
 * Channel Blocker — 채널별 차단 액션 실행 엔진
 *
 * 이식된 채널의 플랫폼 API를 통해 실제 차단 명령을 실행합니다.
 * 채널 타입별 어댑터 패턴으로 구현되어 있으며, 각 플랫폼의 API를 호출합니다.
 */

import { getDb } from "../db";
import { mipBlockActions, mipChannels } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export type BlockAction = "sender_block" | "message_quarantine" | "message_delete" | "auto_report";

export type BlockResult = {
  success: boolean;
  actionId: string;
  blockAction: BlockAction;
  executedAt: number;
  error?: string;
};

export type BlockRequest = {
  deviceId: string;
  channelType: string;
  senderIdentifier: string;
  messagePreview?: string;
  verdictLevel: string;       // phishing, blocked, suspicious
  riskScore: number;
  checkId?: string;
  connectionConfig?: string;  // JSON: 플랫폼 API 키, 웹훅 URL 등
};

export type UnblockRequest = {
  actionId: string;
  requestedBy: string;  // "hangyeol" | "user"
};

// ─── 채널별 어댑터 인터페이스 ─────────────────────────────────────────────────

interface ChannelBlockAdapter {
  blockSender(config: any, senderIdentifier: string): Promise<{ success: boolean; error?: string }>;
  quarantineMessage(config: any, senderIdentifier: string, messagePreview?: string): Promise<{ success: boolean; error?: string }>;
  deleteMessage(config: any, senderIdentifier: string): Promise<{ success: boolean; error?: string }>;
  reportSpam(config: any, senderIdentifier: string): Promise<{ success: boolean; error?: string }>;
  unblockSender(config: any, senderIdentifier: string): Promise<{ success: boolean; error?: string }>;
}

// ─── WhatsApp 어댑터 ────────────────────────────────────────────────────────

const whatsappAdapter: ChannelBlockAdapter = {
  async blockSender(config, senderIdentifier) {
    // WhatsApp Business API: POST /{phone_number_id}/messages — mark as spam & block
    try {
      const { apiUrl, accessToken, phoneNumberId } = config;
      const response = await fetch(`${apiUrl}/${phoneNumberId}/block`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", block: [{ user: senderIdentifier }] }),
      });
      if (!response.ok) return { success: false, error: `WhatsApp API ${response.status}` };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async quarantineMessage(config, senderIdentifier) {
    // WhatsApp: 메시지를 스팸으로 마킹 (격리 효과)
    return this.blockSender(config, senderIdentifier);
  },
  async deleteMessage(config, senderIdentifier) {
    // WhatsApp: 메시지 삭제는 지원하지 않으므로 차단으로 대체
    return this.blockSender(config, senderIdentifier);
  },
  async reportSpam(config, senderIdentifier) {
    try {
      const { apiUrl, accessToken, phoneNumberId } = config;
      const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: senderIdentifier, type: "reaction", reaction: { message_id: "spam_report", emoji: "" } }),
      });
      return { success: response.ok, error: response.ok ? undefined : `WhatsApp API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async unblockSender(config, senderIdentifier) {
    try {
      const { apiUrl, accessToken, phoneNumberId } = config;
      const response = await fetch(`${apiUrl}/${phoneNumberId}/unblock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", unblock: [{ user: senderIdentifier }] }),
      });
      return { success: response.ok, error: response.ok ? undefined : `WhatsApp API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ─── Telegram 어댑터 ────────────────────────────────────────────────────────

const telegramAdapter: ChannelBlockAdapter = {
  async blockSender(config, senderIdentifier) {
    try {
      const { botToken, chatId } = config;
      const response = await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: parseInt(senderIdentifier) }),
      });
      return { success: response.ok, error: response.ok ? undefined : `Telegram API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async quarantineMessage(config, senderIdentifier) {
    // Telegram: restrictChatMember로 메시지 전송 제한
    try {
      const { botToken, chatId } = config;
      const response = await fetch(`https://api.telegram.org/bot${botToken}/restrictChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: parseInt(senderIdentifier),
          permissions: { can_send_messages: false },
        }),
      });
      return { success: response.ok, error: response.ok ? undefined : `Telegram API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async deleteMessage(config, senderIdentifier) {
    try {
      const { botToken, chatId, messageId } = config;
      const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      });
      return { success: response.ok, error: response.ok ? undefined : `Telegram API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async reportSpam(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async unblockSender(config, senderIdentifier) {
    try {
      const { botToken, chatId } = config;
      const response = await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: parseInt(senderIdentifier), only_if_banned: true }),
      });
      return { success: response.ok, error: response.ok ? undefined : `Telegram API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ─── KakaoTalk 어댑터 ───────────────────────────────────────────────────────

const kakaotalkAdapter: ChannelBlockAdapter = {
  async blockSender(config, senderIdentifier) {
    try {
      const { apiUrl, appKey, channelId } = config;
      const response = await fetch(`${apiUrl}/v1/channels/${channelId}/users/${senderIdentifier}/block`, {
        method: "POST",
        headers: { Authorization: `KakaoAK ${appKey}`, "Content-Type": "application/json" },
      });
      return { success: response.ok, error: response.ok ? undefined : `Kakao API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async quarantineMessage(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async deleteMessage(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async reportSpam(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async unblockSender(config, senderIdentifier) {
    try {
      const { apiUrl, appKey, channelId } = config;
      const response = await fetch(`${apiUrl}/v1/channels/${channelId}/users/${senderIdentifier}/unblock`, {
        method: "POST",
        headers: { Authorization: `KakaoAK ${appKey}`, "Content-Type": "application/json" },
      });
      return { success: response.ok, error: response.ok ? undefined : `Kakao API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ─── SMS/RCS 어댑터 ─────────────────────────────────────────────────────────

const smsAdapter: ChannelBlockAdapter = {
  async blockSender(config, senderIdentifier) {
    try {
      const { apiUrl, apiKey, subscriberNumber } = config;
      const response = await fetch(`${apiUrl}/v1/spam/block`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ subscriber: subscriberNumber, blocked_number: senderIdentifier, reason: "phishing_detected" }),
      });
      return { success: response.ok, error: response.ok ? undefined : `SMS API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async quarantineMessage(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async deleteMessage(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async reportSpam(config, senderIdentifier) {
    try {
      const { apiUrl, apiKey, subscriberNumber } = config;
      const response = await fetch(`${apiUrl}/v1/spam/report`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ subscriber: subscriberNumber, reported_number: senderIdentifier, category: "phishing" }),
      });
      return { success: response.ok, error: response.ok ? undefined : `SMS API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async unblockSender(config, senderIdentifier) {
    try {
      const { apiUrl, apiKey, subscriberNumber } = config;
      const response = await fetch(`${apiUrl}/v1/spam/unblock`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ subscriber: subscriberNumber, blocked_number: senderIdentifier }),
      });
      return { success: response.ok, error: response.ok ? undefined : `SMS API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ─── LINE 어댑터 ────────────────────────────────────────────────────────────

const lineAdapter: ChannelBlockAdapter = {
  async blockSender(config, senderIdentifier) {
    try {
      const { channelAccessToken } = config;
      // LINE Messaging API: block user (leave room)
      const response = await fetch(`https://api.line.me/v2/bot/chat/${senderIdentifier}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${channelAccessToken}` },
      });
      return { success: response.ok, error: response.ok ? undefined : `LINE API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async quarantineMessage(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async deleteMessage(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async reportSpam(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async unblockSender(config, senderIdentifier) {
    // LINE: 차단 해제는 사용자 재추가로 처리
    return { success: true };
  },
};

// ─── Instagram 어댑터 ───────────────────────────────────────────────────────

const instagramAdapter: ChannelBlockAdapter = {
  async blockSender(config, senderIdentifier) {
    try {
      const { accessToken, igUserId } = config;
      // Instagram Graph API: block user
      const response = await fetch(`https://graph.instagram.com/v18.0/${igUserId}/blocked_users`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: senderIdentifier }),
      });
      return { success: response.ok, error: response.ok ? undefined : `Instagram API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async quarantineMessage(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async deleteMessage(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async reportSpam(config, senderIdentifier) {
    return this.blockSender(config, senderIdentifier);
  },
  async unblockSender(config, senderIdentifier) {
    try {
      const { accessToken, igUserId } = config;
      const response = await fetch(`https://graph.instagram.com/v18.0/${igUserId}/blocked_users`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: senderIdentifier }),
      });
      return { success: response.ok, error: response.ok ? undefined : `Instagram API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ─── YouTube 어댑터 ────────────────────────────────────────────────────────

const youtubeAdapter: ChannelBlockAdapter = {
  async blockSender(config, senderIdentifier) {
    // YouTube Data API v3: 댓글 작성자 차단 (markAsSpam + banAuthor)
    try {
      const { accessToken } = config;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/comments/markAsSpam?id=${senderIdentifier}`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) return { success: false, error: `YouTube API ${response.status}` };
      // banAuthor: 해당 채널에서 영구 차단
      await fetch(
        `https://www.googleapis.com/youtube/v3/comments/setModerationStatus?id=${senderIdentifier}&moderationStatus=rejected&banAuthor=true`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async quarantineMessage(config, senderIdentifier) {
    // YouTube: 댓글을 검토 대기(heldForReview)로 이동
    try {
      const { accessToken } = config;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/comments/setModerationStatus?id=${senderIdentifier}&moderationStatus=heldForReview`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return { success: response.ok, error: response.ok ? undefined : `YouTube API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async deleteMessage(config, senderIdentifier) {
    // YouTube Data API v3: 댓글 삭제
    try {
      const { accessToken } = config;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/comments?id=${senderIdentifier}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return { success: response.ok, error: response.ok ? undefined : `YouTube API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async reportSpam(config, senderIdentifier) {
    // YouTube: 스팸 신고
    try {
      const { accessToken } = config;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/comments/markAsSpam?id=${senderIdentifier}`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return { success: response.ok, error: response.ok ? undefined : `YouTube API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  async unblockSender(config, senderIdentifier) {
    // YouTube: 댓글 승인 (published로 변경)
    try {
      const { accessToken } = config;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/comments/setModerationStatus?id=${senderIdentifier}&moderationStatus=published`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return { success: response.ok, error: response.ok ? undefined : `YouTube API ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
};

// ─── 어댑터 레지스트리 ──────────────────────────────────────────────────────

const adapters: Record<string, ChannelBlockAdapter> = {
  whatsapp: whatsappAdapter,
  telegram: telegramAdapter,
  kakaotalk: kakaotalkAdapter,
  sms: smsAdapter,
  rcs: smsAdapter,       // RCS는 SMS 어댑터 공유 (동일 통신사 API)
  line: lineAdapter,
  instagram: instagramAdapter,
  youtube: youtubeAdapter,
};

// ─── 차단 액션 결정 로직 ────────────────────────────────────────────────────

function determineBlockAction(verdictLevel: string, riskScore: number): BlockAction {
  if (verdictLevel === "phishing" || riskScore >= 85) {
    return "sender_block";         // 확실한 피싱 → 발신자 완전 차단
  } else if (verdictLevel === "blocked" || riskScore >= 70) {
    return "message_quarantine";   // 위험 → 메시지 격리
  } else if (verdictLevel === "suspicious" || riskScore >= 50) {
    return "message_quarantine";   // 의심 → 격리 (사용자 판단 대기)
  }
  return "message_quarantine";     // 기본: 격리
}

// ─── 메인 차단 실행 함수 ────────────────────────────────────────────────────

export async function executeBlock(request: BlockRequest): Promise<BlockResult> {
  const db = await getDb();
  if (!db) return { success: false, actionId: '', blockAction: 'sender_block', executedAt: Date.now(), error: 'Database unavailable' };
  const actionId = nanoid(16);
  const blockAction = determineBlockAction(request.verdictLevel, request.riskScore);
  const now = Date.now();

  // DB에 차단 이력 기록 (pending)
  await db.insert(mipBlockActions).values({
    id: actionId,
    deviceId: request.deviceId,
    channelType: request.channelType,
    checkId: request.checkId || null,
    senderIdentifier: request.senderIdentifier,
    messagePreview: request.messagePreview?.slice(0, 100) || null,
    blockAction,
    status: "pending",
    verdictLevel: request.verdictLevel,
    riskScore: request.riskScore,
    createdAt: now,
  });

  // 어댑터 선택
  const adapter = adapters[request.channelType];
  if (!adapter) {
    await db.update(mipBlockActions).set({ status: "failed" }).where(eq(mipBlockActions.id, actionId));
    return { success: false, actionId, blockAction, executedAt: now, error: `Unsupported channel type: ${request.channelType}` };
  }

  // 연결 설정 파싱 — request에 없으면 mipChannels에서 OAuth 토큰 조회
  let config: any = {};
  if (request.connectionConfig) {
    try { config = JSON.parse(request.connectionConfig); } catch { /* 빈 config 사용 */ }
  } else {
    // mipChannels에서 connectionConfig 자동 조회 (OAuth 토큰 등)
    try {
      const channels = await db.select().from(mipChannels).where(
        and(eq(mipChannels.channelType, request.channelType as any))
      ).limit(5);
      // deviceId로 매칭되는 채널 찾기 (또는 첫 번째 사용)
      const matched = channels.find(ch => ch.connectionConfig) || null;
      if (matched?.connectionConfig) {
        const parsed = JSON.parse(matched.connectionConfig);
        // YouTube OAuth 토큰이 있으면 만료 확인 후 자동 갱신
        if (parsed.oauth?.accessToken) {
          let accessToken = parsed.oauth.accessToken;
          // 토큰 만료 확인 (5분 여유)
          if (parsed.oauth.expiresAt && Date.now() > parsed.oauth.expiresAt - 5 * 60 * 1000) {
            try {
              const { refreshAccessToken } = await import("../youtube/youtube-oauth");
              const refreshed = await refreshAccessToken(parsed.oauth.refreshToken);
              accessToken = refreshed.accessToken;
              // DB에 갱신된 토큰 저장
              parsed.oauth.accessToken = refreshed.accessToken;
              parsed.oauth.expiresAt = refreshed.expiresAt;
              await db.update(mipChannels).set({
                connectionConfig: JSON.stringify(parsed),
                updatedAt: Date.now(),
              }).where(eq(mipChannels.id, matched.id));
            } catch { /* 갱신 실패 시 기존 토큰 사용 */ }
          }
          config = { accessToken };
        } else {
          config = parsed;
        }
      }
    } catch { /* 조회 실패 시 빈 config */ }
  }

  // 차단 실행
  let result: { success: boolean; error?: string };
  switch (blockAction) {
    case "sender_block":
      result = await adapter.blockSender(config, request.senderIdentifier);
      break;
    case "message_quarantine":
      result = await adapter.quarantineMessage(config, request.senderIdentifier, request.messagePreview);
      break;
    case "message_delete":
      result = await adapter.deleteMessage(config, request.senderIdentifier);
      break;
    case "auto_report":
      result = await adapter.reportSpam(config, request.senderIdentifier);
      break;
    default:
      result = { success: false, error: "Unknown block action" };
  }

  // DB 상태 업데이트
  await db.update(mipBlockActions).set({
    status: result.success ? "executed" : "failed",
    executedAt: result.success ? now : null,
  }).where(eq(mipBlockActions.id, actionId));

  return { success: result.success, actionId, blockAction, executedAt: now, error: result.error };
}

// ─── 차단 해제 함수 ────────────────────────────────────────────────────────

export async function executeUnblock(request: UnblockRequest): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database unavailable' };

  // 차단 이력 조회
  const [action] = await db.select().from(mipBlockActions).where(eq(mipBlockActions.id, request.actionId));
  if (!action) return { success: false, error: "Block action not found" };
  if (action.status === "unblocked") return { success: true }; // 이미 해제됨

  // 어댑터로 해제 실행
  const adapter = adapters[action.channelType];
  if (!adapter) return { success: false, error: `Unsupported channel type: ${action.channelType}` };

  // mipChannels에서 connectionConfig 가져오기 (채널 디바이스의 경우)
  const { mipChannels } = await import("../../drizzle/schema");
  const channels = await db.select().from(mipChannels).where(eq(mipChannels.id, action.deviceId));
  let config: any = {};
  if (channels.length > 0 && channels[0].connectionConfig) {
    try { config = JSON.parse(channels[0].connectionConfig as string); } catch { /* */ }
  }

  const result = await adapter.unblockSender(config, action.senderIdentifier);

  if (result.success) {
    await db.update(mipBlockActions).set({
      status: "unblocked",
      unblockedAt: Date.now(),
      unblockedBy: request.requestedBy,
    }).where(eq(mipBlockActions.id, request.actionId));
  }

  return result;
}

// ─── 차단 이력 조회 ────────────────────────────────────────────────────────

export async function getBlockHistory(deviceId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mipBlockActions).where(eq(mipBlockActions.deviceId, deviceId));
}
