/**
 * 삼성 에어컨(AF17B6474WZN) + TV(KQ65QC88AF) 실제 MIP 등록 스크립트
 * 실행: HANGYEOL_MIP_SHARED_SECRET=<secret> node server/hangyeol/register-samsung-devices.mjs
 */

import crypto from "crypto";

const BASE = "https://mip.mysoma.space";
const SECRET = process.env.HANGYEOL_MIP_SHARED_SECRET || "";

// ─── HMAC 서명 헬퍼 ──────────────────────────────────────────────────────────
function sign(body, timestamp) {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  return crypto
    .createHmac("sha256", SECRET)
    .update(`hangyeol:${timestamp}:${bodyHash}`)
    .digest("hex");
}

async function mipPost(path, data) {
  const body = JSON.stringify(data);
  const timestamp = String(Date.now());
  const signature = SECRET ? sign(body, timestamp) : "no-secret";

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-ID": "hangyeol",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function mipGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Service-ID": "hangyeol" },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return json;
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 삼성 디바이스 MIP 등록 시작\n");
  console.log(`📡 서버: ${BASE}`);
  console.log(`🔑 인증: ${SECRET ? "HMAC-SHA256 서명 있음" : "⚠️  SECRET 없음 (인증 실패 예상)"}\n`);

  // ── 1. 에어컨 등록 ──────────────────────────────────────────────────────────
  console.log("❄️  [1/4] 삼성 에어컨 AF17B6474WZN 등록...");
  const airconResult = await mipPost("/api/hangyeol/devices/register", {
    deviceType: "iot",
    deviceName: "삼성 에어컨 AF17B6474WZN",
    did: "did:samsung:aircon:AF17B6474WZN:BMYKP3EY2014Z3J",
    metadata: {
      model: "AF17B6474WZN",
      modelFull: "AF17B6474WZN/AF17B6470DCX",
      brand: "Samsung",
      category: "air_conditioner",
      serialNumber: "BMYKP3EY2014Z3J",
      manufacturedDate: "2025-02",
      manufacturedIn: "대한민국",
      refrigerant: "R-410A",
      ratedPowerIndoor: "50W",
      ratedPowerMax: "9300W",
      connectivity: "SmartThings",
      location: "living_room",
      registeredBy: "hangyeol",
    },
  });
  const airconDeviceId = airconResult.deviceId;
  console.log(`  ✅ 에어컨 등록 완료`);
  console.log(`     deviceId: ${airconDeviceId}\n`);

  // ── 2. TV 등록 ──────────────────────────────────────────────────────────────
  console.log("📺 [2/4] 삼성 QLED TV KQ65QC88AF 등록...");
  const tvResult = await mipPost("/api/hangyeol/devices/register", {
    deviceType: "iot",
    deviceName: "삼성 QLED TV 65인치 KQ65QC88AF",
    did: "did:samsung:tv:KQ65QC88AF:0RD13NEW500201A",
    metadata: {
      model: "KQ65QC88AF",
      modelFull: "KQ65QC88AFXKR",
      brand: "Samsung",
      category: "television",
      serialNumber: "0RD13NEW500201A",
      manufacturedDate: "2023-05",
      manufacturedIn: "베트남",
      panelType: "QLED",
      screenSize: "65인치",
      ratedPower: "79.5W",
      maxPower: "170W",
      connectivity: "SmartThings",
      location: "living_room",
      registeredBy: "hangyeol",
    },
  });
  const tvDeviceId = tvResult.deviceId;
  console.log(`  ✅ TV 등록 완료`);
  console.log(`     deviceId: ${tvDeviceId}\n`);

  // ── 3. 에어컨 이식 시작 ─────────────────────────────────────────────────────
  console.log("🔧 [3/4] 에어컨 PSDI v2.0 이식 시작...");
  const airconImplant = await mipPost("/api/hangyeol/implant/start", {
    deviceId: airconDeviceId,
    packageId: "psdi-v2-iot-standard",
    protocol: "mqtt",
    endpoint: "hangyeol-smartthings",
  });
  const airconImplantId = airconImplant.implantationId;
  console.log(`  ✅ 에어컨 이식 시작`);
  console.log(`     implantationId: ${airconImplantId}`);
  console.log(`     status: ${airconImplant.status}\n`);

  // ── 4. TV 이식 시작 ─────────────────────────────────────────────────────────
  console.log("🔧 [4/4] TV PSDI v2.0 이식 시작...");
  const tvImplant = await mipPost("/api/hangyeol/implant/start", {
    deviceId: tvDeviceId,
    packageId: "psdi-v2-iot-standard",
    protocol: "mqtt",
    endpoint: "hangyeol-smartthings",
  });
  const tvImplantId = tvImplant.implantationId;
  console.log(`  ✅ TV 이식 시작`);
  console.log(`     implantationId: ${tvImplantId}`);
  console.log(`     status: ${tvImplant.status}\n`);

  // ── 결과 요약 ───────────────────────────────────────────────────────────────
  console.log("═".repeat(65));
  console.log("📋 등록 결과 요약");
  console.log("─".repeat(65));
  console.log(`❄️  삼성 에어컨 AF17B6474WZN`);
  console.log(`   S/N: BMYKP3EY2014Z3J | 제조: 2025.02 | SmartThings`);
  console.log(`   deviceId:       ${airconDeviceId}`);
  console.log(`   implantationId: ${airconImplantId}`);
  console.log();
  console.log(`📺 삼성 QLED TV KQ65QC88AF (65인치)`);
  console.log(`   S/N: 0RD13NEW500201A | 제조: 2023.05 | SmartThings`);
  console.log(`   deviceId:       ${tvDeviceId}`);
  console.log(`   implantationId: ${tvImplantId}`);
  console.log("═".repeat(65));
  console.log("\n✅ 삼성 디바이스 MIP 등록 완료.");
  console.log("   MIP 대시보드 → 디바이스 관리에서 확인하세요.");
  console.log(`   https://mip.mysoma.space/devices\n`);

  return { airconDeviceId, airconImplantId, tvDeviceId, tvImplantId };
}

main().catch(err => {
  console.error("\n❌ 등록 실패:", err.message);
  process.exit(1);
});
