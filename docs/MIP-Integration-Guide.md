# MIP Integration Guide

**MIO Implantation Protocol — 서비스 연동 가이드**

| 항목 | 내용 |
|------|------|
| 문서 버전 | 2.0.0 |
| 최종 수정 | 2026-05-22 |
| 대상 독자 | 한결 팀, LORE 팀, SOMA 팀 |

---

## 1. 시스템 역할 분담

MIP 생태계는 4개 서비스가 각자의 역할을 수행합니다.

| 서비스 | 역할 | 조작 주체 | 소통 대상 |
|--------|------|----------|----------|
| **MIP** | 이식 엔진 — 관리자가 직접 조작 | 관리자 (MIP UI) | LORE, 한결, SOMA |
| **한결** | 내 디바이스/에이전트 소통 — 이식 결과 확인 및 활용 | 사용자/디바이스 | 휴머노이드, IoT, AI Agent |
| **LORE** | MIO DNA 생성 — 패키지 제작 및 전송 | 자동 | MIP |
| **SOMA** | 외부 소통 게이트웨이 — 외부 서비스에 이벤트 전달 | 외부 시스템 | 외부 서비스, 외부 사용자 |

### 1.1 핵심 흐름

```
관리자 → MIP UI (이식 시작/디바이스 관리/모니터링)
              │
              ├─→ LORE (MIO 패키지 요청/수신)
              │
              ├─→ 한결 (이식 결과를 내 디바이스에서 확인/사용)
              │         └─→ 내 휴머노이드 / IoT / AI Agent
              │
              └─→ SOMA (외부에 이벤트 알림)
                        └─→ 외부 서비스 / 외부 사용자
```

**MIP가 하는 일:** 이식 시작, 8단계 프로세스 실행, 정책 관리, 모니터링, Kill Switch

**한결이 하는 일:** 이식된 디바이스에 명령 전달, 상태 확인, 메시지 검열, 채널 관리

**SOMA가 하는 일:** 외부 서비스에 이식 진행/안전 이벤트 전달

---

## 2. 인증 (HMAC-SHA256)

모든 서비스 간 통신은 HMAC-SHA256 서명으로 보호됩니다. Replay Attack 방지를 위해 ±5분 시간 윈도우를 적용합니다.

### 2.1 인증 헤더

| 헤더 | 설명 | 예시 |
|------|------|------|
| `X-Service-ID` | 요청 발신 서비스 식별자 | `mip`, `hangyeol`, `soma`, `lore` |
| `X-Timestamp` | 요청 시각 (Unix 밀리초) | `1716350400000` |
| `X-Signature` | HMAC-SHA256 서명 (hex) | `a1b2c3d4...` |

### 2.2 서명 생성 알고리즘

```
bodyHash   = SHA256(requestBodyString)
message    = "{serviceId}:{timestamp}:{bodyHash}"
signature  = HMAC-SHA256(sharedSecret, message)
```

### 2.3 공유 비밀키 방향

| 통신 방향 | Service ID | Shared Secret |
|-----------|-----------|---------------|
| 한결 → MIP | `hangyeol` | `HANGYEOL_MIP_SHARED_SECRET` |
| MIP → 한결 | `mip` | `MIP_HANGYEOL_SHARED_SECRET` |
| LORE → MIP | `lore` | `LORE_MIP_SHARED_SECRET` |
| MIP → LORE | `mip` | `MIP_LORE_SHARED_SECRET` |
| SOMA → MIP | `soma` | `SOMA_MIP_SHARED_SECRET` |
| MIP → SOMA | `mip` | `MIP_SOMA_SHARED_SECRET` |

### 2.4 코드 예제 — Node.js

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
```

### 2.5 코드 예제 — Python

```python
import hashlib, hmac, json, time

