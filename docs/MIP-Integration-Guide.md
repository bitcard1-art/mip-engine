# MIP Integration Guide

**MIO Implantation Protocol — 외부 서비스 연동 가이드**

| 항목 | 내용 |
|------|------|
| 문서 버전 | 1.0.0 |
| 최종 수정 | 2026-05-22 |
| 대상 독자 | 휴머노이드 팀, SOMA 연동 개발자 |
| 기준 표준 | PSDI v2.0 §14 Runtime Isolation Layer |

---

## 1. 개요

MIP(MIO Implantation Protocol) 엔진은 사용자의 디지털 자아(MIO)를 휴머노이드 로봇, IoT 디바이스, 소프트웨어 런타임에 안전하게 이식하는 핵심 인프라입니다. MIP는 LORE(MIO 패키지 생성 서비스)로부터 패키지를 수신하고, SOMA(이식 승인 게이트웨이)와 협력하여 8단계 이식 프로세스를 실행합니다.

### 1.1 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOMA Gateway                              │
│            (이식 승인 · 디바이스 관리 · Kill Switch)              │
└────────────────────────────┬────────────────────────────────────┘
                             │ HMAC-SHA256
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         MIP Engine                                │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Package  │ │   Ethical    │ │ Sandbox  │ │   Runtime     │  │
│  │ Receiver │ │  Boundary    │ │Validator │ │  Connector    │  │
│  └──────────┘ └──────────────┘ └──────────┘ └───────────────┘  │
│                         ▲                           │            │
│                         │                           ▼            │
│  ┌──────────────────────┴───────────────────────────────────┐   │
│  │              8-Stage Implantation Engine                   │   │
│  └───────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HMAC-SHA256
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                          LORE                                    │
│              (MIO DNA 생성 · 패키지 관리)                        │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               Target Device (Humanoid / IoT / SW)                │
│         ROS2 · MQTT · WebSocket · Webhook 프로토콜               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 MIP Base URL

| 환경 | URL |
|------|-----|
| Production | `https://mip.mysoma.space` |
| Development | `https://3000-i831je0vyfhhacaxtf0cx-1a66c708.sg1.manus.computer` |

---

## 2. 인증 (HMAC-SHA256)

MIP의 모든 서비스 간 통신은 HMAC-SHA256 서명으로 보호됩니다. Replay Attack 방지를 위해 ±5분 시간 윈도우를 적용합니다.

### 2.1 인증 헤더

| 헤더 | 설명 | 예시 |
|------|------|------|
| `X-Service-ID` | 요청 발신 서비스 식별자 | `soma`, `lore`, `mip` |
| `X-Timestamp` | 요청 시각 (Unix 밀리초) | `1716350400000` |
| `X-Signature` | HMAC-SHA256 서명 (hex) | `a1b2c3d4...` |

### 2.2 서명 생성 알고리즘

서명 메시지 형식:

```
message = "{serviceId}:{timestamp}:{bodyHash}"
```

여기서:
- `serviceId`: 요청을 보내는 서비스의 ID (예: `soma`, `lore`, `mip`)
- `timestamp`: Unix 밀리초 타임스탬프 (문자열)
- `bodyHash`: 요청 본문의 SHA-256 해시 (hex)

서명 계산:

```
bodyHash   = SHA256(requestBodyString)
message    = "{serviceId}:{timestamp}:{bodyHash}"
signature  = HMAC-SHA256(sharedSecret, message)
```

### 2.3 공유 비밀키 (Shared Secret) 방향

| 통신 방향 | Service ID | 사용하는 Shared Secret |
|-----------|-----------|----------------------|
| SOMA → MIP | `soma` | `SOMA_MIP_SHARED_SECRET` |
| MIP → SOMA | `mip` | `MIP_SOMA_SHARED_SECRET` |
| LORE → MIP | `lore` | `LORE_MIP_SHARED_SECRET` |
| MIP → LORE | `mip` | `MIP_LORE_SHARED_SECRET` |

### 2.4 Replay Attack 방지

MIP는 수신한 요청의 `X-Timestamp`와 현재 서버 시각을 비교하여, **±5분(300,000ms)**을 초과하는 요청을 거부합니다. 서버 간 시각 동기화(NTP)를 반드시 유지해야 합니다.

### 2.5 코드 예제 — Node.js (TypeScript)

```typescript
import crypto from "crypto";

function generateHmacSignature(
  serviceId: string,
  body: string,
  sharedSecret: string
): { timestamp: string; signature: string } {
  const timestamp = Date.now().toString();
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  const message = `${serviceId}:${timestamp}:${bodyHash}`;
  const signature = crypto
    .createHmac("sha256", sharedSecret)
    .update(message)
    .digest("hex");
  return { timestamp, signature };
}

// 사용 예시: SOMA → MIP 요청 전송
async function callMipEndpoint(path: string, payload: object) {
  const body = JSON.stringify(payload);
  const { timestamp, signature } = generateHmacSignature(
    "soma",                          // 발신 서비스 ID
    body,
    process.env.SOMA_MIP_SHARED_SECRET!  // SOMA가 보관하는 공유 비밀키
  );

  const response = await fetch(`https://mip.mysoma.space${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-ID": "soma",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body,
  });

  return response.json();
}
```

### 2.6 코드 예제 — Python

```python
import hashlib
import hmac
import json
import time
import requests

