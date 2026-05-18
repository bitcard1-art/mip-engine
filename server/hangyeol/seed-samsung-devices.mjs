/**
 * 삼성 에어컨(AF17B6474WZN) + TV(KQ65QC88AF) MIP 등록 시드 스크립트
 * 실행: node server/hangyeol/seed-samsung-devices.mjs
 *
 * 로컬 MIP 서버(localhost:3000)에 HMAC 없이 직접 tRPC로 등록합니다.
 * (서버 사이드 직접 호출 — 배포 전 테스트용)
 */

const BASE = "http://localhost:3000";

// ─── tRPC 직접 호출 헬퍼 ─────────────────────────────────────────────────────
async function trpc(procedure, input) {
  const url = `${BASE}/api/trpc/${procedure}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (json.error) throw new Error(`tRPC ${procedure} 오류: ${JSON.stringify(json.error)}`);
  return json.result?.data ?? json;
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 삼성 디바이스 MIP 등록 시작\n");

  // ── 1. 에어컨 등록 ──────────────────────────────────────────────────────────
  console.log("📱 [1/4] 삼성 에어컨 AF17B6474WZN 등록...");
  const aircon = await trpc("mip.devices.register", {
    deviceType: "iot",
    deviceName: "삼성 에어컨 AF17B6474WZN",
    did: `did:samsung:aircon:AF17B6474WZN:${Date.now()}`,
    metadata: JSON.stringify({
      model: "AF17B6474WZN",
      brand: "Samsung",
      category: "air_conditioner",
      location: "living_room",
      registeredBy: "hangyeol-test",
    }),
  });
  const airconDeviceId = aircon.id ?? aircon.deviceId;
  console.log(`  ✅ 에어컨 등록 완료 — deviceId: ${airconDeviceId}\n`);

  // ── 2. TV 등록 ──────────────────────────────────────────────────────────────
  console.log("📺 [2/4] 삼성 TV KQ65QC88AF 등록...");
  const tv = await trpc("mip.devices.register", {
    deviceType: "iot",
    deviceName: "삼성 TV KQ65QC88AF",
    did: `did:samsung:tv:KQ65QC88AF:${Date.now()}`,
    metadata: JSON.stringify({
      model: "KQ65QC88AF",
      brand: "Samsung",
      category: "television",
      location: "living_room",
      registeredBy: "hangyeol-test",
    }),
  });
  const tvDeviceId = tv.id ?? tv.deviceId;
  console.log(`  ✅ TV 등록 완료 — deviceId: ${tvDeviceId}\n`);

  // ── 3. 에어컨 이식 시작 ─────────────────────────────────────────────────────
  console.log("🔧 [3/4] 에어컨 PSDI v2.0 이식 시작...");
  const airconImplant = await trpc("mip.implant.start", {
    deviceId: airconDeviceId,
    packageId: "psdi-v2-iot-standard",
    protocol: "mqtt",
    endpoint: "hangyeol-smartthings",
  });
  const airconImplantId = airconImplant.id ?? airconImplant.implantationId;
  console.log(`  ✅ 에어컨 이식 시작 — implantationId: ${airconImplantId}\n`);

  // ── 4. TV 이식 시작 ─────────────────────────────────────────────────────────
  console.log("🔧 [4/4] TV PSDI v2.0 이식 시작...");
  const tvImplant = await trpc("mip.implant.start", {
    deviceId: tvDeviceId,
    packageId: "psdi-v2-iot-standard",
    protocol: "mqtt",
    endpoint: "hangyeol-smartthings",
  });
  const tvImplantId = tvImplant.id ?? tvImplant.implantationId;
  console.log(`  ✅ TV 이식 시작 — implantationId: ${tvImplantId}\n`);

  // ── 결과 요약 ───────────────────────────────────────────────────────────────
  console.log("═".repeat(60));
  console.log("📋 등록 결과 요약");
  console.log("─".repeat(60));
  console.log(`에어컨 (AF17B6474WZN)`);
  console.log(`  deviceId:       ${airconDeviceId}`);
  console.log(`  implantationId: ${airconImplantId}`);
  console.log();
  console.log(`TV (KQ65QC88AF)`);
  console.log(`  deviceId:       ${tvDeviceId}`);
  console.log(`  implantationId: ${tvImplantId}`);
  console.log("═".repeat(60));
  console.log("\n✅ 삼성 디바이스 MIP 등록 완료.");
  console.log("   MIP 대시보드 → 디바이스 관리에서 확인하세요.");

  return { airconDeviceId, airconImplantId, tvDeviceId, tvImplantId };
}

main().catch(err => {
  console.error("❌ 등록 실패:", err.message);
  process.exit(1);
});
