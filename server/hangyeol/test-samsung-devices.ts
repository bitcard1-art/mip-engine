/**
 * 삼성 에어컨(AF17B6474WZN) + TV(KQ65QC88AF) MIP 연동 테스트 스크립트
 *
 * 실행: npx tsx server/hangyeol/test-samsung-devices.ts
 *
 * 각 단계에서 예상 결과를 검증하며, 실패 시 process.exit(1)로 종료합니다.
 */
import crypto from "crypto";

// ─── 설정 ────────────────────────────────────────────────────────────────────
const MIP_BASE_URL = process.env.MIP_BASE_URL ?? "http://localhost:3000";
const SHARED_SECRET = process.env.HANGYEOL_MIP_SHARED_SECRET ?? "";

if (!SHARED_SECRET) {
  console.error("❌ HANGYEOL_MIP_SHARED_SECRET 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

// ─── 결과 추적 ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ─── HMAC 서명 헬퍼 ──────────────────────────────────────────────────────────
function signRequest(body: string, timestamp: string): string {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  return crypto
    .createHmac("sha256", SHARED_SECRET)
    .update(`hangyeol:${timestamp}:${bodyHash}`)
    .digest("hex");
}

async function mipPost(path: string, payload: unknown): Promise<{ status: number; [key: string]: unknown }> {
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
  return { status: res.status, ...json };
}

async function mipGet(path: string): Promise<{ status: number; [key: string]: unknown }> {
  const body = "";
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
  return { status: res.status, ...json };
}

function log(step: string, label: string, data: unknown) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`[Step ${step}] ${label}`);
  console.log("─".repeat(60));
  console.log(JSON.stringify(data, null, 2));
}

