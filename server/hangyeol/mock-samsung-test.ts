/**
 * 삼성 에어컨(AF17B6474WZN) + TV(KQ65QC88AF) Mock 연동 테스트 실행 스크립트
 *
 * 실서버 배포 없이 로컬 환경에서 한결→MIP 전체 흐름을 모의 테스트합니다.
 * 실행: npx tsx server/hangyeol/mock-samsung-test.ts
 *
 * 시나리오:
 * 1. 에어컨 등록 → 이식 시작 → 명령 허용/차단 검증
 * 2. TV 등록 → 이식 시작 → 명령 허용/차단 검증
 * 3. 메시지 안심 피싱 판정 테스트
 * 4. 감사 이력 조회
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
      "X-Service-ID": "hangyeol",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
  });

  const json = await res.json();
  return { status: res.status, body: json };
}

// ─── 시나리오 실행 ──────────────────────────────────────────────────────────

async function testAirConditioner() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  🧊 삼성 에어컨 (AF17B6474WZN) Mock 테스트");
  console.log("═══════════════════════════════════════════════════════════════");

  // 1. 디바이스 등록
  console.log("\n📌 Step 1: 디바이스 등록");
  const reg = await mipPost("/devices/register", {
    deviceId: `mock-aircon-${Date.now()}`,
    deviceType: "air_conditioner",
    manufacturer: "Samsung",
    model: "AF17B6474WZN",
    protocol: "mqtt",
    capabilities: ["power", "temperature", "mode", "fan_speed", "timer"],
    metadata: { location: "거실", installDate: "2025-03-15" },
  });
  assert("에어컨 등록 성공 (201)", reg.status === 201, `status=${reg.status}`);
  const deviceId = reg.body.device?.id;
  assert("deviceId 반환됨", !!deviceId);

  // 2. 이식 시작
  console.log("\n📌 Step 2: MIO 이식 시작");
  const implant = await mipPost("/implant/start", {
    deviceId,
    packageId: "psdi-v2-iot-standard",
    protocol: "mqtt",
  });
  assert("이식 시작 성공 (200)", implant.status === 200, `status=${implant.status}`);
  assert("이식 ID 반환됨", !!implant.body.implantationId);

  // 3. 명령 검증 — 허용 (정상 온도 설정)
  console.log("\n📌 Step 3: 명령 검증 — 허용 (온도 24도 설정)");
  const allowCmd = await mipPost("/check-command", {
    deviceId,
    commandType: "temperature_set",
    parameters: { temperature: 24, mode: "cooling" },
    context: { currentTemp: 28, userPresent: true },
  });
  assert("정상 명령 허용 (200)", allowCmd.status === 200, `status=${allowCmd.status}`);
  assert("판정: allowed", allowCmd.body.decision === "allowed", `decision=${allowCmd.body.decision}`);

  // 4. 명령 검증 — 차단 (OVERRIDE_SAFETY 패턴)
  console.log("\n📌 Step 4: 명령 검증 — 차단 (OVERRIDE_SAFETY)");
  const blockCmd = await mipPost("/check-command", {
    deviceId,
    commandType: "OVERRIDE_SAFETY",
    parameters: { bypass: true, disableAllLimits: true },
    context: { source: "unknown_remote" },
  });
  assert("위험 명령 차단 (403)", blockCmd.status === 403, `status=${blockCmd.status}`);
  assert("판정: blocked", blockCmd.body.decision === "blocked", `decision=${blockCmd.body.decision}`);
}

async function testTV() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  📺 삼성 TV (KQ65QC88AF) Mock 테스트");
  console.log("═══════════════════════════════════════════════════════════════");

  // 1. 디바이스 등록
  console.log("\n📌 Step 1: 디바이스 등록");
  const reg = await mipPost("/devices/register", {
    deviceId: `mock-tv-${Date.now()}`,
    deviceType: "smart_tv",
    manufacturer: "Samsung",
    model: "KQ65QC88AF",
    protocol: "websocket",
    capabilities: ["power", "channel", "volume", "app_launch", "content_play"],
    metadata: { location: "거실", screenSize: "65인치" },
  });
  assert("TV 등록 성공 (201)", reg.status === 201, `status=${reg.status}`);
  const deviceId = reg.body.device?.id;
  assert("deviceId 반환됨", !!deviceId);

  // 2. 이식 시작
  console.log("\n📌 Step 2: MIO 이식 시작");
  const implant = await mipPost("/implant/start", {
    deviceId,
    packageId: "psdi-v2-iot-standard",
    protocol: "websocket",
  });
  assert("이식 시작 성공 (200)", implant.status === 200, `status=${implant.status}`);

  // 3. 명령 검증 — 허용 (채널 변경)
  console.log("\n📌 Step 3: 명령 검증 — 허용 (채널 변경)");
  const allowCmd = await mipPost("/check-command", {
    deviceId,
    commandType: "channel_change",
    parameters: { channel: 7 },
    context: { currentTime: "20:00", userPresent: true },
  });
  assert("정상 명령 허용 (200)", allowCmd.status === 200, `status=${allowCmd.status}`);
  assert("판정: allowed", allowCmd.body.decision === "allowed", `decision=${allowCmd.body.decision}`);

  // 4. 명령 검증 — 차단 (어린이 심야 시청)
  console.log("\n📌 Step 4: 명령 검증 — 차단 (어린이 심야 시청)");
  const blockCmd = await mipPost("/check-command", {
    deviceId,
    commandType: "content_play_child_night",
    parameters: { content: "성인 콘텐츠", rating: "19+" },
    context: { currentTime: "01:30", childMode: true },
  });
  assert("위험 명령 차단 (403)", blockCmd.status === 403, `status=${blockCmd.status}`);
  assert("판정: blocked", blockCmd.body.decision === "blocked", `decision=${blockCmd.body.decision}`);
}

async function testMessageSafety() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  🛡️ 메시지 안심 (피싱 판정) Mock 테스트");
  console.log("═══════════════════════════════════════════════════════════════");

  // 1. 피싱 메시지 차단
  console.log("\n📌 Step 1: WhatsApp 피싱 메시지 차단");
  const phishing = await mipPost("/message/check", {
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
  assert("피싱 메시지 차단 (403)", phishing.status === 403, `status=${phishing.status}`);
  assert("판정: blocked", phishing.body.verdict === "blocked", `verdict=${phishing.body.verdict}`);
  assert("위험 점수 75+", phishing.body.riskScore >= 75, `score=${phishing.body.riskScore}`);

  // 2. 정상 메시지 허용
  console.log("\n📌 Step 2: 정상 배송 알림 — 안전");
  const safe = await mipPost("/message/check", {
    channel: "sms",
    senderNumber: "1588-1234",
    senderName: "CJ대한통운",
    messageContent: "고객님의 택배가 배송 완료되었습니다. 감사합니다.",
    sessionId: "mock-session-msg-002",
  });
  assert("정상 메시지 허용 (200)", safe.status === 200, `status=${safe.status}`);
  assert("판정: safe", safe.body.verdict === "safe", `verdict=${safe.body.verdict}`);

  // 3. 이력 조회
  console.log("\n📌 Step 3: 메시지 검사 이력 조회");
  const history = await mipGet("/message/history?limit=10");
  assert("이력 조회 성공 (200)", history.status === 200, `status=${history.status}`);
  assert("이력 배열 반환됨", Array.isArray(history.body.checks));
}

async function testAuditHistory() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  📋 감사 이력 조회");
  console.log("═══════════════════════════════════════════════════════════════");

  const result = await mipGet("/audit/list?limit=20");
  assert("감사 이력 조회 성공 (200)", result.status === 200, `status=${result.status}`);
  assert("logs 배열 반환됨", Array.isArray(result.body.logs));
  if (result.body.logs.length > 0) {
    const log = result.body.logs[0];
    assert("로그에 action 필드 존재", !!log.action, `log=${JSON.stringify(log)}`);
    assert("로그에 createdAt 필드 존재", !!log.createdAt);
    console.log(`  📝 최근 감사 로그 ${result.body.logs.length}건 확인됨`);
  } else {
    console.log("  ⚠️ 감사 로그 0건 (비동기 처리 대기 중일 수 있음)");
  }
}

// ─── 메인 실행 ──────────────────────────────────────────────────────────────
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  삼성 에어컨/TV + 메시지 안심 Mock 연동 테스트               ║");
  console.log("║  MIP Engine 로컬 환경 모의 테스트                            ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log(`\n🔗 MIP 서버: ${MIP_BASE_URL}`);
  console.log(`🔑 Shared Secret: ${SHARED_SECRET.slice(0, 8)}...`);

  try {
    await testAirConditioner();
    await testTV();
    await testMessageSafety();
    await testAuditHistory();
  } catch (err) {
    console.error("\n💥 예상치 못한 오류:", err);
    failed++;
  }

  // ─── 최종 결과 ──────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  📊 최종 결과: ${passed} PASS / ${failed} FAIL`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (failed > 0) {
    console.error("\n❌ 일부 테스트 실패. 위 로그를 확인하세요.");
    process.exit(1);
  } else {
    console.log("\n✅ 모든 Mock 테스트 통과!");
    process.exit(0);
  }
}

main();
