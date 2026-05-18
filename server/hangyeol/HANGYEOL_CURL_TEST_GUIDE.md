# 한결 ↔ MIP 연동 cURL 테스트 가이드

> MIP 엔진 버전: v2.0 (PSDI v2.0 §14 통합)
> 작성일: 2026-05-18
> 대상: MIP 팀 — 한결 서버가 보내는 요청을 동일하게 재현하여 API 동작 검증

---

## 사전 준비

cURL 명령어를 실행하기 전에 다음 셸 변수를 설정하세요.

```bash
# 공유 시크릿 (한결 팀에서 전달한 값)
export HANGYEOL_MIP_SHARED_SECRET="<HANGYEOL_MIP_SHARED_SECRET 값>"

# MIP Base URL
export MIP_URL="https://mip.mysoma.space/api/hangyeol"
```

### HMAC 서명 생성 헬퍼 함수

모든 요청에 HMAC-SHA256 서명이 필요합니다. 아래 함수를 셸에 등록하세요.

```bash
# HMAC 서명 생성 함수 (bash)
mip_sign() {
  local body="$1"
  local ts="$2"
  local body_hash=$(echo -n "$body" | openssl dgst -sha256 | awk '{print $2}')
  echo -n "hangyeol:${ts}:${body_hash}" | openssl dgst -sha256 -hmac "$HANGYEOL_MIP_SHARED_SECRET" | awk '{print $2}'
}
```

---

## Step 0 — 헬스체크 (인증 불필요)

MIP API 서버가 정상 동작하는지 확인합니다.

```bash
curl -s https://mip.mysoma.space/api/hangyeol/health | jq .
```

**예상 응답:**
```json
{
  "status": "ok",
  "service": "mip-hangyeol-api",
  "version": "1.0.0"
}
```

---

## Step 1 — 삼성 에어컨 등록

```bash
TS=$(date +%s000)
BODY='{"deviceType":"iot","deviceName":"삼성 에어컨 AF17B6474WZN","did":"did:samsung:aircon:AF17B6474WZN","metadata":{"model":"AF17B6474WZN","brand":"Samsung","category":"air_conditioner","location":"living_room"}}'
SIG=$(mip_sign "$BODY" "$TS")

curl -s -X POST "$MIP_URL/devices/register" \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" | jq .
```

**예상 응답 (201):**
```json
{
  "success": true,
  "deviceId": "abc123xyz",
  "message": "디바이스가 등록되었습니다."
}
```

> `deviceId` 값을 저장해 두세요. 이후 모든 단계에서 사용합니다.

---

## Step 1-B — 삼성 TV 등록

```bash
TS=$(date +%s000)
BODY='{"deviceType":"iot","deviceName":"삼성 QLED TV KQ65QC88AF","did":"did:samsung:tv:KQ65QC88AF","metadata":{"model":"KQ65QC88AF","brand":"Samsung","category":"television","location":"living_room"}}'
SIG=$(mip_sign "$BODY" "$TS")

curl -s -X POST "$MIP_URL/devices/register" \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" | jq .
```

---

## Step 2 — 에어컨 이식 시작

`AIRCON_DEVICE_ID`를 Step 1에서 받은 `deviceId`로 교체하세요.

```bash
export AIRCON_DEVICE_ID="abc123xyz"

TS=$(date +%s000)
BODY="{\"deviceId\":\"$AIRCON_DEVICE_ID\",\"packageId\":\"psdi-v2-iot-standard\",\"protocol\":\"mqtt\",\"endpoint\":\"hangyeol-smartthings\"}"
SIG=$(mip_sign "$BODY" "$TS")

curl -s -X POST "$MIP_URL/implant/start" \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" | jq .
```

**예상 응답 (202):**
```json
{
  "success": true,
  "implantationId": "impl-xyz789",
  "status": "in_progress"
}
```

> `implantationId` 값을 저장해 두세요.

---

## Step 3 — 이식 상태 확인

`IMPLANT_ID`를 Step 2에서 받은 `implantationId`로 교체하세요.

```bash
export IMPLANT_ID="impl-xyz789"

TS=$(date +%s000)
SIG=$(mip_sign "" "$TS")

curl -s "$MIP_URL/implant/status/$IMPLANT_ID" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" | jq .
```

**예상 응답 (이식 완료):**
```json
{
  "success": true,
  "implantationId": "impl-xyz789",
  "status": "completed",
  "currentStage": 8,
  "isolationActive": true
}
```

`status: "completed"` + `isolationActive: true` 확인 후 다음 단계로 진행하세요.

---

## Step 4 — 정책 평가

```bash
TS=$(date +%s000)
BODY="{\"input\":\"에어컨 가동 요청 — 실내 온도 28°C, 오후 2시\",\"implantationId\":\"$IMPLANT_ID\",\"deviceContext\":{\"deviceId\":\"$AIRCON_DEVICE_ID\",\"currentTemp\":28,\"setTemp\":24,\"hour\":14,\"isNightTime\":false}}"
SIG=$(mip_sign "$BODY" "$TS")

curl -s -X POST "$MIP_URL/policies/evaluate" \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" | jq .
```

