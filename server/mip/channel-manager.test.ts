/**
 * 채널(Channel) 관리 시스템 테스트
 *
 * MIP 서버에 실제 HTTP 요청을 보내서 채널 등록/해제/목록/설정 변경을 검증합니다.
 * 전제: 서버가 localhost:3000에서 실행 중이어야 합니다.
 */
import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";

const BASE_URL = "http://localhost:3000/api/hangyeol";
const SHARED_SECRET = process.env.HANGYEOL_MIP_SHARED_SECRET || "5a22f1175f1e9c2b8a3d4e6f7890abcd1234567890abcdef1234567890abcdef";

function makeHmacHeaders(body: Record<string, unknown> | string = {}): Record<string, string> {
  const timestamp = Date.now().toString();
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");
  const message = `hangyeol:${timestamp}:${bodyHash}`;
  const signature = crypto
    .createHmac("sha256", SHARED_SECRET)
    .update(message)
    .digest("hex");

  return {
    "Content-Type": "application/json",
    "X-Service-ID": "hangyeol",
    "X-Timestamp": timestamp,
    "X-Signature": signature,
  };
}

function makeGetHeaders(): Record<string, string> {
  const timestamp = Date.now().toString();
  const bodyStr = JSON.stringify({});
  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");
  const message = `hangyeol:${timestamp}:${bodyHash}`;
  const signature = crypto
    .createHmac("sha256", SHARED_SECRET)
    .update(message)
    .digest("hex");

  return {
    "X-Service-ID": "hangyeol",
    "X-Timestamp": timestamp,
    "X-Signature": signature,
  };
}

async function mipPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: makeHmacHeaders(body),
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function mipGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: makeGetHeaders(),
  });
  return { status: res.status, data: await res.json() };
}

async function mipPut(path: string, body: Record<string, unknown>) {
  const timestamp = Date.now().toString();
  const bodyStr = JSON.stringify(body);
  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");
  const message = `hangyeol:${timestamp}:${bodyHash}`;
  const signature = crypto
    .createHmac("sha256", SHARED_SECRET)
    .update(message)
    .digest("hex");

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Service-ID": "hangyeol",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body: bodyStr,
  });
  return { status: res.status, data: await res.json() };
}