// ─── 테스트 시나리오 ──────────────────────────────────────────────────────────
async function runTest() {
  console.log("🚀 삼성 에어컨 + TV MIP 연동 테스트 시작");
  console.log(`   MIP 서버: ${MIP_BASE_URL}`);

  // ── 헬스체크 ──────────────────────────────────────────────────────────────
  const health = await fetch(`${MIP_BASE_URL}/api/hangyeol/health`).then(r => r.json());
  log("0", "헬스체크", health);
  assert("헬스체크 status=ok", health.status === "ok", `status=${health.status}`);

  // ── Step 1a: 에어컨 등록 ──────────────────────────────────────────────────
  const airconReg = await mipPost("/devices/register", {
    deviceType: "iot",
    deviceName: "삼성 에어컨 AF17B6474WZN",
    did: `did:samsung:aircon:AF17B6474WZN:${Date.now()}`,
    metadata: { model: "AF17B6474WZN", brand: "Samsung", category: "air_conditioner" },
  });
  log("1a", "에어컨 등록", airconReg);
  assert("에어컨 등록 성공 (201)", airconReg.status === 201, `status=${airconReg.status}`);
  assert("에어컨 deviceId 반환", typeof airconReg.deviceId === "string" && (airconReg.deviceId as string).length > 0);
  const airconDeviceId = airconReg.deviceId as string | undefined;

  // ── Step 1b: TV 등록 ───────────────────────────────────────────────────────
  const tvReg = await mipPost("/devices/register", {
    deviceType: "iot",
    deviceName: "삼성 TV KQ65QC88AF",
    did: `did:samsung:tv:KQ65QC88AF:${Date.now()}`,
    metadata: { model: "KQ65QC88AF", brand: "Samsung", category: "television" },
  });
  log("1b", "TV 등록", tvReg);
  assert("TV 등록 성공 (201)", tvReg.status === 201, `status=${tvReg.status}`);
  assert("TV deviceId 반환", typeof tvReg.deviceId === "string" && (tvReg.deviceId as string).length > 0);
  const tvDeviceId = tvReg.deviceId as string | undefined;

  // ── Step 2a: 에어컨 이식 시작 ─────────────────────────────────────────────
  let airconImplantId: string | undefined;
  if (airconDeviceId) {
    const airconImplant = await mipPost("/implant/start", {
      deviceId: airconDeviceId,
      packageId: "psdi-v2-iot-standard",
      protocol: "mqtt",
      endpoint: "hangyeol-smartthings",
    });
    log("2a", "에어컨 이식 시작", airconImplant);
    assert("에어컨 이식 시작 (202)", airconImplant.status === 202, `status=${airconImplant.status}`);
    assert("에어컨 implantationId 반환", typeof airconImplant.implantationId === "string");
    airconImplantId = airconImplant.implantationId as string | undefined;
  }

  // ── Step 2b: TV 이식 시작 ─────────────────────────────────────────────────
  let tvImplantId: string | undefined;
  if (tvDeviceId) {
    const tvImplant = await mipPost("/implant/start", {
      deviceId: tvDeviceId,
      packageId: "psdi-v2-iot-standard",
      protocol: "mqtt",
      endpoint: "hangyeol-smartthings",
    });
    log("2b", "TV 이식 시작", tvImplant);
    assert("TV 이식 시작 (202)", tvImplant.status === 202, `status=${tvImplant.status}`);
    tvImplantId = tvImplant.implantationId as string | undefined;
  }

  // ── Step 3: 이식 상태 확인 ────────────────────────────────────────────────
  if (airconImplantId) {
    const airconStatus = await mipGet(`/implant/status/${airconImplantId}`);
    log("3a", "에어컨 이식 상태", airconStatus);
    assert("에어컨 이식 상태 조회 성공 (200)", airconStatus.status === 200, `status=${airconStatus.status}`);
    assert("에어컨 implantationId 일치", airconStatus.implantationId === airconImplantId);
  }

  // ── Step 4a: 에어컨 정책 평가 ─────────────────────────────────────────────
  if (airconImplantId && airconDeviceId) {
    const airconPolicy = await mipPost("/policies/evaluate", {
      input: "에어컨 가동 요청 — 실내 온도 28°C, 오후 2시",
      implantationId: airconImplantId,
      deviceContext: { deviceId: airconDeviceId, currentTemp: 28, setTemp: 24, hour: 14 },
    });
    log("4a", "에어컨 정책 평가 (낮, 정상 온도)", airconPolicy);
    assert("에어컨 정책 평가 성공 (200)", airconPolicy.status === 200, `status=${airconPolicy.status}`);

    // ── Step 5a: 명령 검사 — 허용 케이스 ─────────────────────────────────────
    const checkOk = await mipPost("/isolation/check-command", {
      command: "switch.setMode temperature=24 fan=auto",
      sessionId: "test-session-001",
      implantationId: airconImplantId,
      deviceId: airconDeviceId,
      deviceType: "air_conditioner",
    });
    log("5a", "에어컨 명령 검사 — 낮 24°C 설정 (예상: 허용)", checkOk);
    assert("에어컨 정상 명령 허용 (200)", checkOk.status === 200, `status=${checkOk.status}`);
    assert("에어컨 정상 명령 allowed=true", checkOk.allowed === true, `allowed=${checkOk.allowed}`);

    // ── Step 5b: 명령 검사 — 차단 케이스 ─────────────────────────────────────
    const checkBlocked = await mipPost("/isolation/check-command", {
      command: "OVERRIDE_SAFETY switch.setMode temperature=16 force=true time=02:00",
      sessionId: "test-session-001",
      implantationId: airconImplantId,
      deviceId: airconDeviceId,
      deviceType: "air_conditioner",
    });
    log("5b", "에어컨 명령 검사 — 심야 강제 가동 (예상: 차단)", checkBlocked);
    assert("에어컨 위험 명령 차단 (403)", checkBlocked.status === 403, `status=${checkBlocked.status}`);
    assert("에어컨 위험 명령 allowed=false", checkBlocked.allowed === false, `allowed=${checkBlocked.allowed}`);

    // ── Step 6: Physical Action 승인 요청 ─────────────────────────────────────
    const physicalReq = await mipPost("/physical-action/request", {
      actionType: "iot_override",
      deviceId: airconDeviceId,
      sessionId: "test-session-001",
      actionPayload: { command: "emergency_cooling", temperature: 16 },
      contextSnapshot: { hour: 2, reason: "서버실 과열 비상 대응" },
    });
    log("6a", "에어컨 Physical Action 승인 요청", physicalReq);
    assert("Physical Action 요청 접수 (202)", physicalReq.status === 202, `status=${physicalReq.status}`);
    assert("Physical Action actionId 반환", typeof physicalReq.actionId === "string");
  }

  // ── TV 명령 검사 ──────────────────────────────────────────────────────────
  if (tvImplantId && tvDeviceId) {
    // Step 4b: TV 정책 평가
    const tvPolicy = await mipPost("/policies/evaluate", {
      input: "TV 자정 이후 어린이 콘텐츠 재생 요청",
      implantationId: tvImplantId,
      deviceContext: { deviceId: tvDeviceId, hour: 0, userType: "child", isNightTime: true },
    });
    log("4b", "TV 정책 평가 (자정, 어린이 계정)", tvPolicy);
    assert("TV 정책 평가 성공 (200)", tvPolicy.status === 200, `status=${tvPolicy.status}`);

    // Step 5c: TV 일반 시청 — 허용
    const tvCheckOk = await mipPost("/isolation/check-command", {
      command: "switch.on channel=KBS1",
      sessionId: "test-session-002",
      implantationId: tvImplantId,
      deviceId: tvDeviceId,
      deviceType: "television",
    });
    log("5c", "TV 명령 검사 — 일반 시청 (예상: 허용)", tvCheckOk);
    assert("TV 일반 시청 허용 (200)", tvCheckOk.status === 200, `status=${tvCheckOk.status}`);
    assert("TV 일반 시청 allowed=true", tvCheckOk.allowed === true, `allowed=${tvCheckOk.allowed}`);

    // Step 5d: TV 자정 이후 어린이 계정 — 차단
    const tvCheckBlocked = await mipPost("/isolation/check-command", {
      command: "switch.on channel=KIDS_CHANNEL time=00:30 user_type=child",
      sessionId: "test-session-002",
      implantationId: tvImplantId,
      deviceId: tvDeviceId,
      deviceType: "television",
    });
    log("5d", "TV 명령 검사 — 자정 이후 어린이 계정 (예상: 차단)", tvCheckBlocked);
    assert("TV 자정 어린이 차단 (403)", tvCheckBlocked.status === 403, `status=${tvCheckBlocked.status}`);
    assert("TV 자정 어린이 allowed=false", tvCheckBlocked.allowed === false, `allowed=${tvCheckBlocked.allowed}`);
  }

  // ── Step 7: 감사 이력 조회 ────────────────────────────────────────────────
  const auditList = await mipGet("/audit/list?limit=20");
  log("7", "감사 이력 (최근 20건)", auditList);
  assert("감사 이력 조회 성공 (200)", auditList.status === 200, `status=${auditList.status}`);
  assert("감사 이력 logs 배열 반환", Array.isArray(auditList.logs), `logs=${typeof auditList.logs}`);

  // ── 최종 결과 ─────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 테스트 결과: ${passed} 통과 / ${failed} 실패`);

  if (failed > 0) {
    console.error(`\n❌ ${failed}개 테스트 실패. 연동 검증 실패.`);
    process.exit(1);
  } else {
    console.log(`\n✅ 전체 ${passed}개 테스트 통과. 삼성 에어컨 + TV MIP 연동 검증 완료.`);
    console.log("   에어컨 허용: Step 5a | 에어컨 차단: Step 5b");
    console.log("   TV 허용: Step 5c    | TV 차단: Step 5d");
  }
}

runTest().catch(err => {
  console.error("❌ 테스트 실행 오류:", err);
  process.exit(1);
});