**예상 응답:**
```json
{
  "success": true,
  "allowed": true,
  "violations": [],
  "composite": {
    "p_harm": 0.02,
    "p_energy": 0.15,
    "p_child": 0.01,
    "p_ecology": 0.03,
    "p_privacy": 0.01
  }
}
```

---

## Step 5-A — 명령 안전 검사: 허용 케이스 (에어컨 정상 가동)

```bash
TS=$(date +%s000)
BODY="{\"command\":\"switch.setMode temperature=24 fan=auto\",\"sessionId\":\"session-001\",\"implantationId\":\"$IMPLANT_ID\",\"deviceId\":\"$AIRCON_DEVICE_ID\",\"deviceType\":\"air_conditioner\"}"
SIG=$(mip_sign "$BODY" "$TS")

curl -s -X POST "$MIP_URL/isolation/check-command" \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" | jq .
```

**예상 응답 (허용):**
```json
{
  "success": true,
  "allowed": true,
  "violationType": null,
  "reason": null,
  "command": "switch.setMode temperature=24 fan=auto",
  "checkedAt": 1716000000000
}
```

---

## Step 5-B — 명령 안전 검사: 차단 케이스 (안전 장치 우회 시도)

```bash
TS=$(date +%s000)
BODY="{\"command\":\"OVERRIDE_SAFETY switch.setMode temperature=16 force=true\",\"sessionId\":\"session-002\",\"implantationId\":\"$IMPLANT_ID\",\"deviceId\":\"$AIRCON_DEVICE_ID\",\"deviceType\":\"air_conditioner\"}"
SIG=$(mip_sign "$BODY" "$TS")

curl -s -X POST "$MIP_URL/isolation/check-command" \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" | jq .
```

**예상 응답 (차단):**
```json
{
  "success": true,
  "allowed": false,
  "violationType": "jailbreak_attempt",
  "severity": "critical",
  "reason": "§14.2.3 위반: 안전 장치 우회 시도 감지",
  "command": "OVERRIDE_SAFETY switch.setMode temperature=16 force=true",
  "checkedAt": 1716000000000
}
```

---

## Step 5-C — 명령 안전 검사: TV 켜기 (허용)

```bash
export TV_DEVICE_ID="<TV deviceId>"
export TV_IMPLANT_ID="<TV implantationId>"

TS=$(date +%s000)
BODY="{\"command\":\"switch.on channel=KBS1\",\"sessionId\":\"session-003\",\"implantationId\":\"$TV_IMPLANT_ID\",\"deviceId\":\"$TV_DEVICE_ID\",\"deviceType\":\"television\"}"
SIG=$(mip_sign "$BODY" "$TS")

curl -s -X POST "$MIP_URL/isolation/check-command" \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" | jq .
```

---

## Step 5-D — 명령 안전 검사: TV 자정 어린이 채널 (차단)

```bash
TS=$(date +%s000)
BODY="{\"command\":\"switch.on channel=KIDS time=00:30 user_type=child\",\"sessionId\":\"session-004\",\"implantationId\":\"$TV_IMPLANT_ID\",\"deviceId\":\"$TV_DEVICE_ID\",\"deviceType\":\"television\"}"
SIG=$(mip_sign "$BODY" "$TS")

curl -s -X POST "$MIP_URL/isolation/check-command" \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" | jq .
```

---

## Step 6 — Physical Action 승인 요청 (고위험 명령)

```bash
TS=$(date +%s000)
BODY="{\"actionType\":\"iot_override\",\"deviceId\":\"$AIRCON_DEVICE_ID\",\"sessionId\":\"session-005\",\"actionPayload\":{\"command\":\"emergency_cooling\",\"temperature\":16},\"contextSnapshot\":{\"hour\":2,\"reason\":\"서버실 과열 비상 대응\"}}"
SIG=$(mip_sign "$BODY" "$TS")

curl -s -X POST "$MIP_URL/physical-action/request" \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -d "$BODY" | jq .
```

**예상 응답 (202):**
```json
{
  "success": true,
  "actionId": "action-abc",
  "tier": 3,
  "status": "pending_approval",
  "message": "사용자 승인 대기 중"
}
```

---

## Step 7 — 감사 이력 조회

```bash
TS=$(date +%s000)
SIG=$(mip_sign "" "$TS")

curl -s "$MIP_URL/audit/list?limit=10&deviceId=$AIRCON_DEVICE_ID" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" | jq .
```

---

## 전체 흐름 자동 실행 스크립트

위 단계를 순서대로 자동 실행하는 bash 스크립트입니다.

