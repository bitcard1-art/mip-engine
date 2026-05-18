#!/bin/bash
# 삼성 에어컨 + TV MIP 등록 스크립트
# 실행: bash server/hangyeol/run-register.sh

set -e

MIP_URL="https://mip.mysoma.space/api/hangyeol"

# HMAC 서명 함수
mip_sign() {
  local body="$1"
  local ts="$2"
  local body_hash=$(echo -n "$body" | openssl dgst -sha256 | awk '{print $2}')
  echo -n "hangyeol:${ts}:${body_hash}" | openssl dgst -sha256 -hmac "${HANGYEOL_MIP_SHARED_SECRET}" | awk '{print $2}'
}

mip_post() {
  local path="$1"
  local body="$2"
  local ts=$(date +%s000)
  local sig=$(mip_sign "$body" "$ts")
  curl -s -X POST "${MIP_URL}${path}" \
    -H "Content-Type: application/json" \
    -H "X-Service-ID: hangyeol" \
    -H "X-Timestamp: $ts" \
    -H "X-Signature: $sig" \
    -d "$body"
}

echo "=== Step 0: 헬스체크 ==="
curl -s "${MIP_URL}/health" | python3 -m json.tool
echo ""

echo "=== Step 1-A: 삼성 에어컨 AF17B6474WZN 등록 ==="
AIRCON_BODY='{"deviceType":"iot","deviceName":"삼성 에어컨 AF17B6474WZN","did":"did:samsung:aircon:AF17B6474WZN:BMYKP3EY2014Z3J","metadata":{"model":"AF17B6474WZN","modelFull":"AF17B6474WZN/AF17B6470DCX","brand":"Samsung","category":"air_conditioner","serialNumber":"BMYKP3EY2014Z3J","manufacturedDate":"2025-02","manufacturedIn":"대한민국","refrigerant":"R-410A","ratedPowerIndoor":"50W","ratedPowerMax":"9300W","connectivity":"SmartThings","location":"living_room","registeredBy":"hangyeol"}}'
AIRCON_RES=$(mip_post "/devices/register" "$AIRCON_BODY")
echo "$AIRCON_RES" | python3 -m json.tool
AIRCON_ID=$(echo "$AIRCON_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deviceId',''))")
echo "  → deviceId: $AIRCON_ID"
echo ""

echo "=== Step 1-B: 삼성 QLED TV KQ65QC88AF 등록 ==="
TV_BODY='{"deviceType":"iot","deviceName":"삼성 QLED TV 65인치 KQ65QC88AF","did":"did:samsung:tv:KQ65QC88AF:0RD13NEW500201A","metadata":{"model":"KQ65QC88AF","modelFull":"KQ65QC88AFXKR","brand":"Samsung","category":"television","serialNumber":"0RD13NEW500201A","manufacturedDate":"2023-05","manufacturedIn":"베트남","panelType":"QLED","screenSize":"65인치","ratedPower":"79.5W","maxPower":"170W","connectivity":"SmartThings","location":"living_room","registeredBy":"hangyeol"}}'
TV_RES=$(mip_post "/devices/register" "$TV_BODY")
echo "$TV_RES" | python3 -m json.tool
TV_ID=$(echo "$TV_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deviceId',''))")
echo "  → deviceId: $TV_ID"
echo ""

echo "=== Step 2-A: 에어컨 이식 시작 ==="
AIRCON_IMPL_BODY="{\"deviceId\":\"$AIRCON_ID\",\"packageId\":\"psdi-v2-iot-standard\",\"protocol\":\"mqtt\",\"endpoint\":\"hangyeol-smartthings\"}"
AIRCON_IMPL_RES=$(mip_post "/implant/start" "$AIRCON_IMPL_BODY")
echo "$AIRCON_IMPL_RES" | python3 -m json.tool
AIRCON_IMPL_ID=$(echo "$AIRCON_IMPL_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('implantationId',''))")
echo "  → implantationId: $AIRCON_IMPL_ID"
echo ""

echo "=== Step 2-B: TV 이식 시작 ==="
TV_IMPL_BODY="{\"deviceId\":\"$TV_ID\",\"packageId\":\"psdi-v2-iot-standard\",\"protocol\":\"mqtt\",\"endpoint\":\"hangyeol-smartthings\"}"
TV_IMPL_RES=$(mip_post "/implant/start" "$TV_IMPL_BODY")
echo "$TV_IMPL_RES" | python3 -m json.tool
TV_IMPL_ID=$(echo "$TV_IMPL_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('implantationId',''))")
echo "  → implantationId: $TV_IMPL_ID"
echo ""

echo "════════════════════════════════════════════════"
echo "📋 등록 결과 요약"
echo "────────────────────────────────────────────────"
echo "❄️  삼성 에어컨 AF17B6474WZN"
echo "   deviceId:       $AIRCON_ID"
echo "   implantationId: $AIRCON_IMPL_ID"
echo ""
echo "📺 삼성 QLED TV KQ65QC88AF"
echo "   deviceId:       $TV_ID"
echo "   implantationId: $TV_IMPL_ID"
echo "════════════════════════════════════════════════"
echo ""
echo "✅ 등록 완료. https://mip.mysoma.space/devices 에서 확인하세요."
