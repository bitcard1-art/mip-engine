/**
 * 채널 디바이스 메시지 수신 (자동 검열) + 한결 웹훅 전송 테스트
 * POST /api/hangyeol/channel/inbound
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ─── Mocks ─────────────────────────────────────────────────────────────────
vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../mip/message-safety", () => ({
  checkMessageSafety: vi.fn().mockResolvedValue({
    checkId: "chk-test-001",
    riskScore: 85,
    verdict: "blocked",
    verdictReason: "phishing_link_detected",
    scores: { senderTrust: 20, urgency: 80, threat: 90, linkRisk: 95, impersonation: 70, personalInfoRequest: 60 },
    action: "block",
  }),
}));

vi.mock("./webhook-sender", () => ({
  sendCheckResultToHangyeol: vi.fn().mockResolvedValue(true),
}));

const SHARED_SECRET = "test-hangyeol-mip-secret";
vi.mock("../_core/env", () => ({
  ENV: {
    hangyeolMipSharedSecret: SHARED_SECRET,
    mipHangyeolSharedSecret: SHARED_SECRET,
    hangyeolServiceUrl: "https://hangyeol.mysoma.space",
  },
}));

import { getDb } from "../db";
import { checkMessageSafety } from "../mip/message-safety";
import { sendCheckResultToHangyeol } from "./webhook-sender";

// ─── Helper ────────────────────────────────────────────────────────────────
function makeSignature(body: string, timestamp: string): string {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  return crypto
    .createHmac("sha256", SHARED_SECRET)
    .update(`hangyeol:${timestamp}:${bodyHash}`)
    .digest("hex");
}

async function postInbound(body: object) {
  const { default: express } = await import("express");
  const { default: hangyeolRouter } = await import("./hangyeol-router");
  const app = express();
  app.use(express.json());
  app.use("/api/hangyeol", hangyeolRouter);

  const { default: request } = await import("supertest");
  const bodyStr = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const signature = makeSignature(bodyStr, timestamp);

  return request(app)
    .post("/api/hangyeol/channel/inbound")
    .set("Content-Type", "application/json")
    .set("X-Service-ID", "hangyeol")
    .set("X-Timestamp", timestamp)
    .set("X-Signature", signature)
    .send(body);
}

// ─── Mock DB ───────────────────────────────────────────────────────────────
const mockDevice = {
  id: "dev-channel-001",
  userId: "user-001",
  deviceName: "이영도 카카오톡",
  deviceType: "kakaotalk",
  did: "did:soma:kakaotalk-001",
  status: "active",
};

const mockActiveSession = {
  id: "session-001",
  deviceId: "dev-channel-001",
  status: "active",
  protocol: "webhook",
};

function setupMockDb(device: any, session: any) {
  let callCount = 0;
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(device ? [device] : []);
      if (callCount === 2) return Promise.resolve(session ? [session] : []);
      // 3번째 이후: mipChannels 조회 (executeBlock 내부)
      return Promise.resolve([]);
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
  (getDb as any).mockResolvedValue(mockDb);
  return mockDb;
}

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("POST /api/hangyeol/channel/inbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("이식 완료된 채널 디바이스에 메시지 수신 시 자동 검열 수행", async () => {
    setupMockDb(mockDevice, mockActiveSession);

    const res = await postInbound({
      deviceId: "dev-channel-001",
      channelType: "kakaotalk",
      senderNumber: "+821012345678",
      senderName: "스미싱범",
      messageContent: "긴급! 계좌 확인 필요 http://phishing.link",
    });

    expect(res.status).toBe(403); // blocked
    expect(res.body.success).toBe(true);
    expect(res.body.verdict).toBe("blocked");
    expect(res.body.deviceId).toBe("dev-channel-001");
    expect(checkMessageSafety).toHaveBeenCalledOnce();
  });

  it("검열 결과가 safe가 아니면 한결에 자동 전송", async () => {
    setupMockDb(mockDevice, mockActiveSession);

    await postInbound({
      deviceId: "dev-channel-001",
      messageContent: "긴급! 계좌 확인 필요",
    });

    // sendCheckResultToHangyeol이 호출되어야 함
    // 비동기 fire-and-forget이므로 약간 대기
    await new Promise((r) => setTimeout(r, 50));
    expect(sendCheckResultToHangyeol).toHaveBeenCalledOnce();
    expect((sendCheckResultToHangyeol as any).mock.calls[0][0]).toMatchObject({
      checkId: "chk-test-001",
      verdict: "blocked",
      deviceId: "dev-channel-001",
    });
  });

  it("safe 판정이면 한결에 전송하지 않음", async () => {
    setupMockDb(mockDevice, mockActiveSession);
    (checkMessageSafety as any).mockResolvedValueOnce({
      checkId: "chk-safe-001",
      riskScore: 10,
      verdict: "safe",
      verdictReason: "normal_message",
      scores: { senderTrust: 90, urgency: 5, threat: 5, linkRisk: 0, impersonation: 5, personalInfoRequest: 0 },
      action: "allow",
    });

    const res = await postInbound({
      deviceId: "dev-channel-001",
      messageContent: "안녕하세요!",
    });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe("safe");
    await new Promise((r) => setTimeout(r, 50));
    expect(sendCheckResultToHangyeol).not.toHaveBeenCalled();
  });

  it("디바이스 미존재 시 404", async () => {
    setupMockDb(null, null);

    const res = await postInbound({
      deviceId: "nonexistent",
      messageContent: "test",
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("DEVICE_NOT_FOUND");
  });

  it("채널 타입이 아닌 디바이스 시 400", async () => {
    setupMockDb({ ...mockDevice, deviceType: "humanoid" }, null);

    const res = await postInbound({
      deviceId: "dev-channel-001",
      messageContent: "test",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("NOT_CHANNEL_DEVICE");
  });

  it("이식 미완료(active 세션 없음) 시 403", async () => {
    setupMockDb(mockDevice, null);

    const res = await postInbound({
      deviceId: "dev-channel-001",
      messageContent: "test",
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("IMPLANTATION_NOT_ACTIVE");
  });

  it("필수 필드 누락 시 400", async () => {
    setupMockDb(mockDevice, mockActiveSession);

    const res = await postInbound({
      deviceId: "dev-channel-001",
      // messageContent 누락
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("MISSING_FIELDS");
  });
});