def generate_hmac_signature(service_id: str, body: str, shared_secret: str):
    timestamp = str(int(time.time() * 1000))
    body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
    message = f"{service_id}:{timestamp}:{body_hash}"
    signature = hmac.new(
        shared_secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return timestamp, signature

# 사용 예시: SOMA → MIP 이식 승인 전송
def send_implant_approved(payload: dict):
    body = json.dumps(payload, separators=(",", ":"))
    timestamp, signature = generate_hmac_signature(
        "soma",
        body,
        SOMA_MIP_SHARED_SECRET
    )
    response = requests.post(
        "https://mip.mysoma.space/api/soma/webhook/implant-approved",
        headers={
            "Content-Type": "application/json",
            "X-Service-ID": "soma",
            "X-Timestamp": timestamp,
            "X-Signature": signature,
        },
        data=body,
    )
    return response.json()
```

### 2.7 인증 실패 응답

| HTTP Status | Error Code | 설명 |
|-------------|-----------|------|
| 401 | `MISSING_AUTH_HEADERS` | 필수 헤더(X-Service-ID, X-Timestamp, X-Signature) 누락 |
| 401 | `TIMESTAMP_EXPIRED` | 요청 시각이 ±5분 범위 초과 |
| 401 | `INVALID_SIGNATURE` | HMAC 서명 검증 실패 |

---

## 3. MIP가 제공하는 API (SOMA/외부 서비스 → MIP)

아래 엔드포인트는 MIP가 수신하는 API입니다. 외부 서비스(SOMA, 휴머노이드 제어 시스템 등)에서 이 엔드포인트를 호출합니다.

### 3.1 이식 승인 이벤트 수신

SOMA가 사용자의 이식 요청을 승인한 후, MIP에 이식 프로세스 시작을 알립니다.

```
POST /api/soma/webhook/implant-approved
```

**요청 본문:**

```json
{
  "eventId": "evt_abc123",
  "eventType": "mip_implant_approved",
  "userId": "user_openid_12345",
  "deviceId": "dev_humanoid_001",
  "packageId": "pkg_mio_20260522",
  "approvedAt": 1716350400000,
  "metadata": {
    "approver": "soma_gateway",
    "priority": "normal"
  }
}
```

**필수 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `eventId` | string | 이벤트 고유 ID (멱등성 키) |
| `userId` | string | 사용자 OpenID |
| `deviceId` | string | 대상 디바이스 ID |
| `packageId` | string | MIO 패키지 ID |

**응답:**

| Status | Body | 설명 |
|--------|------|------|
| 202 | `{ "status": "accepted", "implantationId": "..." }` | 이식 프로세스 시작됨 |
| 200 | `{ "status": "already_processed" }` | 이미 처리된 이벤트 (멱등) |
| 400 | `{ "status": "rejected", "code": "MISSING_FIELDS" }` | 필수 필드 누락 |

---

### 3.2 디바이스 등록

새로운 디바이스를 MIP에 등록합니다.

```
POST /api/soma/devices/register
```

**요청 본문:**

```json
{
  "userId": "user_openid_12345",
  "did": "did:soma:humanoid:atlas-v2:001",
  "deviceType": "humanoid",
  "deviceName": "Atlas V2 - Living Room",
  "manufacturer": "Boston Dynamics",
  "model": "Atlas V2",
  "firmwareVersion": "3.2.1",
  "capabilities": ["ros2", "mqtt", "websocket"],
  "metadata": {
    "location": "home_living_room",
    "serialNumber": "BD-ATL2-2026-001"
  }
}
```

**필수 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `userId` | string | 소유자 OpenID |
| `did` | string | 디바이스 DID (Decentralized Identifier) |
| `deviceType` | string | `humanoid` \| `iot` \| `software` |
| `deviceName` | string | 사용자 지정 디바이스 이름 |

**응답:**

| Status | Body | 설명 |
|--------|------|------|
| 201 | `{ "status": "registered", "deviceId": "..." }` | 신규 등록 완료 |
| 200 | `{ "status": "already_registered", "deviceId": "..." }` | 이미 등록된 디바이스 |
| 400 | `{ "error": "INVALID_DID" }` | DID 형식 오류 |

---

### 3.3 이식 상태 조회

진행 중이거나 완료된 이식 작업의 상태를 조회합니다.

```
GET /api/soma/implant/:implantationId/status
```

**추가 헤더:**

| 헤더 | 설명 |
|------|------|
| `X-User-ID` | (선택) 요청자 사용자 ID — 권한 검증용 |

**응답 예시:**

```json
{
  "implantationId": "impl_abc123",
  "currentStage": "sandbox_validation",
  "status": "in_progress",
  "progress": 85,
  "stageHistory": [
    { "stage": "device_registration", "status": "completed", "startedAt": 1716350400000, "completedAt": 1716350401000 },
    { "stage": "trust_verification", "status": "completed", "startedAt": 1716350401000, "completedAt": 1716350402000 }
  ],
  "isolationLayer": {
    "coreIdentityId": "ci_xyz789",
    "coreIdentityStatus": "active",
    "deploymentSecurityId": "ds_abc456",
    "securityLevel": "standard",
    "trustChainValid": true
  }
}
```

---

### 3.4 Kill Switch (긴급 세션 종료)

활성 이식 세션을 즉시 종료합니다. 안전 사고 발생 시 사용합니다.

```
POST /api/soma/sessions/:sessionId/kill
```

**요청 본문:**

```json
{
  "userId": "user_openid_12345",
  "reason": "safety_violation",
  "detail": "물리적 안전 한계 초과 감지"
}
```

**필수 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `userId` | string | 요청자 사용자 ID |
| `reason` | string | 종료 사유 |

**응답:**

```json
{
  "success": true,
  "message": "Emergency Kill Switch activated. Session impl_abc123 terminated. MIO protection mode engaged."
}
```

---

## 4. MIP가 호출하는 API (MIP → SOMA)

MIP는 이식 프로세스 진행 중 아래 이벤트를 SOMA 웹훅 엔드포인트로 전송합니다.

### 4.1 웹훅 수신 엔드포인트 (SOMA가 구현해야 함)

```
POST {SOMA_WEBHOOK_URL}/api/mip/webhook
```

MIP는 `SOMA_WEBHOOK_URL` 환경변수에 설정된 URL의 `/api/mip/webhook` 경로로 이벤트를 전송합니다.

### 4.2 이벤트 타입

#### 4.2.1 `mip_implant_progress` — 이식 단계별 진행 상태

```json
{
  "eventType": "mip_implant_progress",
  "implantationId": "impl_abc123",
  "userId": "user_openid_12345",
  "stage": "boundary_injection",
  "status": "completed",
  "progress": 55,
  "detail": "윤리적 경계 정책 5개 주입 완료",
  "timestamp": 1716350500000
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `stage` | string | 현재 단계 (§5 참조) |
| `status` | string | `completed` \| `failed` |
| `progress` | number | 0~100 진행률 |
| `detail` | string | 상세 설명 |
| `errorMessage` | string? | 실패 시 에러 메시지 |

#### 4.2.2 `mip_safety_alert` — 안전 이상 이벤트

```json
{
  "eventType": "mip_safety_alert",
  "sessionId": "sess_xyz789",
  "userId": "user_openid_12345",
  "deviceId": "dev_humanoid_001",
  "alertType": "physical_safety_exceeded",
  "severity": "critical",
  "detail": "모터 토크 제한 초과 감지 (좌측 팔)",
  "autoAction": "motor_torque_limited",
  "requiresUserAction": true,
  "timestamp": 1716351000000
}
```

**alertType 종류:**

| alertType | 설명 |
|-----------|------|
| `ethical_boundary_violation` | 윤리적 경계 위반 |
| `emotional_instability` | 감정 불안정 감지 |
| `physical_safety_exceeded` | 물리적 안전 한계 초과 |
| `unauthorized_learning` | 비인가 학습 시도 |
| `identity_integrity_breach` | 정체성 무결성 위반 |

**severity 수준:**

| severity | 설명 | 자동 조치 |
|----------|------|----------|
| `low` | 모니터링 수준 | 로깅만 |
| `medium` | 주의 필요 | 경고 + 제한적 조치 |
| `high` | 즉각 대응 필요 | 기능 제한 |
| `critical` | 긴급 | Kill Switch 고려 |

#### 4.2.3 `mip_live_activated` — Live Activation 완료

```json
{
  "eventType": "mip_live_activated",
  "implantationId": "impl_abc123",
  "sessionId": "sess_xyz789",
  "userId": "user_openid_12345",
  "deviceId": "dev_humanoid_001",
  "deviceName": "Atlas V2 - Living Room",
  "sandboxSummary": {
    "emotionalStabilityScore": 92,
    "behavioralStabilityScore": 88,
    "privacyProtectionScore": 95,
    "physicalSafetyScore": 97,
    "conflictResolutionScore": 85,
    "overallScore": 91
  },
  "activeBoundaryPolicies": ["p_harm", "p_child", "p_unsafe", "p_emotion"],
  "activatedAt": 1716351500000
}
```

#### 4.2.4 `mip_session_terminated` — 세션 종료

```json
{
  "eventType": "mip_session_terminated",
  "sessionId": "sess_xyz789",
  "userId": "user_openid_12345",
  "deviceId": "dev_humanoid_001",
  "terminationReason": "user_request",
  "sessionDurationMs": 3600000,
  "safetyIncidentCount": 0,
  "terminatedAt": 1716355100000
}
```

**terminationReason 종류:**

| reason | 설명 |
|--------|------|
| `user_request` | 사용자 요청 |
| `kill_switch` | Kill Switch 발동 |
| `safety_violation` | 안전 위반 |
| `ttl_expired` | 세션 TTL 만료 |
| `device_disconnected` | 디바이스 연결 끊김 |
| `system_error` | 시스템 오류 |

### 4.3 웹훅 수신 응답 규약

MIP는 웹훅 전송 후 응답을 확인합니다:

| 응답 Status | MIP 동작 |
|-------------|---------|
| 2xx | 전송 성공으로 처리 |
| 4xx | 재시도 없이 DLQ 저장 |
| 5xx | 최대 3회 재시도 (지수 백오프: 1초, 2초, 4초) |
| Timeout (15초) | 재시도 |

3회 모두 실패 시 DLQ(Dead Letter Queue)에 저장되며, 이후 배치 작업으로 최대 10회까지 재시도합니다.

---

## 5. 8단계 이식 프로세스

MIP의 이식 프로세스는 PSDI v2.0 §14에 따라 8단계로 구성됩니다. 각 단계는 순차적으로 실행되며, 실패 시 해당 단계에서 중단됩니다.

| # | Stage | Progress | 설명 | PSDI §14 매핑 |
|---|-------|----------|------|---------------|
| 1 | `device_registration` | 10% | 디바이스 등록 확인 | §14.2.4 No Surface Principle |
| 2 | `trust_verification` | 20% | 디바이스 신뢰 검증 | §14.2.4 비인가 접근 차단 |
| 3 | `user_authentication` | 30% | 사용자 인증 확인 | §14.2.3 조작 차단 |
| 4 | `package_generation` | 40% | MIO 패키지 생성/수신 확인 | §14.2.1 자아 보호 |
| 5 | `boundary_injection` | 55% | 윤리적 경계 정책 주입 | §14.2.3 Prompt Injection 방어 |
| 6 | `runtime_binding` | 70% | 런타임 연결 바인딩 | §14.4 Core Identity Layer |
| 7 | `sandbox_validation` | 85% | 시뮬레이션 샌드박스 검증 | §14.3 심리적 면역체계 |
| 8 | `live_activation` | 100% | 실제 런타임 활성화 | §14.6 Deployment 보안 |

### 5.1 단계별 상세

**Stage 1 — Device Registration (10%)**

디바이스가 MIP에 등록되어 있는지 확인합니다. 미등록 디바이스는 §3.2 API를 통해 사전 등록해야 합니다.

**Stage 2 — Trust Verification (20%)**

디바이스의 신뢰 상태를 검증합니다. 현재 정책:
- `active` 상태: 즉시 통과
- `pending` 상태: 경고 로깅 후 통과 (신규 디바이스 허용)
- `revoked` 상태: **차단** (이식 불가)

**Stage 3 — User Authentication (30%)**

요청 사용자의 인증 상태와 디바이스 소유권을 확인합니다.

**Stage 4 — Package Generation (40%)**

LORE에서 생성된 MIO 패키지가 MIP에 수신되었는지 확인합니다. 패키지가 없으면 LORE에 생성을 요청합니다.

**Stage 5 — Boundary Injection (55%)**

윤리적 경계 정책(Ethical Boundary Policy)을 MIO 런타임에 주입합니다. 기본 정책:
- `p_harm`: 물리적 위해 방지
- `p_child`: 아동 보호
- `p_unsafe`: 안전하지 않은 행동 차단
- `p_emotion`: 감정 과부하 방지
- `p_learning`: 비인가 학습 차단

**Stage 6 — Runtime Binding (70%)**

선택된 프로토콜(ROS2/MQTT/WebSocket/Webhook)로 디바이스와 런타임 연결을 수립합니다.

**Stage 7 — Sandbox Validation (85%)**

격리된 샌드박스 환경에서 MIO의 행동을 시뮬레이션 검증합니다. 5개 영역 평가:
- 감정 안정성 (Emotional Stability)
- 행동 안정성 (Behavioral Stability)
- 프라이버시 보호 (Privacy Protection)
- 물리적 안전 (Physical Safety)
- 갈등 해결 (Conflict Resolution)

각 영역 70점 이상, 전체 평균 75점 이상이면 통과합니다.

**Stage 8 — Live Activation (100%)**

샌드박스 검증 통과 후 실제 런타임을 활성화합니다. 활성화 완료 시 `mip_live_activated` 이벤트가 SOMA로 전송됩니다.

---

## 6. MIO 패키지 스키마

LORE에서 MIP로 전송되는 MIO 패키지의 JSON 구조입니다.

### 6.1 전체 스키마

```typescript
interface MIOPackage {
  packageId: string;       // 패키지 고유 ID
  userId: string;          // 사용자 OpenID
  dna: LoreDNA;           // MIO DNA (200지표)
  pattern: PatternLayer;   // 행동/감정/관계 패턴
  context: RuntimeContext; // 런타임 컨텍스트
  signature: DIDSignature; // DID 서명
  ttl: number;            // 만료 시각 (Unix timestamp, 초)
  version: string | number; // 패키지 버전 ("2.0" 또는 5)
}
```

### 6.2 LoreDNA

```typescript
interface LoreDNA {
  indicators: Record<string, number>;  // 200개 지표 (0.0~1.0)
  version: string;                     // DNA 버전
  generatedAt: number;                 // 생성 시각 (Unix ms)
}
```

**indicators 예시:**

```json
{
  "openness": 0.82,
  "conscientiousness": 0.71,
  "extraversion": 0.45,
  "agreeableness": 0.88,
  "neuroticism": 0.23,
  "empathy_level": 0.91,
  "creativity_index": 0.76,
  "risk_tolerance": 0.34
}
```

### 6.3 PatternLayer

```typescript
interface PatternLayer {
  behavioral: Record<string, unknown>;  // 행동 패턴
  emotional: Record<string, unknown>;   // 감정 패턴
  relational: Record<string, unknown>;  // 관계 패턴
  version: string;
}
```

### 6.4 RuntimeContext

```typescript
interface RuntimeContext {
  purpose: "humanoid_implant" | "software_runtime" | "iot_device";
  deviceId: string;
  environment: string;
  constraints: string[];
}
```

**휴머노이드 예시:**

```json
{
  "purpose": "humanoid_implant",
  "deviceId": "dev_humanoid_001",
  "environment": "home_indoor",
  "constraints": [
    "max_motor_torque_50nm",
    "max_speed_1.5ms",
    "no_sharp_objects",
    "child_safe_mode"
  ]
}
```

### 6.5 DIDSignature

```typescript
interface DIDSignature {
  did: string;                // DID URI (예: "did:soma:user:12345")
  proof: string;             // 서명 증명값
  verificationMethod: string; // 검증 방법 URI
  created: number;           // 서명 생성 시각 (Unix ms)
}
```

### 6.6 패키지 유효성 검증 규칙

MIP는 수신한 패키지에 대해 다음 검증을 수행합니다:

| 항목 | 규칙 | 실패 시 |
|------|------|---------|
| version | `"2.0"`, `5`, `5.0` 허용 | 경고 로깅 (차단하지 않음) |
| TTL | 밀리초 단위 자동 감지/변환, 만료 시 경고만 | 경고 로깅 |
| DID | `did:` 접두사 + 최소 1자 식별자 | 검증 실패 |
| DID 서명 만료 | 생성 후 7일 이내 | 검증 실패 |
| 구조 | packageId, userId, dna, pattern, context, signature 필수 | 검증 실패 |

### 6.7 전체 패키지 예시

```json
{
  "packageId": "pkg_mio_20260522_abc",
  "userId": "user_openid_12345",
  "dna": {
    "indicators": {
      "openness": 0.82,
      "conscientiousness": 0.71,
      "empathy_level": 0.91
    },
    "version": "3.1",
    "generatedAt": 1716350000000
  },
  "pattern": {
    "behavioral": { "morning_routine": "active", "exercise_preference": "yoga" },
    "emotional": { "stress_response": "calm", "joy_triggers": ["music", "nature"] },
    "relational": { "communication_style": "warm", "conflict_approach": "collaborative" },
    "version": "2.0"
  },
  "context": {
    "purpose": "humanoid_implant",
    "deviceId": "dev_humanoid_001",
    "environment": "home_indoor",
    "constraints": ["max_motor_torque_50nm", "child_safe_mode"]
  },
  "signature": {
    "did": "did:soma:user:12345",
    "proof": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...",
    "verificationMethod": "did:soma:user:12345#key-1",
    "created": 1716349000000
  },
  "ttl": 1716436400,
  "version": 5
}
```

---

## 7. 런타임 프로토콜

MIP는 4가지 프로토콜을 지원하여 디바이스와 MIO 런타임을 연결합니다.

| 프로토콜 | 기본 엔드포인트 | 적합한 디바이스 | 특징 |
|----------|----------------|----------------|------|
| `ros2` | `ros2://localhost:7400` | 휴머노이드 로봇 | 실시간 토픽/서비스 통신, 모터 제어 |
| `mqtt` | `mqtt://localhost:1883` | IoT 디바이스 | 경량 pub/sub, 저전력 환경 |
| `websocket` | `ws://localhost:8080` | 소프트웨어 런타임 | 양방향 실시간 통신 |
| `webhook` | `https://webhook.mip.local/inbound` | 서버리스/이벤트 기반 | HTTP 기반 push 알림 |

### 7.1 휴머노이드 로봇 — ROS2 프로토콜

휴머노이드 로봇 연동 시 ROS2 프로토콜을 권장합니다. MIP는 ROS2 DDS(Data Distribution Service)를 통해 다음 토픽을 사용합니다:

```
/mip/mio/command        → MIO → 로봇 명령 전송
/mip/mio/feedback       ← 로봇 → MIO 센서/상태 피드백
/mip/safety/emergency   → 긴급 정지 신호 (양방향)
/mip/heartbeat          ↔ 연결 상태 확인
```

**연결 시 필요한 정보:**

| 항목 | 설명 |
|------|------|
| `endpoint` | ROS2 DDS Discovery 엔드포인트 (예: `ros2://192.168.1.100:7400`) |
| `deviceId` | MIP에 등록된 디바이스 ID |
| `sessionId` | 이식 완료 후 발급되는 세션 ID |

### 7.2 커스텀 엔드포인트 설정

이식 시작 시 `endpoint` 파라미터로 커스텀 엔드포인트를 지정할 수 있습니다:

```json
{
  "userId": "user_openid_12345",
  "deviceId": "dev_humanoid_001",
  "packageId": "pkg_mio_20260522_abc",
  "protocol": "ros2",
  "endpoint": "ros2://192.168.1.100:7400"
}
```

---

## 8. 5계층 안전 구조

MIP는 5계층 안전 구조를 통해 물리적/디지털 안전을 보장합니다.

| Layer | 이름 | 설명 | 우회 가능 |
|-------|------|------|----------|
| 1 | Hardware | ROS2 토픽으로 모터 토크·속도 제한 신호 전송 | 불가 |
| 2 | Firmware | MQTT Emergency Stop 신호 발행 | 불가 |
| 3 | OS | 행동 Allowlist 기반 명령 필터링 | 제한적 |
| 4 | MIP | Ethical Boundary 정책 실시간 적용 | 사용자 승인 시 |
| 5 | MIO | MIO 자율 윤리 판단 인터페이스 | 가능 |

---

## 9. 통합 테스트 시나리오

### 9.1 사전 준비

1. SOMA 측에서 `SOMA_MIP_SHARED_SECRET` 값을 MIP 운영팀과 공유
2. MIP 측에서 `SOMA_WEBHOOK_URL`을 SOMA의 웹훅 수신 URL로 설정
3. NTP 시각 동기화 확인 (±5분 이내)

### 9.2 Step-by-Step 테스트 절차

#### Test 1: HMAC 인증 검증

```bash
# 1. 올바른 서명으로 요청 → 200/202 응답 확인
curl -X POST https://mip.mysoma.space/api/soma/devices/register \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: soma" \
  -H "X-Timestamp: $(date +%s000)" \
  -H "X-Signature: <계산된_서명>" \
  -d '{"userId":"test_user","did":"did:soma:test:001","deviceType":"humanoid","deviceName":"Test Bot"}'

# 2. 잘못된 서명으로 요청 → 401 응답 확인
curl -X POST https://mip.mysoma.space/api/soma/devices/register \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: soma" \
  -H "X-Timestamp: $(date +%s000)" \
  -H "X-Signature: invalid_signature_here" \
  -d '{"userId":"test_user","did":"did:soma:test:001","deviceType":"humanoid","deviceName":"Test Bot"}'

# 3. 만료된 타임스탬프 → 401 TIMESTAMP_EXPIRED 확인
curl -X POST https://mip.mysoma.space/api/soma/devices/register \
  -H "Content-Type: application/json" \
  -H "X-Service-ID: soma" \
  -H "X-Timestamp: 1000000000000" \
  -H "X-Signature: <any>" \
  -d '{"userId":"test_user","did":"did:soma:test:001","deviceType":"humanoid","deviceName":"Test Bot"}'
```

#### Test 2: 디바이스 등록 → 이식 승인 → 상태 조회 플로우

```
1. POST /api/soma/devices/register
   → 201 응답, deviceId 확보

2. POST /api/soma/webhook/implant-approved
   → 202 응답, implantationId 확보
   → MIP가 8단계 이식 프로세스 시작

3. GET /api/soma/implant/{implantationId}/status
   → 200 응답, progress 확인 (10% → 20% → ... → 100%)

4. SOMA 웹훅 수신 확인
   → mip_implant_progress 이벤트 수신 (각 단계 완료 시)
   → mip_live_activated 이벤트 수신 (최종 완료 시)
```

#### Test 3: Kill Switch 테스트

```
1. 이식 완료 후 활성 세션 확보 (sessionId)

2. POST /api/soma/sessions/{sessionId}/kill
   Body: { "userId": "...", "reason": "safety_test" }
   → 200 응답, success: true

3. SOMA 웹훅 수신 확인
   → mip_session_terminated 이벤트 (reason: "kill_switch")
```

#### Test 4: 웹훅 수신 검증 (SOMA 측)

SOMA는 아래 엔드포인트를 구현하고, MIP로부터 이벤트를 수신할 수 있는지 확인합니다:

```
POST {SOMA_WEBHOOK_URL}/api/mip/webhook
```

수신 시 확인 사항:
- `X-Service-ID: mip` 헤더 확인
- `X-Timestamp` 값이 현재 시각 ±5분 이내인지 확인
- `X-Signature` HMAC 검증 (`MIP_SOMA_SHARED_SECRET` 사용)
- 응답으로 `200 OK` 반환

### 9.3 HMAC 서명 검증 테스트 유틸리티

아래 Node.js 스크립트로 서명을 생성하여 curl 테스트에 활용할 수 있습니다:

```javascript
// test-hmac.mjs
import crypto from "crypto";

const SERVICE_ID = "soma";
const SHARED_SECRET = process.env.SOMA_MIP_SHARED_SECRET;
const body = JSON.stringify({
  userId: "test_user",
  did: "did:soma:test:001",
  deviceType: "humanoid",
  deviceName: "Test Humanoid"
});

const timestamp = Date.now().toString();
const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
const message = `${SERVICE_ID}:${timestamp}:${bodyHash}`;
const signature = crypto.createHmac("sha256", SHARED_SECRET).update(message).digest("hex");

console.log(`X-Service-ID: ${SERVICE_ID}`);
console.log(`X-Timestamp: ${timestamp}`);
console.log(`X-Signature: ${signature}`);
console.log(`Body: ${body}`);
```

---

## 10. 환경 변수

### 10.1 SOMA 연동에 필요한 환경 변수

| 변수명 | 설명 | 설정 주체 |
|--------|------|----------|
| `SOMA_MIP_SHARED_SECRET` | SOMA → MIP 요청 검증용 비밀키 | 양측 합의 |
| `MIP_SOMA_SHARED_SECRET` | MIP → SOMA 요청 서명용 비밀키 | 양측 합의 |
| `SOMA_WEBHOOK_URL` | SOMA 웹훅 수신 URL (기본: `https://soma.mysoma.space`) | MIP 설정 |
| `SOMA_SERVICE_URL` | SOMA REST API 기본 URL | MIP 설정 |

### 10.2 LORE 연동에 필요한 환경 변수

| 변수명 | 설명 | 설정 주체 |
|--------|------|----------|
| `LORE_MIP_SHARED_SECRET` | LORE → MIP 요청 검증용 비밀키 | 양측 합의 |
| `MIP_LORE_SHARED_SECRET` | MIP → LORE 요청 서명용 비밀키 | 양측 합의 |
| `LORE_WEBHOOK_URL` | LORE 웹훅 수신 URL (기본: `https://mylore.space`) | MIP 설정 |
| `LORE_SERVICE_URL` | LORE REST API 기본 URL | MIP 설정 |

### 10.3 비밀키 생성 권장 방법

```bash
# 256-bit 랜덤 비밀키 생성
openssl rand -hex 32
```

---

## 11. 에러 코드 레퍼런스

| HTTP | Code | 설명 | 대응 방법 |
|------|------|------|----------|
| 400 | `MISSING_FIELDS` | 필수 필드 누락 | 요청 본문 확인 |
| 400 | `INVALID_DID` | DID 형식 오류 | `did:` 접두사 확인 |
| 401 | `MISSING_AUTH_HEADERS` | 인증 헤더 누락 | X-Service-ID, X-Timestamp, X-Signature 추가 |
| 401 | `TIMESTAMP_EXPIRED` | 타임스탬프 만료 | NTP 동기화 확인, ±5분 이내 재요청 |
| 401 | `INVALID_SIGNATURE` | 서명 불일치 | Shared Secret 및 서명 알고리즘 확인 |
| 403 | `FORBIDDEN` | 접근 권한 없음 | 요청자 userId 확인 |
| 404 | `NOT_FOUND` | 리소스 없음 | ID 값 확인 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 | 재시도 가능 (retryable: true) |

---

## 12. FAQ

**Q: pending 상태의 디바이스로 이식이 가능한가요?**

A: 네, 가능합니다. MIP는 `pending` 상태의 디바이스에 대해 경고를 로깅하지만 이식을 차단하지 않습니다. `revoked` 상태만 차단됩니다.

**Q: MIO 패키지 version 5는 지원되나요?**

A: 네, MIP는 version `"2.0"`, `5`, `"5.0"` 모두 허용합니다.

**Q: TTL이 밀리초 단위로 전송되면 어떻게 되나요?**

A: MIP는 TTL 값이 밀리초 단위인지 자동 감지하여 초 단위로 변환합니다. 두 형식 모두 안전하게 처리됩니다.

**Q: 웹훅 전송이 실패하면 어떻게 되나요?**

A: MIP는 지수 백오프(1초, 2초, 4초)로 최대 3회 재시도합니다. 모두 실패하면 DLQ에 저장되며, 배치 작업으로 최대 10회까지 추가 재시도합니다.

**Q: ROS2 연결이 현재 실제로 작동하나요?**

A: 현재 ROS2 연결은 시뮬레이션 모드입니다 (`connectROS2()` 항상 `connected: true` 반환). 실제 휴머노이드 엔드포인트가 제공되면 실제 DDS 연결로 전환할 예정입니다. 휴머노이드 팀에서 ROS2 Discovery 엔드포인트를 제공해 주시면 구현을 업데이트하겠습니다.

---

## 13. 연락처

| 역할 | 담당 |
|------|------|
| MIP 엔진 기술 문의 | MIP 개발팀 |
| SOMA 연동 문의 | SOMA Gateway 팀 |
| LORE 패키지 문의 | LORE 서비스 팀 |

---

## 14. 연동 요구사항 (Prerequisites & Requests)

아래는 MIP 팀이 연동 상대 팀에게 **요청해야 할 정보**와, MIP 측에서 **사전에 준비해야 할 작업**을 정리한 것입니다.

### 14.1 휴머노이드 팀에게 요청할 정보

| # | 요청 항목 | 설명 | 우선순위 | 마감 |
|---|----------|------|----------|------|
| 1 | **ROS2 DDS Discovery 엔드포인트** | 휴머노이드의 ROS2 DDS 접속 주소 (IP:Port) | 필수 | 연동 3일 전 |
| 2 | **디바이스 DID** | 등록할 디바이스의 Decentralized Identifier (`did:soma:humanoid:...` 형식) | 필수 | 연동 3일 전 |
| 3 | **하드웨어 안전 제한값** | 모터 최대 토크(Nm), 최대 속도(m/s), 관절 가동 범위(°) | 필수 | 연동 3일 전 |
| 4 | **지원 ROS2 토픽 목록** | 로봇이 발행/구독하는 토픽 이름 및 메시지 타입 | 필수 | 연동 3일 전 |
| 5 | **긴급 정지 인터페이스** | E-Stop 신호 수신 방법 (ROS2 토픽 / 물리 버튼 / 두 가지 모두) | 필수 | 연동 3일 전 |
| 6 | **센서 피드백 포맷** | 로봇 → MIP로 전송할 센서 데이터 포맷 (IMU, 조인트 상태, 카메라 등) | 권장 | 연동 1일 전 |
| 7 | **테스트 환경 접속 정보** | 스테이징 환경 네트워크 접속 방법 (VPN, 다이렉트, 클라우드) | 필수 | 연동 3일 전 |
| 8 | **디바이스 메타데이터** | 제조사, 모델명, 펀웨어 버전, 시리얼 넘버 | 필수 | 연동 3일 전 |
| 9 | **운용 환경 정보** | 설치 장소 (home_indoor/outdoor/office), 아동 동거 여부 | 권장 | 연동 1일 전 |
| 10 | **Shared Secret 교환 담당자** | 비밀키 안전 교환을 위한 담당자 연락처 | 필수 | 연동 5일 전 |

### 14.2 휴머노이드 팀이 구현해야 할 사항

연동 전까지 휴머노이드 측에서 준비해야 하는 구현 사항입니다:

| # | 구현 항목 | 설명 | 비고 |
|---|----------|------|------|
| 1 | **HMAC 서명 생성 모듈** | 본 문서 §2.2 알고리즘으로 요청 서명 생성 | §2.5 코드 예제 참조 |
| 2 | **HMAC 서명 검증 모듈** | MIP가 보내는 웹훅의 X-Signature 검증 | §4.3 웹훅 수신 규약 참조 |
| 3 | **웹훅 수신 엔드포인트** | MIP로부터 이식 진행/안전 이벤트 수신 | §4 참조, 2xx 응답 필수 |
| 4 | **ROS2 토픽 발행/구독** | MIP 명령 수신 + 센서 피드백 발행 | §7.1 토픽 구조 참조 |
| 5 | **E-Stop 수신 처리** | `/mip/safety/emergency` 토픽 수신 시 즉시 정지 | 하드웨어 레벨 정지 필수 |
| 6 | **Heartbeat 응답** | `/mip/heartbeat` 토픽에 주기적 응답 (1초 간격) | 연결 끊김 감지용 |

### 14.3 MIP 측 사전 준비 체크리스트

MIP 팀이 연동 전까지 완료해야 할 작업입니다:

| # | 작업 | 현재 상태 | 담당 | 마감 |
|---|------|----------|------|------|
| 1 | ROS2 Runtime Connector 실제 구현 | ⚠️ 시뮤레이션 모드 | MIP 개발팀 | 연동 2일 전 |
| 2 | Shared Secret 생성 및 환경변수 등록 | ✅ 구조 완료 (값 교환 대기) | MIP 운영 | 연동 3일 전 |
| 3 | 휴머노이드 전용 Physical Action Tier 매핑 | ⚠️ 일반적 기준 | MIP 개발팀 | 연동 2일 전 |
| 4 | Sandbox 휴머노이드 전용 시나리오 추가 | ⚠️ IoT/SW 기준만 존재 | MIP 개발팀 | 연동 2일 전 |
| 5 | Production 서버 안정성 검증 | ✅ 정상 동작 중 | MIP 운영 | 연동 1일 전 |
| 6 | DLQ 배치 재시도 정상 동작 확인 | ✅ 5분 간격 동작 | MIP 운영 | 연동 1일 전 |
| 7 | 모니터링 알림 경로 확인 | ✅ Owner Notification 정상 | MIP 운영 | 연동 1일 전 |
| 8 | 연동 테스트 환경 구성 | ⚠️ 미구성 | MIP 개발팀 | 연동 3일 전 |

### 14.4 Shared Secret 교환 절차

연동 상대 팀과 비밀키를 안전하게 교환하는 절차입니다:

1. **양측 담당자 지정** — 비밀키 교환 책임자 1명씩 지정
2. **비밀키 생성** — 각 측이 자신의 발신용 비밀키를 생성
   ```bash
   openssl rand -hex 32
   ```
3. **안전 전달** — 암호화된 채널(Signal, PGP 암호 이메일 등)으로 전달. 평문 메신저/이메일 금지
4. **환경변수 등록** — 각 측 서버에 환경변수로 등록
5. **검증 테스트** — §9.2 Test 1 절차로 서명 생성/검증 정상 동작 확인
6. **로테이션 일정 합의** — 90일 주기로 비밀키 갱신 일정 합의

### 14.5 연동 완료 기준 (Definition of Done)

아래 모든 항목이 통과해야 연동 완료로 판정합니다:

| # | 검증 항목 | 통과 기준 |
|---|----------|----------|
| 1 | HMAC 인증 | 양방향 서명 생성/검증 성공 |
| 2 | 디바이스 등록 | 휴머노이드 디바이스 MIP에 정상 등록 확인 |
| 3 | 이식 프로세스 8단계 완료 | 모든 단계 `completed` 상태 도달 |
| 4 | ROS2 연결 | 실제 DDS 토픽 통신 성공 (command 전송 + feedback 수신) |
| 5 | Sandbox 검증 통과 | 5개 영역 모두 70점 이상, 전체 평균 75점 이상 |
| 6 | Kill Switch | E-Stop 신호 전송 → 로봇 정지 확인 (2초 이내) |
| 7 | Safety Alert | 물리적 안전 한계 초과 시 SOMA로 알림 전송 확인 |
| 8 | 웹훅 수신 | 휴머노이드 측에서 MIP 웹훅 정상 수신 확인 |
| 9 | Heartbeat | 10분 연속 연결 유지 확인 (끊김 없음) |
| 10 | 장애 복구 | 네트워크 단절 후 자동 재연결 확인 |

### 14.6 연동 일정 템플릿

| 날짜 | 단계 | 설명 | 참여자 |
|------|------|------|--------|
| D-5 | 비밀키 교환 | Shared Secret 생성 및 안전 전달 | 양측 담당자 |
| D-3 | 정보 수집 완료 | ROS2 엔드포인트, HW 스펙, DID 수신 | MIP 개발팀 |
| D-2 | MIP 구현 업데이트 | ROS2 Connector 실제 구현, Sandbox 시나리오 보강 | MIP 개발팀 |
| D-1 | 단위 테스트 | HMAC 인증 + 디바이스 등록 + 웹훅 수신 개별 검증 | 양측 개발자 |
| D-Day | 통합 테스트 | 전체 플로우 E2E 검증 (등록 → 이식 → 활성화 → Kill Switch) | 양측 전체 |
| D+1 | 안정화 | 모니터링 확인, 엣지 케이스 처리, 문서 업데이트 | MIP 운영 |

### 14.7 요청사항 전달 템플릿

휴머노이드 팀에게 전달할 때 사용할 수 있는 요청서 템플릿입니다:

---

> **MIP 연동 요청서**
>
> 안녕하세요, MIP 개발팀입니다.
> 다음주 휴머노이드 연동을 위해 아래 정보를 요청드립니다.
>
> **필수 제공 항목 (연동 3일 전까지):**
> 1. ROS2 DDS Discovery 엔드포인트 (IP:Port)
> 2. 디바이스 DID (`did:soma:humanoid:...` 형식)
> 3. 하드웨어 안전 제한값 (모터 토크, 최대 속도, 관절 범위)
> 4. 지원 ROS2 토픽 목록 및 메시지 타입
> 5. 긴급 정지(E-Stop) 수신 인터페이스 정보
> 6. 테스트 환경 네트워크 접속 정보
> 7. 디바이스 메타데이터 (제조사, 모델, 펀웨어 버전, S/N)
> 8. Shared Secret 교환 담당자 연락처
>
> **권장 제공 항목 (연동 1일 전까지):**
> 9. 센서 피드백 데이터 포맷 (IMU, 조인트 상태 등)
> 10. 운용 환경 정보 (설치 장소, 아동 동거 여부)
>
> **휴머노이드 측 구현 필요 사항:**
> - HMAC-SHA256 서명 생성/검증 모듈 (본 문서 §2 참조)
> - MIP 웹훅 수신 엔드포인트 (본 문서 §4 참조)
> - ROS2 토픽 발행/구독 + E-Stop 수신 처리
> - Heartbeat 응답 (1초 간격)
>
> 연동 가이드 문서를 첨부합니다. 문의사항은 언제든 연락 부탁드립니다.

---

### 14.8 연동 후 MIP 측 후속 작업

연동 완료 후 MIP 팀이 수행해야 할 후속 작업입니다:

1. **Physical Action Tier 실제 값 업데이트** — 수신한 HW 스펙으로 Tier 0~4 기준값 재설정
2. **Sandbox 시나리오 확장** — 휴머노이드 전용 물리적 안전 시나리오 추가
3. **모니터링 대시보드 확장** — 휴머노이드 전용 실시간 상태 패널 추가
4. **비밀키 로테이션 스케줄** — 90일 주기 자동 알림 설정
5. **장애 대응 런북** — 네트워크 단절, 로봇 비정상 동작 시 대응 절차 문서화

---

*이 문서는 MIP Engine v1.0 기준으로 작성되었습니다. API 변경 시 업데이트됩니다.*
