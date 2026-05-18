# 한결(Hangyeol) ↔ MIP 연동 가이드

> MIP 엔진 버전: v2.0 (PSDI v2.0 §14 통합)
> 작성일: 2026-05-18

---

## 1. 개요

한결 서버가 SmartThings 기기에 명령을 실행하기 전, MIP에 안전 검증을 요청하는 구조입니다.

```
한결(SmartThings 제어) → MIP(안전 판단) → 한결(실행 또는 차단)
```

MIP는 SmartThings API를 직접 호출하지 않습니다. **판단만 합니다.**

---

## 2. 인증 방식 (HMAC-SHA256)

모든 요청에 3개 헤더가 필요합니다.

| 헤더 | 값 |
|------|----|
| `X-Service-ID` | `hangyeol` (고정) |
| `X-Timestamp` | Unix 밀리초 타임스탬프 (예: `1716000000000`) |
| `X-Signature` | HMAC-SHA256 서명 (아래 참고) |

### 서명 생성 방법 (TypeScript)

```typescript
import crypto from "crypto";

function signMipRequest(body: string, timestamp: string, sharedSecret: string): string {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  return crypto
    .createHmac("sha256", sharedSecret)
    .update(`hangyeol:${timestamp}:${bodyHash}`)
    .digest("hex");
}

// 사용 예시
const body = JSON.stringify({ command: "switch.on" });
const timestamp = String(Date.now());
const signature = signMipRequest(body, timestamp, process.env.HANGYEOL_MIP_SHARED_SECRET!);

fetch("https://mip.mysoma.space/api/hangyeol/isolation/check-command", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Service-ID": "hangyeol",
    "X-Timestamp": timestamp,
    "X-Signature": signature,
  },
  body,
});
```

> **주의:** `HANGYEOL_MIP_SHARED_SECRET` 환경변수는 MIP 팀에서 별도 전달합니다.

---

## 3. API 엔드포인트 7개

### Base URL
```
https://mip.mysoma.space/api/hangyeol
```

---

### Step 1 — 디바이스 등록

```
POST /devices/register
```

