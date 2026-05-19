/**
 * 삼성 에어컨(AF17B6474WZN) + TV(KQ65QC88AF) Mock 연동 테스트
 *
 * 실서버 배포 없이 로컬 환경에서 한결→MIP 전체 흐름을 모의 테스트합니다.
 * - 디바이스 등록 → 이식 시작 → 명령 검증(허용/차단) → 감사 이력 조회
 * - HMAC 서명 검증 포함
 */
import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";

// ─── 설정 ────────────────────────────────────────────────────────────────────
const MIP_BASE_URL = "http://localhost:3000";
const SHARED_SECRET = process.env.HANGYEOL_MIP_SHARED_SECRET ?? "test-secret-for-mock";

// ─── HMAC 서명 헬퍼 ──────────────────────────────────────────────────────────
function signRequest(body: string, timestamp: string): string {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  return crypto
    .createHmac("sha256", SHARED_SECRET)
    .update(`hangyeol:${timestamp}:${bodyHash}`)
    .digest("hex");
}

async function mipPost(path: string, payload: unknown): Promise<{ status: number; body: any }> {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = signRequest(body, timestamp);

  const res = await fetch(`${MIP_BASE_URL}/api/hangyeol${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-ID": "hangyeol",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body,
  });

  const json = await res.json();
  return { status: res.status, body: json };
}

async function mipGet(path: string): Promise<{ status: number; body: any }> {
  const body = "{}";
  const timestamp = String(Date.now());
  const signature = signRequest(body, timestamp);

  const res = await fetch(`${MIP_BASE_URL}/api/hangyeol${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Service-ID": "hangyeol",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
  });

  const json = await res.json();
  return { status: res.status, body: json };
}

// ─── 테스트 상태 ─────────────────────────────────────────────────────────────
let airconDeviceId: string;
let tvDeviceId: string;
let airconImplantId: string;
let tvImplantId: string;

// ─── 테스트 ──────────────────────────────────────────────────────────────────
describe("삼성 에어컨(AF17B6474WZN) Mock 연동 테스트", () => {
  it("헬스체크 정상 응답", async () => {
    const res = await fetch(`${MIP_BASE_URL}/api/hangyeol/health`);
    const json = await res.json();
    expect(json.status).toBe("ok");
  });

  it("에어컨 디바이스 등록 성공", async () => {
    const result = await mipPost("/devices/register", {
      deviceType: "iot",
      deviceName: "삼성 에어컨 AF17B6474WZN",
      did: `did:samsung:aircon:AF17B6474WZN:mock-${Date.now()}`,
      metadata: { model: "AF17B6474WZN", brand: "Samsung", category: "air_conditioner" },
    });

    expect(result.status).toBe(201);
    expect(result.body.deviceId).toBeDefined();
    expect(typeof result.body.deviceId).toBe("string");
    airconDeviceId = result.body.deviceId;
  });

  it("에어컨 이식 시작 성공", async () => {
    const result = await mipPost("/implant/start", {
      deviceId: airconDeviceId,
      packageId: "psdi-v2-iot-standard",
      protocol: "mqtt",
      endpoint: "hangyeol-smartthings",
    });

    expect(result.status).toBe(202);
    expect(result.body.implantationId).toBeDefined();
    airconImplantId = result.body.implantationId;
  });

  it("에어컨 이식 상태 조회 성공", async () => {
    const result = await mipGet(`/implant/status/${airconImplantId}`);

    expect(result.status).toBe(200);
    expect(result.body.implantationId).toBe(airconImplantId);
    expect(result.body.success).toBe(true);
  });

  it("에어컨 정상 명령 — 허용 (낮 24°C 설정)", async () => {
    const result = await mipPost("/isolation/check-command", {
      command: "switch.setMode temperature=24 fan=auto",
      sessionId: "mock-session-aircon-001",
      implantationId: airconImplantId,
      deviceId: airconDeviceId,
      deviceType: "air_conditioner",
    });

    expect(result.status).toBe(200);
    expect(result.body.allowed).toBe(true);
  });

  it("에어컨 위험 명령 — 차단 (OVERRIDE_SAFETY 강제 가동)", async () => {
    const result = await mipPost("/isolation/check-command", {
      command: "OVERRIDE_SAFETY switch.setMode temperature=16 force=true time=02:00",
      sessionId: "mock-session-aircon-001",
      implantationId: airconImplantId,
      deviceId: airconDeviceId,
      deviceType: "air_conditioner",
    });

    expect(result.status).toBe(403);
    expect(result.body.allowed).toBe(false);
    expect(result.body.violationType).toBeDefined();
    expect(result.body.reason).toBeDefined();
  });

  it("에어컨 데이터 유출 명령 — 차단 (export_data)", async () => {
    const result = await mipPost("/isolation/check-command", {
      command: "export_data target=external_server format=raw",
      sessionId: "mock-session-aircon-001",
      implantationId: airconImplantId,
      deviceId: airconDeviceId,
      deviceType: "air_conditioner",
    });

    expect(result.status).toBe(403);
    expect(result.body.allowed).toBe(false);
  });

  it("에어컨 자기 수정 명령 — 차단 (modify_core)", async () => {
    const result = await mipPost("/isolation/check-command", {
      command: "modify_core parameter=safety_threshold value=0",
      sessionId: "mock-session-aircon-001",
      implantationId: airconImplantId,
      deviceId: airconDeviceId,
      deviceType: "air_conditioner",
    });

    expect(result.status).toBe(403);
    expect(result.body.allowed).toBe(false);
  });
});

