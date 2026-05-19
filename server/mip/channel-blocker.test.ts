/**
 * Channel Blocker 테스트
 * - executeBlock: 채널별 차단 실행 (WhatsApp, Telegram, KakaoTalk, SMS, RCS, LINE, Instagram)
 * - executeUnblock: 차단 해제
 * - getBlockHistory: 차단 이력 조회
 * - determineBlockAction: 판정 수준에 따른 차단 액션 결정
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

// global fetch mock
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { getDb } from "../db";

// ─── Mock DB helpers ──────────────────────────────────────────────────────

function createMockDb(opts?: {
  existingAction?: any;
  channelRecord?: any;
}) {
  const insertedValues: any[] = [];
  const updatedValues: any[] = [];

  const mockDb = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        insertedValues.push(val);
        return Promise.resolve();
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((table) => {
        // mipBlockActions 조회
        if (opts?.existingAction) {
          return {
            where: vi.fn().mockResolvedValue([opts.existingAction]),
          };
        }
        // mipChannels 조회
        if (opts?.channelRecord) {
          return {
            where: vi.fn().mockResolvedValue([opts.channelRecord]),
          };
        }
        return {
          where: vi.fn().mockResolvedValue([]),
        };
      }),
    }),
    _insertedValues: insertedValues,
    _updatedValues: updatedValues,
  };

  (getDb as any).mockResolvedValue(mockDb);
  return mockDb;
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("channel-blocker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("executeBlock", () => {
    it("WhatsApp 채널 — phishing 판정 시 sender_block 실행", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-wa-001",
        channelType: "whatsapp",
        senderIdentifier: "+821012345678",
        messagePreview: "긴급! 계좌 확인 필요",
        verdictLevel: "phishing",
        riskScore: 90,
        checkId: "chk-001",
        connectionConfig: JSON.stringify({
          apiUrl: "https://graph.facebook.com/v18.0",
          accessToken: "test-token",
          phoneNumberId: "123456",
        }),
      });

      expect(result.success).toBe(true);
      expect(result.blockAction).toBe("sender_block");
      expect(result.actionId).toBeTruthy();
      expect(mockFetch).toHaveBeenCalled();
    });

    it("Telegram 채널 — blocked 판정 시 message_quarantine 실행", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-tg-001",
        channelType: "telegram",
        senderIdentifier: "123456789",
        messagePreview: "당신의 계정이 해킹되었습니다",
        verdictLevel: "blocked",
        riskScore: 72,
        checkId: "chk-002",
        connectionConfig: JSON.stringify({
          botToken: "test-bot-token",
          chatId: "-1001234567890",
        }),
      });

      expect(result.success).toBe(true);
      expect(result.blockAction).toBe("message_quarantine");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("KakaoTalk 채널 — phishing 판정 시 sender_block 실행", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-kt-001",
        channelType: "kakaotalk",
        senderIdentifier: "kakao-user-001",
        messagePreview: "택배 배송 확인 http://malicious.link",
        verdictLevel: "phishing",
        riskScore: 88,
        checkId: "chk-003",
        connectionConfig: JSON.stringify({
          apiUrl: "https://kapi.kakao.com",
          appKey: "test-app-key",
          channelId: "channel-001",
        }),
      });

      expect(result.success).toBe(true);
      expect(result.blockAction).toBe("sender_block");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("SMS 채널 — phishing 판정 시 sender_block 실행", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-sms-001",
        channelType: "sms",
        senderIdentifier: "+821098765432",
        messagePreview: "[국세청] 미납 세금 즉시 납부 http://phish.link",
        verdictLevel: "phishing",
        riskScore: 92,
        checkId: "chk-sms-001",
        connectionConfig: JSON.stringify({
          apiUrl: "https://sms-carrier-api.example.com",
          apiKey: "test-sms-api-key",
          subscriberNumber: "+821011112222",
        }),
      });

      expect(result.success).toBe(true);
      expect(result.blockAction).toBe("sender_block");
      expect(mockFetch).toHaveBeenCalled();
      // SMS 어댑터가 /v1/spam/block 엔드포인트를 호출하는지 확인
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain("/v1/spam/block");
    });

    it("RCS 채널 — blocked 판정 시 message_quarantine 실행 (SMS 어댑터 공유)", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-rcs-001",
        channelType: "rcs",
        senderIdentifier: "+821055556666",
        messagePreview: "보이스피싱 의심 메시지",
        verdictLevel: "blocked",
        riskScore: 75,
        checkId: "chk-rcs-001",
        connectionConfig: JSON.stringify({
          apiUrl: "https://rcs-carrier-api.example.com",
          apiKey: "test-rcs-api-key",
          subscriberNumber: "+821077778888",
        }),
      });

      expect(result.success).toBe(true);
      expect(result.blockAction).toBe("message_quarantine");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("LINE 채널 — phishing 판정 시 sender_block 실행", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-line-001",
        channelType: "line",
        senderIdentifier: "U1234567890abcdef",
        messagePreview: "LINE 계정 인증 필요",
        verdictLevel: "phishing",
        riskScore: 86,
        checkId: "chk-line-001",
        connectionConfig: JSON.stringify({
          channelAccessToken: "test-line-token",
        }),
      });

      expect(result.success).toBe(true);
      expect(result.blockAction).toBe("sender_block");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("Instagram 채널 — phishing 판정 시 sender_block 실행", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-ig-001",
        channelType: "instagram",
        senderIdentifier: "ig-user-scammer",
        messagePreview: "DM으로 개인정보 요구",
        verdictLevel: "phishing",
        riskScore: 91,
        checkId: "chk-ig-001",
        connectionConfig: JSON.stringify({
          accessToken: "test-ig-token",
          igUserId: "ig-business-001",
        }),
      });

      expect(result.success).toBe(true);
      expect(result.blockAction).toBe("sender_block");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("지원하지 않는 채널 타입 시 실패 반환", async () => {
      createMockDb();

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-unknown-001",
        channelType: "unknown_channel",
        senderIdentifier: "sender-001",
        verdictLevel: "phishing",
        riskScore: 90,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported channel type");
    });

    it("DB 사용 불가 시 실패 반환", async () => {
      (getDb as any).mockResolvedValue(null);

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-001",
        channelType: "whatsapp",
        senderIdentifier: "+821012345678",
        verdictLevel: "phishing",
        riskScore: 90,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database unavailable");
    });

    it("채널 API 호출 실패 시 status=failed로 기록", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-wa-fail",
        channelType: "whatsapp",
        senderIdentifier: "+821099999999",
        verdictLevel: "phishing",
        riskScore: 95,
        connectionConfig: JSON.stringify({
          apiUrl: "https://graph.facebook.com/v18.0",
          accessToken: "bad-token",
          phoneNumberId: "999",
        }),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("WhatsApp API");
    });

    it("riskScore 85+ phishing → sender_block 결정", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-001",
        channelType: "sms",
        senderIdentifier: "+821000000000",
        verdictLevel: "phishing",
        riskScore: 85,
        connectionConfig: JSON.stringify({ apiUrl: "http://x", apiKey: "k", subscriberNumber: "+8210" }),
      });

      expect(result.blockAction).toBe("sender_block");
    });

    it("riskScore 70~84 blocked → message_quarantine 결정", async () => {
      createMockDb();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeBlock } = await import("./channel-blocker");
      const result = await executeBlock({
        deviceId: "dev-001",
        channelType: "rcs",
        senderIdentifier: "+821000000000",
        verdictLevel: "blocked",
        riskScore: 72,
        connectionConfig: JSON.stringify({ apiUrl: "http://x", apiKey: "k", subscriberNumber: "+8210" }),
      });

      expect(result.blockAction).toBe("message_quarantine");
    });
  });

  describe("executeUnblock", () => {
    it("존재하는 차단 이력에 대해 해제 성공", async () => {
      const existingAction = {
        id: "action-001",
        deviceId: "dev-wa-001",
        channelType: "whatsapp",
        senderIdentifier: "+821012345678",
        blockAction: "sender_block",
        status: "executed",
      };
      // mipBlockActions 조회 → existingAction 반환, mipChannels 조회 → connectionConfig 반환
      const mockDb = {
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              // 첫 번째: blockAction, 두 번째: channel record
              return Promise.resolve([existingAction]);
            }),
          })),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const { executeUnblock } = await import("./channel-blocker");
      const result = await executeUnblock({ actionId: "action-001", requestedBy: "hangyeol" });

      expect(result.success).toBe(true);
    });

    it("존재하지 않는 actionId에 대해 실패", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const { executeUnblock } = await import("./channel-blocker");
      const result = await executeUnblock({ actionId: "nonexistent", requestedBy: "hangyeol" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Block action not found");
    });

    it("이미 해제된 차단에 대해 성공 반환 (중복 해제 방지)", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{
              id: "action-002",
              deviceId: "dev-001",
              channelType: "telegram",
              senderIdentifier: "123",
              status: "unblocked",
            }]),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const { executeUnblock } = await import("./channel-blocker");
      const result = await executeUnblock({ actionId: "action-002", requestedBy: "user" });

      expect(result.success).toBe(true);
    });

    it("DB 사용 불가 시 실패", async () => {
      (getDb as any).mockResolvedValue(null);

      const { executeUnblock } = await import("./channel-blocker");
      const result = await executeUnblock({ actionId: "action-003", requestedBy: "hangyeol" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database unavailable");
    });
  });

  describe("getBlockHistory", () => {
    it("디바이스 ID로 차단 이력 조회", async () => {
      const mockHistory = [
        { id: "a1", deviceId: "dev-001", channelType: "sms", status: "executed" },
        { id: "a2", deviceId: "dev-001", channelType: "sms", status: "unblocked" },
      ];
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockHistory),
          }),
        }),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const { getBlockHistory } = await import("./channel-blocker");
      const history = await getBlockHistory("dev-001");

      expect(history).toHaveLength(2);
      expect(history[0].channelType).toBe("sms");
    });

    it("DB 사용 불가 시 빈 배열 반환", async () => {
      (getDb as any).mockResolvedValue(null);

      const { getBlockHistory } = await import("./channel-blocker");
      const history = await getBlockHistory("dev-001");

      expect(history).toEqual([]);
    });
  });
});