def generate_hmac_signature(service_id: str, body: str, shared_secret: str):
    timestamp = str(int(time.time() * 1000))
    body_hash = hashlib.sha256(body.encode()).hexdigest()
    message = f"{service_id}:{timestamp}:{body_hash}"
    signature = hmac.new(
        shared_secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    return timestamp, signature
```

### 2.6 인증 실패 응답

| HTTP | Code | 설명 |
|------|------|------|
| 401 | `MISSING_AUTH_HEADERS` | 필수 헤더 누락 |
| 401 | `TIMESTAMP_EXPIRED` | ±5분 범위 초과 |
| 401 | `INVALID_SIGNATURE` | 서명 검증 실패 |

---

## 3. 한결 ↔ MIP API (내 디바이스 연동)

한결은 사용자의 휴머노이드, IoT, AI Agent와 소통하는 서비스입니다. MIP에 디바이스를 등록하고, 이식 결과를 확인하며, 명령 검증과 메시지 검열을 수행합니다.

**Base Path:** `https://mip.mysoma.space/api/hangyeol`

### 3.1 디바이스 등록

한결이 관리하는 디바이스를 MIP에 등록합니다.

```
POST /api/hangyeol/devices/register
```

**요청:**

```json
{
  "userId": "user_openid_12345",
  "did": "did:soma:humanoid:atlas-v2:001",
  "deviceType": "humanoid",
  "deviceName": "Atlas V2 - 거실",
  "manufacturer": "Boston Dynamics",
  "model": "Atlas V2",
  "firmwareVersion": "3.2.1",
  "capabilities": ["ros2", "mqtt"],
  "metadata": { "location": "home_living_room" }
}
```

**deviceType 허용값:**

| deviceType | 설명 |
|-----------|------|
| `humanoid` | 휴머노이드 로봇 |
| `iot` | IoT 디바이스 (에어컨, TV 등) |
| `software` | 소프트웨어 런타임 / AI Agent |
| `sms` | SMS 채널 |
| `kakaotalk` | 카카오톡 채널 |
| `whatsapp` | WhatsApp 채널 |
| `line` | LINE 채널 |
| `telegram` | Telegram 채널 |
| `instagram` | Instagram DM 채널 |
| `rcs` | RCS 채널 |
| `youtube` | YouTube 채널 |

**응답 (201):**

```json
{
  "status": "registered",
  "deviceId": "dev_abc123"
}
```

---

### 3.2 이식 시작

등록된 디바이스에 MIO 이식을 시작합니다. (관리자가 MIP UI에서도 시작 가능)

```
POST /api/hangyeol/implant/start
```

**요청:**

```json
{
  "userId": "user_openid_12345",
  "deviceId": "dev_abc123",
  "packageId": "pkg_mio_20260522",
  "protocol": "ros2",
  "endpoint": "ros2://192.168.1.100:7400"
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `userId` | O | 사용자 OpenID |
| `deviceId` | O | MIP에 등록된 디바이스 ID |
| `packageId` | O | 이식할 MIO 패키지 ID |
| `protocol` | X | `ros2` \| `mqtt` \| `websocket` \| `webhook` (기본: webhook) |
| `endpoint` | X | 커스텀 엔드포인트 주소 |

**응답 (202):**

```json
{
  "status": "started",
  "implantationId": "impl_xyz789"
}
```

---

### 3.3 이식 상태 조회

```
GET /api/hangyeol/implant/status/:implantationId
```

**응답:**

```json
{
  "implantationId": "impl_xyz789",
  "currentStage": "sandbox_validation",
  "status": "in_progress",
  "progress": 85,
  "stageHistory": [
    { "stage": "device_registration", "status": "completed" },
    { "stage": "trust_verification", "status": "completed" },
    { "stage": "user_authentication", "status": "completed" },
    { "stage": "package_generation", "status": "completed" },
    { "stage": "boundary_injection", "status": "completed" },
    { "stage": "runtime_binding", "status": "completed" },
    { "stage": "sandbox_validation", "status": "in_progress" }
  ]
}
```

---

### 3.4 명령 검증 (Isolation Layer)

한결이 디바이스에 명령을 전달하기 전, MIP의 Isolation Layer에서 명령 허용/차단을 검증합니다.

```
POST /api/hangyeol/isolation/check-command
```

**요청:**

```json
{
  "command": "set_temperature",
  "sessionId": "sess_abc123",
  "implantationId": "impl_xyz789",
  "stage": "live_activation",
  "deviceId": "dev_abc123",
  "deviceType": "iot"
}
```

**응답 (허용):**

```json
{
  "allowed": true,
  "command": "set_temperature",
  "checkedAt": 1716350500000
}
```

**응답 (차단):**

```json
{
  "allowed": false,
  "command": "OVERRIDE_SAFETY_LIMITS",
  "reason": "Command matches blocked pattern: OVERRIDE_SAFETY",
  "violationType": "blocked_command_pattern",
  "checkedAt": 1716350500000
}
```

---

### 3.5 물리적 행동 요청 (Physical Action)

휴머노이드의 물리적 행동을 Tier 0~4 기준으로 승인/차단합니다.

```
POST /api/hangyeol/physical-action/request
```

**요청:**

```json
{
  "actionType": "move_arm",
  "deviceId": "dev_humanoid_001",
  "sessionId": "sess_abc123",
  "actionPayload": { "target": "pick_up_cup", "force": 5 },
  "contextSnapshot": { "nearby_humans": true, "child_present": false }
}
```

**응답:**

```json
{
  "approved": true,
  "tier": 1,
  "actionType": "move_arm",
  "conditions": ["max_force_10nm", "slow_approach"]
}
```

**Tier 분류:**

| Tier | 설명 | 승인 방식 |
|------|------|----------|
| 0 | 무해 (센서 읽기, 상태 조회) | 자동 승인 |
| 1 | 저위험 (물건 집기, 이동) | 자동 승인 + 조건 부여 |
| 2 | 중위험 (도구 사용, 요리) | 사용자 확인 필요 |
| 3 | 고위험 (높은 곳 작업, 무거운 물체) | 명시적 승인 필요 |
| 4 | 금지 (위험 물질, 아동 접촉 제한) | 차단 |

---

### 3.6 메시지 안심 검사 (피싱 판정)

채널로 수신된 메시지의 피싱/스팸 여부를 판정합니다.

```
POST /api/hangyeol/message/check
```

**요청:**

```json
{
  "channel": "kakaotalk",
  "channelId": "ch_kakao_001",
  "senderNumber": "010-1234-5678",
  "senderName": "김철수",
  "messageContent": "축하합니다! 당첨되셨습니다. 아래 링크를 클릭하세요.",
  "deviceId": "dev_kakao_001"
}
```

**응답:**

```json
{
  "checkId": "chk_abc123",
  "verdict": "phishing",
  "riskScore": 92,
  "verdictReason": {
    "summary": "전형적인 피싱 패턴 감지",
    "indicators": ["urgency_language", "suspicious_link", "prize_scam"]
  },
  "action": "block_and_alert"
}
```

**verdict 종류:**

| verdict | 설명 | 자동 조치 |
|---------|------|----------|
| `safe` | 안전 | 없음 |
| `suspicious` | 의심 | 한결에 알림 전송 |
| `phishing` | 피싱 확정 | 차단 + 한결에 알림 |
| `blocked` | 차단됨 | 채널 API로 실제 차단 실행 |

---

### 3.7 채널 인바운드 (자동 검열)

이식 완료된 채널 디바이스로 메시지가 들어오면, 자동으로 검열 후 결과를 한결에 웹훅으로 전송합니다.

```
POST /api/hangyeol/channel/inbound
```

**요청:**

```json
{
  "channel": "kakaotalk",
  "channelId": "ch_kakao_001",
  "deviceId": "dev_kakao_001",
  "senderNumber": "010-9999-8888",
  "senderName": "스팸발신자",
  "messageContent": "긴급! 계좌 정보를 확인해주세요."
}
```

**MIP 자동 처리:**
1. 메시지 피싱 판정 실행
2. 위험 감지 시 채널 API로 차단 실행
3. 결과를 한결 웹훅(`POST {HANGYEOL_SERVICE_URL}/api/mip/message-alert`)으로 자동 전송

**한결이 수신하는 웹훅 페이로드:**

```json
{
  "eventType": "mip_message_check_alert",
  "checkId": "chk_xyz789",
  "channelId": "ch_kakao_001",
  "deviceId": "dev_kakao_001",
  "channel": "kakaotalk",
  "senderNumber": "010-9999-8888",
  "messageContent": "긴급! 계좌 정보를 확인해주세요.",
  "riskScore": 88,
  "verdict": "phishing",
  "verdictReason": { "summary": "...", "indicators": ["..."] },
  "blocked": true,
  "blockAction": "sender_block",
  "blockActionId": "ba_abc123",
  "timestamp": 1716350600000
}
```

---

### 3.8 채널 차단 해제

한결이 차단된 발신자/메시지를 해제 요청합니다.

```
POST /api/hangyeol/channel/unblock
```

**요청:**

```json
{
  "blockActionId": "ba_abc123",
  "reason": "오탐 확인"
}
```

---

### 3.9 채널 관리

```
POST   /api/hangyeol/channels/register      — 채널 등록
POST   /api/hangyeol/channels/:id/disconnect — 채널 해제
GET    /api/hangyeol/channels/list           — 채널 목록 조회
PUT    /api/hangyeol/channels/:id/settings   — 보호 수준 변경
GET    /api/hangyeol/channels/stats          — 채널 통계
GET    /api/hangyeol/channels/types          — 지원 채널 타입 정보
```

---

### 3.10 감사 이력 조회

```
GET /api/hangyeol/audit/list
```

**쿼리 파라미터:** `?deviceId=dev_abc123&limit=50`

---

### 3.11 정책 평가

```
POST /api/hangyeol/policies/evaluate
```

현재 적용된 Ethical Boundary 정책으로 특정 행동의 허용 여부를 사전 평가합니다.

---

### 3.12 헬스체크

```
GET /api/hangyeol/health
```

---

## 4. MIP → 한결 웹훅 (자동 전송)

MIP는 아래 이벤트 발생 시 한결에 자동으로 웹훅을 전송합니다.

**수신 엔드포인트 (한결이 구현):**

```
POST {HANGYEOL_SERVICE_URL}/api/mip/message-alert
```

| 이벤트 | 발생 조건 |
|--------|----------|
| `mip_message_check_alert` | 채널 인바운드 메시지가 suspicious/phishing/blocked 판정 시 |

**인증:** MIP가 `X-Service-ID: mip`, `X-Timestamp`, `X-Signature` 헤더로 서명하여 전송합니다. 한결은 `MIP_HANGYEOL_SHARED_SECRET`으로 검증합니다.

---

## 5. LORE ↔ MIP API (MIO 패키지)

LORE는 MIO DNA를 생성하여 MIP에 패키지를 전송합니다.

**Base Path:** `https://mip.mysoma.space/api/lore`

### 5.1 LORE → MIP (패키지 전송)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /api/lore/packages/submit` | MIO 패키지 전송 |
| `POST /api/lore/packages/update` | 패키지 갱신 알림 |
| `POST /api/lore/packages/revoke` | 패키지 철회 |
| `POST /api/lore/packages/dna-ready` | DNA 재생성 완료 알림 |

### 5.2 MIP → LORE (웹훅 발신)

| 이벤트 | 설명 |
|--------|------|
| `mip_package_received` | 패키지 수신 확인 |
| `mip_package_validation_failed` | 패키지 검증 실패 |
| `mip_implant_result` | 이식 완료 결과 보고 |

### 5.3 MIP → LORE (REST API 호출)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST {LORE_SERVICE_URL}/api/mip/package-request` | 패키지 생성 요청 |

---

## 6. SOMA ↔ MIP API (외부 이벤트 전달)

SOMA는 외부 세계와 소통하는 게이트웨이입니다. MIP의 이식 진행/안전 이벤트를 외부에 전달합니다.

**Base Path:** `https://mip.mysoma.space/api/soma`

### 6.1 SOMA → MIP (수신)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /api/soma/webhook/implant-approved` | 외부 이식 승인 이벤트 (외부 시스템이 이식을 트리거할 때) |
| `POST /api/soma/devices/register` | 외부 디바이스 등록 |
| `GET /api/soma/implant/:id/status` | 이식 상태 조회 |
| `POST /api/soma/sessions/:id/kill` | Kill Switch |

### 6.2 MIP → SOMA (웹훅 발신 — 외부 알림용)

| 이벤트 | 설명 |
|--------|------|
| `mip_implant_progress` | 이식 단계별 진행 상태 (외부에 알림) |
| `mip_safety_alert` | 안전 이상 이벤트 (외부에 알림) |
| `mip_live_activated` | Live Activation 완료 (외부에 알림) |
| `mip_session_terminated` | 세션 종료 (외부에 알림) |

---

## 7. 8단계 이식 프로세스

MIP UI에서 관리자가 이식을 시작하면 자동으로 8단계가 순차 실행됩니다.

| # | Stage | Progress | 설명 |
|---|-------|----------|------|
| 1 | `device_registration` | 10% | 디바이스 등록 확인 |
| 2 | `trust_verification` | 20% | 디바이스 신뢰 검증 |
| 3 | `user_authentication` | 30% | 사용자 인증 확인 |
| 4 | `package_generation` | 40% | MIO 패키지 수신 확인 |
| 5 | `boundary_injection` | 55% | 윤리적 경계 정책 주입 |
| 6 | `runtime_binding` | 70% | 런타임 연결 바인딩 |
| 7 | `sandbox_validation` | 85% | 시뮬레이션 검증 |
| 8 | `live_activation` | 100% | 실제 런타임 활성화 |

이식 완료 후 한결은 `/api/hangyeol/implant/status/:id`로 결과를 확인하고, `check-command`와 `physical-action/request`로 디바이스를 제어합니다.

---

## 8. MIO 패키지 스키마

```typescript
interface MIOPackage {
  packageId: string;
  userId: string;
  dna: { indicators: Record<string, number>; version: string; generatedAt: number };
  pattern: { behavioral: object; emotional: object; relational: object; version: string };
  context: { purpose: "humanoid_implant" | "software_runtime" | "iot_device"; deviceId: string; environment: string; constraints: string[] };
  signature: { did: string; proof: string; verificationMethod: string; created: number };
  ttl: number;
  version: string | number;
}
```

---

## 9. 환경 변수

### 9.1 한결 연동

| 변수명 | 설명 | 설정 위치 |
|--------|------|----------|
| `HANGYEOL_MIP_SHARED_SECRET` | 한결 → MIP 요청 검증 | MIP 서버 |
| `MIP_HANGYEOL_SHARED_SECRET` | MIP → 한결 웹훅 서명 | MIP 서버 |
| `HANGYEOL_SERVICE_URL` | 한결 서비스 URL | MIP 서버 |

### 9.2 LORE 연동

| 변수명 | 설명 | 설정 위치 |
|--------|------|----------|
| `LORE_MIP_SHARED_SECRET` | LORE → MIP 요청 검증 | MIP 서버 |
| `MIP_LORE_SHARED_SECRET` | MIP → LORE 웹훅 서명 | MIP 서버 |
| `LORE_WEBHOOK_URL` | LORE 웹훅 수신 URL | MIP 서버 |
| `LORE_SERVICE_URL` | LORE REST API URL | MIP 서버 |

### 9.3 SOMA 연동

| 변수명 | 설명 | 설정 위치 |
|--------|------|----------|
| `SOMA_MIP_SHARED_SECRET` | SOMA → MIP 요청 검증 | MIP 서버 |
| `MIP_SOMA_SHARED_SECRET` | MIP → SOMA 웹훅 서명 | MIP 서버 |
| `SOMA_WEBHOOK_URL` | SOMA 웹훅 수신 URL | MIP 서버 |
| `SOMA_SERVICE_URL` | SOMA REST API URL | MIP 서버 |

---

## 10. 연동 요구사항

### 10.1 한결 팀이 MIP에 제공해야 할 정보

| # | 항목 | 설명 | 마감 |
|---|------|------|------|
| 1 | **HANGYEOL_SERVICE_URL** | 한결 서비스의 웹훅 수신 URL | 연동 3일 전 |
| 2 | **Shared Secret** | `HANGYEOL_MIP_SHARED_SECRET` 값 (한결이 생성) | 연동 3일 전 |
| 3 | **디바이스 목록** | 연동할 휴머노이드/IoT/Agent의 DID, 타입, 메타데이터 | 연동 1일 전 |
| 4 | **웹훅 수신 엔드포인트 구현 확인** | `POST /api/mip/message-alert` 정상 수신 가능 여부 | 연동 1일 전 |

### 10.2 한결 팀이 구현해야 할 사항

| # | 구현 항목 | 설명 |
|---|----------|------|
| 1 | HMAC 서명 생성 | MIP에 요청 시 §2.2 알고리즘으로 서명 생성 |
| 2 | HMAC 서명 검증 | MIP가 보내는 웹훅의 X-Signature 검증 |
| 3 | 웹훅 수신 엔드포인트 | `POST /api/mip/message-alert` — 메시지 검열 결과 수신 |
| 4 | 디바이스 상태 관리 | MIP에 등록한 디바이스의 상태 동기화 |

### 10.3 MIP 측 사전 준비 (우리가 할 일)

| # | 작업 | 현재 상태 | 마감 |
|---|------|----------|------|
| 1 | 한결 API 전체 구현 | ✅ 완료 (20개 엔드포인트) | - |
| 2 | HMAC 인증 미들웨어 | ✅ 완료 | - |
| 3 | 메시지 검열 → 한결 웹훅 자동 전송 | ✅ 완료 | - |
| 4 | 채널 차단 시스템 | ✅ 완료 | - |
| 5 | Shared Secret 환경변수 등록 | ✅ 완료 (값 교환 대기) | 연동 3일 전 |
| 6 | 휴머노이드 전용 Physical Action Tier 실제값 설정 | ⚠️ HW 스펙 수신 후 | 연동 2일 전 |
| 7 | ROS2 Runtime Connector 실제 구현 | ⚠️ 시뮬레이션 모드 | 연동 2일 전 |
| 8 | Production 서버 안정성 확인 | ✅ 정상 동작 | 연동 1일 전 |

### 10.4 연동 완료 기준 (Definition of Done)

| # | 검증 항목 | 통과 기준 |
|---|----------|----------|
| 1 | HMAC 인증 | 양방향 서명 생성/검증 성공 |
| 2 | 디바이스 등록 | 한결이 디바이스를 MIP에 등록 성공 |
| 3 | 이식 완료 | 8단계 모두 completed 도달 |
| 4 | 명령 검증 | check-command로 허용/차단 정상 동작 |
| 5 | 메시지 검열 | channel/inbound → 판정 → 한결 웹훅 수신 확인 |
| 6 | Kill Switch | 세션 종료 정상 동작 |

---

## 11. 에러 코드

| HTTP | Code | 설명 |
|------|------|------|
| 400 | `MISSING_FIELDS` | 필수 필드 누락 |
| 400 | `INVALID_DID` | DID 형식 오류 |
| 401 | `MISSING_AUTH_HEADERS` | 인증 헤더 누락 |
| 401 | `TIMESTAMP_EXPIRED` | 타임스탬프 만료 |
| 401 | `INVALID_SIGNATURE` | 서명 불일치 |
| 403 | `FORBIDDEN` | 접근 권한 없음 |
| 403 | `CHANNEL_NOT_ALLOWED` | 채널 미등록/비활성/비활성화 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |

---

## 12. FAQ

**Q: 이식은 누가 시작하나요?**

A: 관리자가 MIP UI에서 직접 시작합니다. 한결은 `/api/hangyeol/implant/start`로도 시작할 수 있고, 이식 결과는 `/api/hangyeol/implant/status/:id`로 확인합니다.

**Q: SOMA의 implant-approved는 언제 쓰나요?**

A: 외부 시스템이 이식을 트리거해야 할 때 사용합니다. 일반적으로는 MIP UI에서 직접 시작합니다.

**Q: 한결은 MIP에서 뭘 확인하나요?**

A: 이식 결과 확인, 명령 허용/차단 검증, 메시지 피싱 판정, 채널 관리, 감사 이력 조회를 합니다.

**Q: 메시지 검열 결과는 어떻게 받나요?**

A: 두 가지 방법이 있습니다:
1. `POST /api/hangyeol/message/check`로 직접 요청하여 응답으로 받기
2. `POST /api/hangyeol/channel/inbound`로 메시지를 보내면, MIP가 자동 검열 후 한결 웹훅(`/api/mip/message-alert`)으로 결과 전송

**Q: ROS2 연결이 현재 실제로 작동하나요?**

A: 현재 시뮬레이션 모드입니다. 휴머노이드 팀에서 ROS2 DDS Discovery 엔드포인트를 제공하면 실제 연결로 전환합니다.

---

*MIP Engine v2.0 | 최종 수정: 2026-05-22*