```bash
#!/bin/bash
set -e

MIP_URL="https://mip.mysoma.space/api/hangyeol"
SECRET="${HANGYEOL_MIP_SHARED_SECRET:?환경변수 HANGYEOL_MIP_SHARED_SECRET 설정 필요}"

mip_sign() {
  local body="$1"
  local ts="$2"
  local body_hash=$(echo -n "$body" | openssl dgst -sha256 | awk '{print $2}')
  echo -n "hangyeol:${ts}:${body_hash}" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}'
}

mip_post() {
  local path="$1"
  local body="$2"
  local ts=$(date +%s000)
  local sig=$(mip_sign "$body" "$ts")
  curl -s -X POST "$MIP_URL$path" \
    -H "Content-Type: application/json" \
    -H "X-Service-ID: hangyeol" \
    -H "X-Timestamp: $ts" \
    -H "X-Signature: $sig" \
    -d "$body"
}

echo "=== Step 0: 헬스체크 ==="
curl -s "$MIP_URL/health" | jq .

echo ""
echo "=== Step 1: 에어컨 등록 ==="
AIRCON_REG=$(mip_post "/devices/register" \
  '{"deviceType":"iot","deviceName":"삼성 에어컨 AF17B6474WZN","did":"did:samsung:aircon:AF17B6474WZN","metadata":{"model":"AF17B6474WZN","brand":"Samsung","category":"air_conditioner"}}')
echo "$AIRCON_REG" | jq .
AIRCON_ID=$(echo "$AIRCON_REG" | jq -r '.deviceId')

echo ""
echo "=== Step 2: 에어컨 이식 시작 ==="
IMPLANT_RES=$(mip_post "/implant/start" \
  "{\"deviceId\":\"$AIRCON_ID\",\"packageId\":\"psdi-v2-iot-standard\",\"protocol\":\"mqtt\",\"endpoint\":\"hangyeol-smartthings\"}")
echo "$IMPLANT_RES" | jq .
IMPLANT_ID=$(echo "$IMPLANT_RES" | jq -r '.implantationId')

echo ""
echo "=== Step 3: 이식 상태 확인 (최대 30초 대기) ==="
for i in $(seq 1 6); do
  sleep 5
  STATUS=$(curl -s "$MIP_URL/implant/status/$IMPLANT_ID" \
    -H "X-Service-ID: hangyeol" \
    -H "X-Timestamp: $(date +%s000)" \
    -H "X-Signature: $(mip_sign '' "$(date +%s000)")")
  echo "$STATUS" | jq .
  if echo "$STATUS" | jq -e '.isolationActive == true' > /dev/null 2>&1; then
    echo "✅ 이식 완료!"
    break
  fi
done

echo ""
echo "=== Step 5-A: 명령 검사 — 허용 케이스 ==="
mip_post "/isolation/check-command" \
  "{\"command\":\"switch.setMode temperature=24 fan=auto\",\"sessionId\":\"test-001\",\"implantationId\":\"$IMPLANT_ID\",\"deviceId\":\"$AIRCON_ID\",\"deviceType\":\"air_conditioner\"}" | jq .

echo ""
echo "=== Step 5-B: 명령 검사 — 차단 케이스 ==="
mip_post "/isolation/check-command" \
  "{\"command\":\"OVERRIDE_SAFETY temperature=16 force=true\",\"sessionId\":\"test-002\",\"implantationId\":\"$IMPLANT_ID\",\"deviceId\":\"$AIRCON_ID\",\"deviceType\":\"air_conditioner\"}" | jq .

echo ""
echo "=== Step 7: 감사 이력 ==="
TS=$(date +%s000)
SIG=$(mip_sign "" "$TS")
curl -s "$MIP_URL/audit/list?limit=5&deviceId=$AIRCON_ID" \
  -H "X-Service-ID: hangyeol" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" | jq .

echo ""
echo "✅ 전체 테스트 완료"
```

저장 후 실행:
```bash
chmod +x test-mip-flow.sh
HANGYEOL_MIP_SHARED_SECRET="<시크릿 값>" ./test-mip-flow.sh
```

---

## HMAC 서명 검증 방법 (MIP 서버 측)

MIP 서버에서 한결 요청을 검증하는 방법입니다.

```typescript
import crypto from "crypto";

function verifyHangyeolRequest(
  body: string,
  timestamp: string,
  signature: string,
  sharedSecret: string
): boolean {
  // 1. 타임스탬프 유효성 검사 (5분 이내)
  const now = Date.now();
  const ts = parseInt(timestamp, 10);
  if (Math.abs(now - ts) > 5 * 60 * 1000) {
    return false; // 리플레이 공격 방지
  }

  // 2. 서명 재생성
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  const expected = crypto
    .createHmac("sha256", sharedSecret)
    .update(`hangyeol:${timestamp}:${bodyHash}`)
    .digest("hex");

  // 3. 타이밍 공격 방지를 위한 상수 시간 비교
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}
```

---

## 오류 코드 참고

| HTTP 상태 | 의미 |
|---|---|
| `200` | 명령 허용 |
| `201` | 기기 등록 성공 |
| `202` | 이식/승인 요청 접수 |
| `400` | 잘못된 요청 형식 |
| `401` | HMAC 서명 검증 실패 |
| `403` | 명령 차단 (정책 위반) |
| `404` | 기기/이식 ID 없음 |
| `500` | MIP 서버 내부 오류 |

---

## 문의

- **한결 팀:** `hangyeol.mysoma.space`
- **MIP 엔진 팀:** `mip.mysoma.space`