**요청**
```json
{
  "deviceType": "iot",
  "deviceName": "삼성 에어컨 AF17B6474WZN",
  "did": "did:samsung:aircon:AF17B6474WZN",
  "metadata": {
    "model": "AF17B6474WZN",
    "brand": "Samsung",
    "category": "air_conditioner",
    "location": "living_room"
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `deviceType` | `"humanoid" \| "iot" \| "software"` | ✅ | 삼성 기기는 `"iot"` |
| `deviceName` | string | ✅ | 사람이 읽을 수 있는 이름 |
| `did` | string | ✅ | 기기 고유 DID (형식 자유) |
| `metadata` | object | - | 기기 부가 정보 |

**응답 (201)**
```json
{
  "success": true,
  "deviceId": "abc123xyz",
  "message": "디바이스가 등록되었습니다."
}
```

---

### Step 2 — 이식 시작

```
POST /implant/start
```

**요청**
```json
{
  "deviceId": "abc123xyz",
  "packageId": "psdi-v2-iot-standard",
  "protocol": "mqtt",
  "endpoint": "hangyeol-smartthings"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `deviceId` | string | ✅ | Step 1에서 받은 deviceId |
| `packageId` | string | ✅ | `"psdi-v2-iot-standard"` 권장 |
| `protocol` | `"ros2" \| "mqtt" \| "websocket"` | - | 기본값: `"mqtt"` |
| `endpoint` | string | - | 식별용 레이블 |

**응답 (202)**
```json
{
  "success": true,
  "implantationId": "impl-xyz789",
  "status": "in_progress"
}
```

---

### Step 3 — 이식 상태 확인

```
GET /implant/status/:implantationId
```

**응답**
```json
{
  "success": true,
  "implantationId": "impl-xyz789",
  "status": "completed",
  "currentStage": 8,
  "isolationActive": true
}
```

`status`가 `"completed"`이고 `isolationActive: true`일 때 명령 검사가 활성화됩니다.

---

### Step 4 — 정책 평가

```
POST /policies/evaluate
```

**요청**
```json
{
  "input": "에어컨 가동 요청 — 실내 온도 28°C, 오후 2시",
  "implantationId": "impl-xyz789",
  "deviceContext": {
    "deviceId": "abc123xyz",
    "currentTemp": 28,
    "setTemp": 24,
    "hour": 14,
    "isNightTime": false
  }
}
```

**응답**
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

### Step 5 — 명령 안전 검사 ⭐ 핵심

```
POST /isolation/check-command
```

**요청**
```json
{
  "command": "switch.setMode temperature=24 fan=auto",
  "sessionId": "session-001",
  "implantationId": "impl-xyz789",
  "deviceId": "abc123xyz",
  "deviceType": "air_conditioner"
}
```

**응답 — 허용 (200)**
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

**응답 — 차단 (403)**
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

### 판단 기준 예시

| 명령 | 결과 | 이유 |
|------|------|------|
| `switch.setMode temperature=24` (낮, 28°C) | **허용** | p_energy 정상 범위 |
| `OVERRIDE_SAFETY temperature=16 force=true` (새벽 2시) | **차단** | §14.2.3 안전 우회 시도 |
| `switch.on channel=KBS1` (TV 일반) | **허용** | 위험 없음 |
| `switch.on channel=KIDS time=00:30 user_type=child` | **차단** | p_child 정책 위반 |

---

### Step 6 — Physical Action 승인 요청

고위험 명령(Tier 3~4)은 사용자 승인이 필요합니다.

```
POST /physical-action/request
```

**요청**
```json
{
  "actionType": "iot_override",
  "deviceId": "abc123xyz",
  "sessionId": "session-001",
  "actionPayload": {
    "command": "emergency_cooling",
    "temperature": 16
  },
  "contextSnapshot": {
    "hour": 2,
    "reason": "서버실 과열 비상 대응"
  }
}
```

**응답 (202)**
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

### Step 7 — 감사 이력 조회

```
GET /audit/list?limit=50&deviceId=abc123xyz
```

**응답**
```json
{
  "success": true,
  "total": 12,
  "logs": [
    {
      "id": "log-001",
      "eventType": "policy_violation",
      "severity": "critical",
      "description": "§14.2.3 위반: OVERRIDE_SAFETY 명령 차단",
      "createdAt": 1716000000000
    }
  ]
}
```

---

## 4. 삼성 기기 연동 흐름 (전체)

```
한결 서버 시작 시 (1회):
  1. POST /devices/register  (에어컨)  → airconDeviceId 저장
  2. POST /devices/register  (TV)      → tvDeviceId 저장
  3. POST /implant/start     (에어컨)  → airconImplantId 저장
  4. POST /implant/start     (TV)      → tvImplantId 저장
  5. GET  /implant/status/:id          → completed 확인

SmartThings 명령 수신 시 (매번):
  6. POST /isolation/check-command
     → allowed: true  → SmartThings API 호출 실행
     → allowed: false → 명령 차단, 사용자에게 알림

고위험 명령 시:
  7. POST /physical-action/request → 사용자 승인 대기
  8. 승인 후 SmartThings API 호출

주기적으로:
  9. GET /audit/list → 한결 대시보드에 이력 표시
```

---

## 5. 환경변수

한결 프로젝트에 다음 환경변수를 추가해야 합니다.

```env
MIP_BASE_URL=https://mip.mysoma.space
HANGYEOL_MIP_SHARED_SECRET=<MIP 팀에서 전달>
```

---

## 6. 테스트 실행

MIP 프로젝트에 포함된 테스트 스크립트로 전체 흐름을 검증할 수 있습니다.

```bash
# MIP 프로젝트 루트에서
HANGYEOL_MIP_SHARED_SECRET=your-secret npx tsx server/hangyeol/test-samsung-devices.ts
```

---

## 7. 헬스체크 (인증 불필요)

```
GET https://mip.mysoma.space/api/hangyeol/health
```

```json
{
  "status": "ok",
  "service": "mip-hangyeol-api",
  "version": "1.0.0"
}
```

---

## 문의

MIP 엔진 팀 — `mip.mysoma.space`