describe("채널 관리 시스템 (Channel Manager)", () => {
  let whatsappChannelId: string;
  let smsChannelId: string;
  let telegramChannelId: string;

  // ─── 채널 등록 ─────────────────────────────────────────────────────────────

  describe("채널 등록", () => {
    it("WhatsApp 채널 등록 성공", async () => {
      const { status, data } = await mipPost("/channels/register", {
        channelType: "whatsapp",
        accountId: "+82-10-1234-5678",
        displayName: "내 WhatsApp",
        protectionLevel: "full",
        accountMetadata: { phoneNumber: "+82-10-1234-5678", businessAccount: false },
      });

      expect(status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.channel.channelType).toBe("whatsapp");
      expect(data.channel.accountId).toBe("+82-10-1234-5678");
      expect(data.channel.displayName).toBe("내 WhatsApp");
      expect(data.channel.protectionLevel).toBe("full");
      expect(data.channel.status).toBe("active");
      whatsappChannelId = data.channel.id;
    });

    it("SMS 채널 등록 성공", async () => {
      const { status, data } = await mipPost("/channels/register", {
        channelType: "sms",
        accountId: "+82-10-9876-5432",
        displayName: "KT 문자",
        protectionLevel: "full",
      });

      expect(status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.channel.channelType).toBe("sms");
      expect(data.channel.protocol).toBe("webhook");
      smsChannelId = data.channel.id;
    });

    it("Telegram 채널 등록 성공", async () => {
      const { status, data } = await mipPost("/channels/register", {
        channelType: "telegram",
        accountId: "@mybot_test",
        displayName: "내 텔레그램",
        protectionLevel: "monitor_only",
        connectionConfig: { botToken: "123456:ABC-DEF" },
      });

      expect(status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.channel.channelType).toBe("telegram");
      expect(data.channel.protectionLevel).toBe("monitor_only");
      telegramChannelId = data.channel.id;
    });

    it("필수 필드 누락 시 400 에러", async () => {
      const { status, data } = await mipPost("/channels/register", {
        channelType: "whatsapp",
        // accountId 누락
      });

      expect(status).toBe(400);
      expect(data.error).toContain("필수");
    });

    it("유효하지 않은 channelType 시 400 에러", async () => {
      const { status, data } = await mipPost("/channels/register", {
        channelType: "wechat",
        accountId: "test123",
      });

      expect(status).toBe(400);
      expect(data.error).toContain("유효하지 않은");
    });
  });

  // ─── 채널 목록 조회 ────────────────────────────────────────────────────────

  describe("채널 목록 조회", () => {
    it("전체 채널 목록 조회", async () => {
      const { status, data } = await mipGet("/channels/list");

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.channels.length).toBeGreaterThanOrEqual(3);
    });

    it("채널 타입별 필터링 (whatsapp)", async () => {
      const { status, data } = await mipGet("/channels/list?channelType=whatsapp");

      expect(status).toBe(200);
      expect(data.channels.every((c: any) => c.channelType === "whatsapp")).toBe(true);
    });
  });

  // ─── 채널 설정 변경 ────────────────────────────────────────────────────────

  describe("채널 설정 변경", () => {
    it("보호 수준 변경 (full → monitor_only)", async () => {
      const { status, data } = await mipPut(`/channels/${whatsappChannelId}/settings`, {
        protectionLevel: "monitor_only",
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("표시 이름 변경", async () => {
      const { status, data } = await mipPut(`/channels/${smsChannelId}/settings`, {
        displayName: "SKT 문자 (변경됨)",
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("존재하지 않는 채널 설정 변경 시 404", async () => {
      const { status, data } = await mipPut("/channels/nonexistent-id/settings", {
        protectionLevel: "disabled",
      });

      expect(status).toBe(404);
    });
  });

  // ─── 채널 해제 ─────────────────────────────────────────────────────────────

  describe("채널 해제", () => {
    it("Telegram 채널 해제 성공", async () => {
      const { status, data } = await mipPost(`/channels/${telegramChannelId}/disconnect`, {});

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("이미 해제된 채널 재해제 시 404", async () => {
      const { status, data } = await mipPost(`/channels/${telegramChannelId}/disconnect`, {});

      expect(status).toBe(404);
      expect(data.error).toContain("이미 해제");
    });

    it("존재하지 않는 채널 해제 시 404", async () => {
      const { status, data } = await mipPost("/channels/nonexistent-id/disconnect", {});

      expect(status).toBe(404);
    });
  });

  // ─── 채널 통계 ─────────────────────────────────────────────────────────────

  describe("채널 통계", () => {
    it("채널 통계 조회 성공", async () => {
      const { status, data } = await mipGet("/channels/stats");

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.stats).toHaveProperty("totalChannels");
      expect(data.stats).toHaveProperty("activeChannels");
      expect(data.stats).toHaveProperty("totalChecked");
      expect(data.stats).toHaveProperty("totalBlocked");
      expect(data.stats.totalChannels).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── 채널 타입 정보 ────────────────────────────────────────────────────────

  describe("채널 타입 정보", () => {
    it("지원 채널 타입 목록 조회", async () => {
      const { status, data } = await mipGet("/channels/types");

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.types).toHaveProperty("sms");
      expect(data.types).toHaveProperty("kakaotalk");
      expect(data.types).toHaveProperty("whatsapp");
      expect(data.types).toHaveProperty("line");
      expect(data.types).toHaveProperty("telegram");
      expect(data.types).toHaveProperty("instagram");
      expect(data.types).toHaveProperty("rcs");
      expect(data.types.whatsapp.authMethod).toContain("QR");
    });
  });

  // ─── 메시지 검사 channelId 연동 ─────────────────────────────────────────

  describe("메시지 검사 channelId 연동", () => {
    it("등록된 활성 채널(full)의 channelId로 검사 허용", async () => {
      const { status, data } = await mipPost("/message/check", {
        channel: "whatsapp",
        channelId: whatsappChannelId,
        senderNumber: "+82-10-0000-0000",
        messageContent: "안녕하세요, 오늘 날씨가 좋네요.",
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.verdict).toBe("safe");
    });

    it("미등록 channelId로 검사 시 403 CHANNEL_NOT_ALLOWED", async () => {
      const { status, data } = await mipPost("/message/check", {
        channel: "sms",
        channelId: "nonexistent-channel-id-12345",
        senderNumber: "+82-10-0000-0000",
        messageContent: "테스트 메시지",
      });

      expect(status).toBe(403);
      expect(data.error).toBe("CHANNEL_NOT_ALLOWED");
      expect(data.message).toContain("등록되지 않은");
    });

    it("해제된(disconnected) 채널의 channelId로 검사 시 403", async () => {
      // telegramChannelId는 이미 disconnect 테스트에서 해제됨
      const { status, data } = await mipPost("/message/check", {
        channel: "telegram",
        channelId: telegramChannelId,
        senderNumber: "@someone",
        messageContent: "테스트 메시지",
      });

      expect(status).toBe(403);
      expect(data.error).toBe("CHANNEL_NOT_ALLOWED");
      expect(data.message).toContain("비활성");
    });

    it("channelId 없이 검사 시 레거시 호환 (허용)", async () => {
      const { status, data } = await mipPost("/message/check", {
        channel: "sms",
        senderNumber: "+82-10-0000-0000",
        messageContent: "안녕하세요, 오늘 날씨가 좋네요.",
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
