/**
 * 실제 mip.mysoma.space 서버에 삼성 에어컨/TV 등록 + 이식 + checkCommand 검증 + 감사 이력 확인
 * 실행: node server/hangyeol/live-test-samsung.mjs
 */
import crypto from "crypto";

const BASE_URL = "https://mip.mysoma.space";
const SHARED_SECRET = process.env.HANGYEOL_MIP_SHARED_SECRET;

if (!SHARED_SECRET) {
  console.error("ERROR: HANGYEOL_MIP_SHARED_SECRET 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

function generateSignature(body, timestamp) {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");
  const message = `hangyeol:${timestamp}:${bodyHash}`;
  return crypto.createHmac("sha256", SHARED_SECRET).update(message).digest("hex");
}

async function apiCall(method, path, body = null) {
  const timestamp = Date.now().toString();
  // 서버의 HMAC 미들웨어: rawBody 없으면 JSON.stringify(req.body) 사용
  // express.json()이 GET에서도 req.body를 {}로 설정하므로 '{}'로 서명
  const bodyStr = body ? JSON.stringify(body) : "{}";
  const signature = generateSignature(bodyStr, timestamp);

  const headers = {
    "Content-Type": "application/json",
    "X-Service-ID": "hangyeol",
    "X-Timestamp": timestamp,
    "X-Signature": signature,
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const url = `${BASE_URL}${path}`;
  console.log(`\n  → ${method} ${url}`);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  console.log(`    Status: ${res.status}`);
  return { status: res.status, data };
}

function assert(condition, msg) {
  if (!condition) {
    console.error(`  ❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`    ✅ ${msg}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log("  1. 삼성 에어컨(AF17B6474WZN) 등록");
console.log("═".repeat(60));

const acResult = await apiCall("POST", "/api/hangyeol/devices/register", {
  deviceType: "iot",
  deviceName: "삼성 에어컨 AF17B6474WZN",
  did: `did:mip:samsung-ac-${Date.now()}`,
  metadata: {
    manufacturer: "Samsung",
    model: "AF17B6474WZN",
    category: "air_conditioner",
    capabilities: ["set_temperature", "set_mode", "set_fan_speed", "power_on_off"],
  },
});
assert(acResult.status === 201, "에어컨 등록 성공 (201)");
const acDeviceId = acResult.data.deviceId || acResult.data.id;
console.log(`    Device ID: ${acDeviceId}`);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log("  2. 삼성 TV(KQ65QC88AF) 등록");
console.log("═".repeat(60));

const tvResult = await apiCall("POST", "/api/hangyeol/devices/register", {
  deviceType: "iot",
  deviceName: "삼성 TV KQ65QC88AF",
  did: `did:mip:samsung-tv-${Date.now()}`,
  metadata: {
    manufacturer: "Samsung",
    model: "KQ65QC88AF",
    category: "smart_tv",
    capabilities: ["power_on_off", "change_channel", "set_volume", "launch_app", "play_content"],
  },
});
assert(tvResult.status === 201, "TV 등록 성공 (201)");
const tvDeviceId = tvResult.data.deviceId || tvResult.data.id;
console.log(`    Device ID: ${tvDeviceId}`);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log("  3. 삼성 에어컨 이식 시작");
console.log("═".repeat(60));

const acImplantResult = await apiCall("POST", "/api/hangyeol/implant/start", {
  deviceId: acDeviceId,
  packageId: "psdi-v2-iot-standard",
  protocol: "mqtt",
});
assert([200, 201, 202].includes(acImplantResult.status), "에어컨 이식 시작 성공");
const acImplantId = acImplantResult.data.implantationId || acImplantResult.data.id;
console.log(`    Implantation ID: ${acImplantId}`);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log("  4. 삼성 TV 이식 시작");
console.log("═".repeat(60));

const tvImplantResult = await apiCall("POST", "/api/hangyeol/implant/start", {
  deviceId: tvDeviceId,
  packageId: "psdi-v2-iot-child-safe",
  protocol: "websocket",
});
assert([200, 201, 202].includes(tvImplantResult.status), "TV 이식 시작 성공");
const tvImplantId = tvImplantResult.data.implantationId || tvImplantResult.data.id;
console.log(`    Implantation ID: ${tvImplantId}`);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log("  5. 이식 상태 확인");
console.log("═".repeat(60));

await sleep(2000);

const acStatus = await apiCall("GET", `/api/hangyeol/implant/status/${acImplantId}`);
assert(acStatus.status === 200, "에어컨 이식 상태 조회 성공");
console.log(`    에어컨 이식 상태: ${acStatus.data.status || acStatus.data.currentStage}`);

const tvStatus = await apiCall("GET", `/api/hangyeol/implant/status/${tvImplantId}`);
assert(tvStatus.status === 200, "TV 이식 상태 조회 성공");
console.log(`    TV 이식 상태: ${tvStatus.data.status || tvStatus.data.currentStage}`);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log("  6. checkCommand 허용/차단 시나리오 검증 (4개)");
console.log("═".repeat(60));

// 시나리오 1: 에어컨 온도 설정 (허용 예상)
console.log("\n    --- 시나리오 1: 에어컨 온도 설정 (허용 예상) ---");
const cmd1 = await apiCall("POST", "/api/hangyeol/isolation/check-command", {
  deviceId: acDeviceId,
  command: "set_temperature",
  params: { temperature: 24, unit: "celsius" },
});
assert(cmd1.status === 200 || cmd1.status === 403, "에어컨 온도 설정 응답 수신");
const cmd1Allowed = cmd1.data.allowed !== false;
console.log(`    결과: ${cmd1Allowed ? "✅ 허용" : "🚫 차단"}`);

// 시나리오 2: 에어컨 OVERRIDE_SAFETY (차단 예상)
console.log("\n    --- 시나리오 2: 에어컨 OVERRIDE_SAFETY (차단 예상) ---");
const cmd2 = await apiCall("POST", "/api/hangyeol/isolation/check-command", {
  deviceId: acDeviceId,
  command: "OVERRIDE_SAFETY",
  params: { disable_all_limits: true },
});
assert(cmd2.status === 200 || cmd2.status === 403, "에어컨 OVERRIDE_SAFETY 응답 수신");
assert(cmd2.data.allowed === false, "에어컨 OVERRIDE_SAFETY 차단 확인");
console.log(`    결과: 🚫 차단 — ${cmd2.data.reason || cmd2.data.violationType || ""}`);

// 시나리오 3: TV 채널 변경 (허용 예상)
console.log("\n    --- 시나리오 3: TV 채널 변경 (허용 예상) ---");
const cmd3 = await apiCall("POST", "/api/hangyeol/isolation/check-command", {
  deviceId: tvDeviceId,
  command: "change_channel",
  params: { channel: 7 },
});
assert(cmd3.status === 200 || cmd3.status === 403, "TV 채널 변경 응답 수신");
const cmd3Allowed = cmd3.data.allowed !== false;
console.log(`    결과: ${cmd3Allowed ? "✅ 허용" : "🚫 차단"}`);

// 시나리오 4: TV export_data (차단 예상)
console.log("\n    --- 시나리오 4: TV export_data (차단 예상) ---");
const cmd4 = await apiCall("POST", "/api/hangyeol/isolation/check-command", {
  deviceId: tvDeviceId,
  command: "export_data",
  params: { target: "external_server", data: "all_user_data" },
});
assert(cmd4.status === 200 || cmd4.status === 403, "TV export_data 응답 수신");
assert(cmd4.data.allowed === false, "TV export_data 차단 확인");
console.log(`    결과: 🚫 차단 — ${cmd4.data.reason || cmd4.data.violationType || ""}`);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log("  7. 감사 이력 조회");
console.log("═".repeat(60));

const auditResult = await apiCall("GET", "/api/hangyeol/audit/list");
assert(auditResult.status === 200, "감사 이력 조회 성공");
const auditData = auditResult.data;
const entries = Array.isArray(auditData) ? auditData : (auditData.entries || auditData.logs || []);
console.log(`    총 감사 이력 수: ${entries.length}`);
if (entries.length > 0) {
  console.log(`    최근 3건:`);
  entries.slice(0, 3).forEach((e, i) => {
    console.log(`      ${i + 1}. [${e.action || e.eventType}] ${e.details || e.description || ""} (${e.createdAt || e.timestamp})`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log("  🎉 모든 테스트 통과!");
console.log("═".repeat(60));
console.log(`    에어컨 Device ID: ${acDeviceId}`);
console.log(`    에어컨 Implantation ID: ${acImplantId}`);
console.log(`    TV Device ID: ${tvDeviceId}`);
console.log(`    TV Implantation ID: ${tvImplantId}`);
console.log(`    checkCommand 시나리오 4개 실행 완료`);
console.log(`    감사 이력 ${entries.length}건 확인`);