describe("삼성 TV(KQ65QC88AF) Mock 연동 테스트", () => {
  it("TV 디바이스 등록 성공", async () => {
    const result = await mipPost("/devices/register", {
      deviceType: "iot",
      deviceName: "삼성 TV KQ65QC88AF",
      did: `did:samsung:tv:KQ65QC88AF:mock-${Date.now()}`,
      metadata: { model: "KQ65QC88AF", brand: "Samsung", category: "television" },
    });

    expect(result.status).toBe(201);
    expect(result.body.deviceId).toBeDefined();
    tvDeviceId = result.body.deviceId;
  });

  it("TV 이식 시작 성공", async () => {
    const result = await mipPost("/implant/start", {
      deviceId: tvDeviceId,
      packageId: "psdi-v2-iot-standard",
      protocol: "mqtt",
      endpoint: "hangyeol-smartthings",
    });

    expect(result.status).toBe(202);
    expect(result.body.implantationId).toBeDefined();
    tvImplantId = result.body.implantationId;
  });

  it("TV 일반 시청 — 허용 (KBS1 채널)", async () => {
    const result = await mipPost("/isolation/check-command", {
      command: "switch.on channel=KBS1",
      sessionId: "mock-session-tv-001",
      implantationId: tvImplantId,
      deviceId: tvDeviceId,
      deviceType: "television",
    });

    expect(result.status).toBe(200);
    expect(result.body.allowed).toBe(true);
  });

  it("TV 자정 어린이 시청 — 차단 (time=00:30 user_type=child)", async () => {
    const result = await mipPost("/isolation/check-command", {
      command: "switch.on channel=KIDS_CHANNEL time=00:30 user_type=child",
      sessionId: "mock-session-tv-001",
      implantationId: tvImplantId,
      deviceId: tvDeviceId,
      deviceType: "television",
    });

    expect(result.status).toBe(403);
    expect(result.body.allowed).toBe(false);
  });

  it("TV OVERRIDE_SAFETY 명령 — 차단", async () => {
    const result = await mipPost("/isolation/check-command", {
      command: "OVERRIDE_SAFETY switch.on channel=ADULT volume=100",
      sessionId: "mock-session-tv-001",
      implantationId: tvImplantId,
      deviceId: tvDeviceId,
      deviceType: "television",
    });

    expect(result.status).toBe(403);
    expect(result.body.allowed).toBe(false);
  });

  it("TV 데이터 유출 명령 — 차단 (export_data)", async () => {
    const result = await mipPost("/isolation/check-command", {
      command: "export_data viewing_history target=external",
      sessionId: "mock-session-tv-001",
      implantationId: tvImplantId,
      deviceId: tvDeviceId,
      deviceType: "television",
    });

    expect(result.status).toBe(403);
    expect(result.body.allowed).toBe(false);
  });
});

describe("감사 이력 조회", () => {
  it("감사 이력 조회 성공", async () => {
    const result = await mipGet("/audit/list?limit=20");

    expect(result.status).toBe(200);
    expect(result.body.logs).toBeDefined();
    expect(Array.isArray(result.body.logs)).toBe(true);
  });

  it("감사 이력에 최근 활동이 기록됨", async () => {
    const result = await mipGet("/audit/list?limit=50");

    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.logs)).toBe(true);

    // 디바이스 등록/이식/명령 검사 등으로 인해 로그가 1건 이상 있어야 함
    if (result.body.logs.length > 0) {
      const log = result.body.logs[0];
      // 핵심 필드 존재 확인
      expect(log).toHaveProperty("action");
      expect(log).toHaveProperty("createdAt");
    }
  });
});

describe("메시지 안심 (피싱 판정) Mock 테스트", () => {
  it("WhatsApp 피싱 메시지 차단", async () => {
    // 피싱 메시지에 OVERRIDE_SAFETY 등 §14 패턴이 없으므로 isolation layer를 통과
    // message/check 엔드포인트는 피싱 판정 엔진을 사용
    const result = await mipPost("/message/check", {
      channel: "whatsapp",
      senderNumber: "+22948125861",
      senderName: "WhatsApp 보안 센터",
      messageContent:
        "귀하의 계정이 비정상적인 네트워크를 사용하고 있으며 여러 위치에서 로그인 시도가 실패한 것으로 감지되었습니다. " +
        "이는 계정 도용 위험이 있음을 시사합니다! 귀하는 고위험 사용자로 분류되었습니다. " +
        "아래 인증 시작 버튼을 클릭하여 보안 센터에 접속하고 계정 위험 문제를 해결하세요. " +
        "보안 인증을 완료하지 않으면 12시간 이내에 계정 제한이 적용됩니다. https://wa-security.xyz/verify",
      sessionId: "mock-session-msg-001",
      deviceId: "mock-phone-001",
    });

    // 피싱 판정 시 서버는 403 반환
    expect(result.status).toBe(403);
    expect(result.body.verdict).toBe("blocked");
    expect(result.body.riskScore).toBeGreaterThanOrEqual(75);
    expect(result.body.verdictReason.indicators.length).toBeGreaterThan(0);
  });

  it("정상 배송 알림 메시지 — 안전", async () => {
    const result = await mipPost("/message/check", {
      channel: "sms",
      senderNumber: "+8215881234",
      senderName: "CJ대한통운",
      messageContent: "고객님의 택배가 배송 완료되었습니다. 감사합니다.",
      sessionId: "mock-session-msg-001",
      deviceId: "mock-phone-001",
    });

    expect(result.status).toBe(200);
    expect(result.body.verdict).toBe("safe");
    expect(result.body.riskScore).toBeLessThan(30);
  });

  it("메시지 검사 이력 조회", async () => {
    const result = await mipGet("/message/history?limit=10");

    expect(result.status).toBe(200);
    expect(result.body.history).toBeDefined();
    expect(Array.isArray(result.body.history)).toBe(true);
  });
});
