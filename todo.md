# MIP Engine TODO

## Phase 1: DB 스키마 설계 및 마이그레이션
- [x] drizzle/schema.ts에 8개 MIP 테이블 추가 (mip_devices, mip_packages, mip_implantations, mip_sandbox_reports, mip_boundary_policies, mip_runtime_sessions, mip_safety_logs, mip_audit_chain)
- [x] drizzle-kit generate 실행 후 webdev_execute_sql로 마이그레이션 적용

## Phase 2: 공통 유틸리티 및 서버 핵심 로직
- [x] server/lib/hmac.ts — HMAC-SHA256 서명/검증 유틸리티
- [x] server/lib/did.ts — DID 서명 검증 (W3C DID v1.0 모의 구현)
- [x] server/lib/zkp.ts — ZKP 선택적 공개 처리 기본 구현
- [x] server/lib/audit.ts — 감사 로그 해시 체인 유틸리티
- [x] shared/mip-types.ts — MIOPackage, EthicalBoundaryPolicy, SandboxValidationReport 등 공유 타입

## Phase 3: 5대 서브시스템 서버 로직
- [x] server/mip/package-receiver.ts — MIO Package Receiver (DID 검증, HMAC 워터마크, TTL)
- [x] server/mip/ethical-boundary.ts — Ethical Boundary Engine (5개 정책 주입·합성·위반 차단)
- [x] server/mip/simulation-sandbox.ts — Simulation Sandbox (5항목 AND 게이트, AISI 리포트)
- [x] server/mip/runtime-connector.ts — Runtime Connector (ROS2/MQTT/WebSocket, Kill Switch)
- [x] server/mip/safety-monitor.ts — Safety Monitor (5계층 모니터링, 이상 감지, Soma 전송)
- [x] server/mip/implantation-engine.ts — 8단계 이식 프로세스 상태 전이 엔진

## Phase 4: tRPC 라우터 완성
- [x] server/routers/mip.ts — 디바이스, 이식(8단계), Sandbox, Safety, 정책, 외부연동, 감사, 대시보드 통합 라우터
- [x] server/routers.ts 업데이트 — mipRouter 통합

## Phase 5: 관리자 대시보드 UI
- [x] client/src/index.css — 다크 테마 기반 대시보드 스타일 설정
- [x] client/src/App.tsx — MIPLayout 기반 라우팅 구성
- [x] client/src/pages/LandingPage.tsx — 공개 랜딩 페이지
- [x] client/src/pages/Dashboard.tsx — 이식 현황 요약 대시보드
- [x] client/src/pages/DevicesPage.tsx — 디바이스 목록 및 등록
- [x] client/src/pages/ImplantationsPage.tsx — 이식 이력 및 8단계 진행 현황
- [x] client/src/pages/SandboxPage.tsx — Sandbox 검증 결과 및 리포트
- [x] client/src/pages/SafetyPage.tsx — Safety Monitor 로그
- [x] client/src/pages/RedteamPage.tsx — Red-teaming 테스트 인터페이스 (AISI)
- [x] client/src/pages/PoliciesPage.tsx — Ethical Boundary 정책 관리
- [x] client/src/pages/AuditPage.tsx — 감사 체인 페이지

## Phase 6: Vitest 테스트
- [x] server/lib/hmac.test.ts — HMAC 서명/검증 단위 테스트 (12 tests)
- [x] server/lib/did.test.ts — DID 서명 검증 단위 테스트 (8 tests)
- [x] server/mip/ethical-boundary.test.ts — 5개 정책 적용, 정책 합성, 위반 감지 (19 tests)
- [x] server/mip/simulation-sandbox.test.ts — Red-teaming 시나리오 테스트 (6 tests)
- [x] server/mip/safety-monitor.test.ts — 이상 감지, 경보, 5계층 신호 (12 tests)
- [x] server/mip/implantation-engine.test.ts — 8단계 이식 프로세스 통합 테스트 (11 tests)
- [x] server/routers/mip.test.ts — MIP tRPC 라우터 통합 테스트 (10 tests)
- [x] server/auth.logout.test.ts — 인증 로그아웃 테스트 (1 test)

## Phase 7: 최종 검증
- [x] TypeScript 오류 제로 (pnpm check 통과)
- [x] 전체 79개 테스트 통과 (8개 테스트 파일)

## WO-MIP-2026-002: Soma ↔ MIP 연동 인터페이스

- [x] DB 스키마 추가: soma_webhook_events, mip_webhook_dlq 테이블
- [x] 환경변수 등록: SOMA_MIP_SHARED_SECRET, MIP_SOMA_SHARED_SECRET, SOMA_WEBHOOK_URL, SOMA_SERVICE_URL
- [x] HMAC 서명 검증 미들웨어 (Replay Attack ±5분 방지 포함)
- [x] 공통 Soma Webhook 발신 함수 (재시도 3회 + DLQ 저장)
- [x] 수신 인터페이스 1: POST /api/soma/webhook/implant-approved (이식 승인 이벤트)
- [x] 수신 인터페이스 2: POST /api/soma/devices/register (디바이스 등록)
- [x] 수신 인터페이스 3: GET /api/soma/implant/:id/status (이식 상태 조회)
- [x] 수신 인터페이스 4: POST /api/soma/sessions/:id/kill (Kill Switch)
- [x] 발신 콜백 1: mip_implant_progress (이식 단계별 진행 상태)
- [x] 발신 콜백 2: mip_safety_alert (Safety Monitor 이상 이벤트)
- [x] 발신 콜백 3: mip_live_activated (Live Activation 완료)
- [x] 발신 콜백 4: mip_session_terminated (세션 종료)
- [x] DLQ 재시도 배치 작업 (5분 간격)
- [x] Vitest 단위 테스트: soma-webhook-receiver, soma-webhook-sender, implant-approval-handler, kill-switch-handler

## WO-MIP-2026-003: Lore ↔ MIP 연동 인터페이스

- [x] DB 스키마 추가: lore_package_events, mip_lore_webhook_dlq, mip_package_refresh_requests 테이블
- [x] 환경변수 등록: LORE_MIP_SHARED_SECRET, MIP_LORE_SHARED_SECRET, LORE_WEBHOOK_URL, LORE_SERVICE_URL
- [x] HMAC 서명 검증 미들웨어 구현 (Lore 전용, Replay Attack ±5분 방지)
- [x] 공통 Lore Webhook 발신 함수 구현 (재시도 3회 + DLQ 저장)
- [x] 수신 인터페이스 1: POST /api/lore/packages/submit (MIO Package 전송 수신)
- [x] 수신 인터페이스 2: POST /api/lore/packages/update (Package 갱신 알림)
- [x] 수신 인터페이스 3: POST /api/lore/packages/revoke (Package 철회 요청)
- [x] 수신 인터페이스 4: POST /api/lore/packages/dna-ready (DNA 재생성 완료 알림)
- [x] 발신 콜백 1: mip_package_received (Package 수신 확인)
- [x] 발신 콜백 2: mip_package_validation_failed (Package 검증 실패 알림)
- [x] 발신 콜백 3: mip_implant_result (이식 완료 결과 보고)
- [x] 발신 콜백 4: Package 갱신 요청 REST API
- [x] DLQ 재시도 배치 작업 (5분 간격, 최대 10회)
- [x] Vitest 단위 테스트: lore-hmac-middleware, lore-package-receiver, lore-webhook-sender, lore-package-revoke, lore-package-refresh

## 연동 상태 모니터링 패널 (대시보드)

- [x] tRPC 프로시저: mip.integration.status (Lore·Soma DLQ 건수, 최근 이벤트 이력)
- [x] tRPC 프로시저: mip.integration.events (최근 50건 Webhook 이벤트 목록)
- [x] UI: IntegrationStatusPanel 컴포넌트 (DLQ 건수 카드, 연동 상태 배지)
- [x] UI: WebhookEventTable 컴포넌트 (최근 이벤트 이력 테이블, 성공/실패 구분)
- [x] 대시보드 페이지에 연동 상태 패널 통합
- [x] Vitest 테스트: integration.status 프로시저

## 안전 보강 작업 (Safety Reinforcement Framework v1.0)

- [x] Physical Action Tier 0~4 분류 기반 승인 시스템 구현 (DB 스키마 + tRPC + UI)
- [x] Emotional Dependency Risk 감지 및 경고 시스템 구현 (DNA 감정 지표 기반)
- [x] DNA Rollback 기능 구현 (Package 버전 관리 + 롤백 UI)
- [x] server/mip/safety-reinforcement.test.ts — 10개 테스트 (Physical Action 6개, Emotional Risk 4개)
- [x] GuidePage.tsx에 PSDI Safety Reinforcement v1.0 섹션 추가 (기존 vs 보강 후 비교표 + 보강 1~3 상세 설명)

## Phase 10: PSDI v2.0 §14 Runtime Isolation Layer 전체 통합

- [x] DB 스키마 4개 추가 (mip_core_identities, mip_emotional_bridge_events, mip_isolation_violations, mip_deployment_security)
- [x] isolation-layer.ts — §14.2.3 10개 위반 패턴 감지, §14.4 Core Identity 생성/검증, §14.6 Deployment 보안 초기화
- [x] emotional-bridge.ts — §14.2.5 Bounded Permeable Isolation 4개 채널 (emotional_bridge, context_relay, memory_sync, trust_channel)
- [x] implantation-engine.ts — §14 전체를 8단계에 단계별 통합 (Stage 1~8 각각에 §14 로직 삽입)
- [x] mip.ts 라우터에 isolationLayer 서브라우터 추가 (8개 프로시저)
- [x] IsolationLayerPage.tsx — §14 모니터링 UI (4개 탭: 대시보드/명령검사/Emotional Bridge/위반통계)
- [x] isolation-layer.test.ts — 22개 테스트 (§14.1/§14.2.3/§14.2.5/§14.4/§14.6 전체 커버리지)

## Phase 11: §14 후속 작업 3가지

- [x] §14.6 Distributed Ledger Anchoring — ledger-anchoring.ts + DB 2개 + tRPC + LedgerAnchoringPage.tsx
- [x] ImplantationsPage에 §14 단계별 상태 배지 추가 (Core Identity 생성 완료, Isolation Layer 활성화 등)
- [x] 이용 가이드에 §14.3 심리적 면역체계 신설 섹션 추가 (§14 v1.0 vs v2.0 비교표, 5개 절 상세, 8단계 매핑)

## Phase 12: 사이드바 메뉴 카테고리 그룹화

- [x] MIPLayout.tsx NAV_ITEMS를 4개 그룹으로 재구조화 (이식 관리 / 안전 보강 / 보안·감사 / 설정·가이드)

## Phase 13: 한결(hangyeol) ↔ MIP 서버-투-서버 연동

- [x] MIP server/hangyeol/hmac-middleware.ts — Shared Secret HMAC 인증 미들웨어
- [x] MIP server/hangyeol/hangyeol-router.ts — 7개 REST 엔드포인트
- [x] MIP server/_core/index.ts에 /api/hangyeol/* 라우트 등록
- [x] MIP HANGYEOL_MIP_SHARED_SECRET, MIP_HANGYEOL_SHARED_SECRET 환경변수 설정 (저장 완료)
- [x] server/hangyeol/test-samsung-devices.ts — 삼성 에어콘(AF17B6474WZN) + TV(KQ65QC88AF) 7단계 테스트 스크립트
- [x] server/hangyeol/HANGYEOL_MIP_INTEGRATION_GUIDE.md — 한결 팀 연동 가이드 문서
- [x] test-samsung-devices.ts 하드 실패형 보강 (각 단계 status 검증, 예상 허용/차단 결과 assert, 실패 시 process.exit(1))
- [ ] 실제 mip.mysoma.space 서버에 삼성 에어콘(AF17B6474WZN) 등록 + 이식 시작
- [ ] 실제 mip.mysoma.space 서버에 삼성 TV(KQ65QC88AF) 등록 + 이식 시작
- [ ] checkCommand 허용/차단 시나리오 4개 실제 검증
- [ ] 감사 이력 조회 및 결과 확인

## Phase 14: 이식 모달 MIO 패키지 드롭다운 개선

- [x] IoT 전용 MIO 패키지 DB 시드 (psdi-v2-iot-standard 등 3개)
- [x] 이식 시작 모달에서 패키지 ID를 드롭다운으로 선택하도록 UI 수정
- [x] 패키지 목록 tRPC 쿼리 연결

## Phase 15: 신뢰 검증 실패 수정

- [x] verifyDeviceTrust에서 system/hangyeol-service 소유 디바이스는 모든 인증된 사용자가 사용 가능하도록 수정

## Phase 16: Sandbox 검증 실패 수정 + removeChild 오류 방지

- [x] Sandbox 검증 단계(Stage 7) 실패 원인 분석 및 수정
- [x] removeChild DOM 오류 방지 (이식 목록 리렌더링 안정화)

## Phase 17: 갱신 버튼 활성화

- [x] 이식 상세 패널 갱신 버튼을 항상 클릭 가능하도록 수정
- [x] 이식 목록에 5초 자동 갱신(refetchInterval) 추가
- [x] 멈춤 이식 프로세스 DB에서 실패 상태로 강제 업데이트

## Phase 18: removeChild DOM 오류 근본 수정

- [x] 이식 시작 버튼 클릭 시 removeChild 오류 근본 수정 (Dialog + Select + invalidate 충돌)

## Phase 19: Sandbox AND 게이트 여전히 실패 — 근본 수정

- [x] Sandbox 5항목 AND 게이트 검증에서 IoT 디바이스가 확실히 통과하도록 수정 (emotionalRange 0.7→0.95)

## Phase 20: removeChild 완전 제거 — Dialog를 인라인 패널로 교체

- [x] 이식 시작 모달을 Dialog에서 조건부 인라인 Card 패널로 변경하여 Portal 충돌 완전 제거

## Phase 20.5: 액션 타입 전체 선택 옵션

- [x] 액션 요청 테스트 페이지에서 '전체 액션 요청' 옵션 추가 (모든 타입 순차 실행)

## Phase 21: HMAC 서명 오류 해결 (한결 → MIP)

- [x] HANGYEOL_MIP_SHARED_SECRET 환경변수를 한결 서비스 시크릿(5a22f117...)으로 업데이트
- [x] HMAC 서명 검증 정상 동작 확인 (4개 테스트 통과)

## Phase 22: 안전 보강/보안 페이지 디바이스 연동 개선

- [x] 공통 DeviceSelector 컴포넌트 생성 (이식 완료 디바이스 드롭다운 + DeviceBadge)
- [x] 정서적 위험 페이지에 디바이스 선택 연동 (선택 시 해당 디바이스 이식 DNA 지표 자동 로드)
- [x] 물리적 행동 페이지에 디바이스 선택 + 명칭 표시 연동
- [x] DNA 롤백 페이지에 디바이스 선택 연동 (선택 시 packageId 자동 조회)
- [x] 레드팀 페이지에 디바이스 선택 연동
- [x] §14 격리층 페이지에 디바이스 선택 연동

## Phase 23: MIO 패키지 요청 기능 (LORE 연동)

- [x] MIO 패키지 페이지에 LORE 패키지 요청 버튼 추가 (8자아 선택/전체선택)
- [x] LORE → MIP 전송 Webhook 수신 코드 정상 동작 확인 (receivers.ts 정상)
- [x] 패키지 요청 시 LORE API로 요청 전송하는 백엔드 프로시저 구현 (packages.requestFromLore)

## Phase 24: 메시지 안심 (피싱 판정) 기능 구현

- [x] DB 스키마: mip_message_checks 테이블 추가 (피싱 판정 이력)
- [x] server/mip/message-safety.ts — 피싱 판정 엔진 (패턴 DB + 점수 산출 + 판정)
- [x] 한결 API: POST /api/hangyeol/message/check — 메시지 안전 검사 엔드포인트
- [x] 한결 API: GET /api/hangyeol/message/history — 메시지 검사 이력 조회
- [x] 한결 API: POST /api/hangyeol/message/:id/approve — 보류 메시지 승인
- [x] 한결 API: POST /api/hangyeol/message/:id/reject — 보류 메시지 차단
- [x] server/mip/message-safety.test.ts — 피싱 판정 엔진 테스트 (14개 통과)
- [x] 헬스체크 엔드포인트 목록 업데이트

## Phase 25: 삼성 에어컨/TV Mock API (로컬 모의 테스트)

- [x] server/hangyeol/mock-samsung-test.ts — Mock 시나리오 실행 스크립트 (디바이스 등록→이식→명령 검증→감사 이력)
- [x] server/hangyeol/mock-samsung-test.test.ts — Mock 시나리오 Vitest 테스트 (19개 통과)
- [x] 삼성 에어컨(AF17B6474WZN) 등록 + 이식 + checkCommand 허용/차단 4개 시나리오 검증
- [x] 삼성 TV(KQ65QC88AF) 등록 + 이식 + checkCommand 허용/차단 4개 시나리오 검증
- [x] 감사 이력 조회 및 결과 확인
- [x] IoT 디바이스 전용 차단 패턴 추가 (OVERRIDE_SAFETY, export_data, modify_core, 어린이 심야 시청)
- [x] 메시지 안심 피싱 판정 Mock 테스트 통합
- [x] Vitest 19개 테스트 케이스 전체 통과

## Phase 26: 채널(Channel) 관리 시스템 — SNS/메신저 분리 등록

- [x] DB 스키마: mip_channels 테이블 추가 (채널 타입, 계정 정보, 보호 수준, 상태)
- [x] server/mip/channel-manager.ts — 채널 등록/해제/목록/설정 변경 로직
- [x] 한결 API: POST /api/hangyeol/channels/register — 채널 등록
- [x] 한결 API: POST /api/hangyeol/channels/:id/disconnect — 채널 해제
- [x] 한결 API: GET /api/hangyeol/channels/list — 채널 목록 조회
- [x] 한결 API: PUT /api/hangyeol/channels/:id/settings — 보호 수준 변경
- [x] 채널 통계 API: GET /api/hangyeol/channels/stats — 채널 통계 조회
- [x] 채널 타입 API: GET /api/hangyeol/channels/types — 지원 채널 타입 정보
- [x] server/mip/channel-manager.test.ts — 채널 관리 Vitest 테스트 (15개 통과)

## Phase 26-b: 메시지 검사 채널 연동

- [x] message/check에서 channelId 입력을 받아 등록된 채널 존재/상태/보호수준 검증 후 검사 수행
- [x] channelId 미존재/비활성/disabled 시 403 CHANNEL_NOT_ALLOWED 에러 처리
- [x] channelId 연동 Vitest 테스트 추가 (19개 통과: 등록 채널 허용, 미등록 403, disconnected 403, 레거시 호환)

## Phase 27: 채널 관리 UI 페이지

- [x] client/src/pages/ChannelsPage.tsx — 채널 목록/등록/해제/설정 변경 UI
- [x] App.tsx에 /channels 라우트 추가
- [x] 사이드바에 "채널 관리" 메뉴 항목 추가
- [x] 채널 등록 폼 (타입 선택, 계정 ID, 표시 이름, 보호 수준)
- [x] 채널 목록 표시 (상태 배지, 보호 수준, 통계)
- [x] 채널 해제/설정 변경 기능

## Phase 28: 채널 이식 자동화 및 한결 자동 전송

- [x] 채널 등록 시 디바이스 등록 → 이식 프로세스 동일 흐름 적용 (기존 방식 유지)
- [x] 이식 완료 후 active 세션 전환 (기존 implantation-engine의 activateRuntime이 webhook 프로토콜 지원)
- [x] POST /api/hangyeol/channel/inbound — 이식 완료 채널 디바이스 메시지 자동 검열
- [x] 검열 결과(피싱/차단/의심)를 한결 웹훅으로 자동 전송 (sendCheckResultToHangyeol)
- [x] 이식 프로세스 페이지에서 채널 타입 디바이스 선택 및 Webhook 프로토콜로 이식 시작 가능
- [x] 채널-이식 연동 Vitest 테스트 (7개 통과, 전체 270개 통과)

## Phase 28b: 채널을 디바이스로 통합

- [x] 디바이스 타입에 채널 타입 추가 (sms, kakaotalk, whatsapp, line, telegram, instagram, rcs)
- [x] 이식 프로세스 "연결 프로토콜" 드롭다운에 채널용 Webhook 옵션 추가
- [x] DevicesPage UI에서 채널 타입 디바이스 등록 가능하도록 수정
- [x] 사이드바에서 "채널 관리" 그룹 제거
- [x] 채널 타입 디바이스도 동일한 8단계 이식 프로세스 적용
- [x] 기존 채널 관련 tRPC 프로시저/페이지 유지 (채널별 세부 설정용)
- [x] /channels 라우트 및 ChannelsPage 제거 (디바이스 통합으로 불필요)
- [x] mip.channels tRPC 프로시저 제거

## Phase 29: 디바이스 등록 폼 — 소프트웨어 선택 시 채널 하위 드롭다운

- [x] 디바이스 유형 드롭다운에서 채널 타입(sms, kakaotalk 등) 직접 노출 제거
- [x] 소프트웨어 선택 시 2차 드롭다운 표시: 일반 / SMS / 카카오톡 / WhatsApp / LINE / Telegram / Instagram DM / RCS
- [x] 채널 선택 시 DID 대신 전화번호/계정 ID 입력 필드로 전환 (DID 자동 생성)
- [x] 등록 시 실제 deviceType에 채널 타입 저장 (기존 백엔드 호환)

## Phase 30: 채널 차단 시스템

- [x] server/mip/channel-blocker.ts — 채널별 차단 액션 로직 (발신자 차단/메시지 격리/삭제)
- [x] 한결 웹훅 페이로드에 blocked, blockAction, blockActionId 필드 추가
- [x] channel/inbound 흐름에서 위험 감지 시 자동 차단 실행 후 결과 포함 전송
- [x] POST /api/hangyeol/channel/unblock — 한결이 차단 해제 요청하는 역방향 API
- [x] DB: mip_block_actions 테이블 (차단 이력 관리)
- [x] Vitest 테스트 (18개 channel-blocker + 7개 channel-inbound)
- [x] SMS/RCS 채널도 차단 시스템에 완전 통합 (어댑터 + 테스트 검증)

## Phase 31: YouTube 채널 타입 추가

- [x] DB 스키마 deviceType enum에 youtube 추가 + 마이그레이션
- [x] hangyeol-router.ts 디바이스 등록 유효성 검증에 youtube 추가
- [x] channel-blocker.ts에 YouTube Data API v3 어댑터 구현 (댓글 삭제/스팸 신고/사용자 차단/라이브챗 밴)
- [x] channel/inbound에서 youtube 채널 타입 인식
- [x] DevicesPage UI 소프트웨어 하위 드롭다운에 YouTube 옵션 추가
- [x] Vitest 테스트 (YouTube 어댑터 차단/해제) — 20개 통과

## Phase 32: YouTube OAuth 2.0 인증 연동
- [x] 환경변수 등록 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [x] YouTube OAuth 백엔드 엔드포인트 (인증 URL 생성 + 콜백 처리 + 토큰 저장)
- [x] DB에 OAuth 토큰 저장 (mip_channels.connectionConfig에 access_token/refresh_token)
- [x] 프론트엔드 YouTube 인증 버튼 (디바이스 관리 페이지)
- [x] channel-blocker에서 저장된 OAuth 토큰으로 실제 YouTube API 호출
- [x] 토큰 만료 시 자동 갱신 (refresh_token 사용)
- [x] Vitest 테스트 (8개 통과)
## Bugfix: RequestPackageDialog insertBefore 크래시
- [x] Dialog 닫힘과 Sonner toast 표시가 동시에 발생하여 React DOM 트리 불일치 (NotFoundError: insertBefore) — onSuccess/onError에서 onClose() 먼저 호출 후 setTimeout(150ms)으로 toast 지연 표시
- [x] insertBefore 크래시 근본 수정 강화 - requestAnimationFrame + setTimeout(300ms) 조합으로 Samsung Internet 등 느린 브라우저 대응
- [x] ErrorBoundary 개선 - DOM 조작 에러(insertBefore/removeChild) 자동 복구 (최대 2회 재시도)
- [x] DevicesPage registerMutation에서도 Dialog 닫기 -> toast 순서 안전하게 변경
- [x] PackageDetailModal 이식 시작 버튼에서도 Dialog 닫기 -> navigation 순서 안전하게 변경
- [x] LORE 패키지 요청 400 에러 수정 - 필수 필드(packageId, reason) 추가, reason을 'user_request'로 변경
- [x] MIO Package listAll에서 validated 필터 제거 - 모든 상태의 패키지를 표시 (8개 모두 보이도록)
- [x] 패키지 검증 로직 완화 — version 5 허용, TTL 밀리초 자동 변환, TTL 초과 경고만 표시, DID identifier 길이 1자 이상 허용, DID signature 만료 7일로 확장
- [x] receivers.ts에서 packageId/userId를 package 내부에 주입 (LORE 호환)
- [x] 기존 invalid 패키지 2개를 validated로 업데이트
- [x] trust_verification 완화 — pending 디바이스에서도 이식 허용 (경고만 로깅)

## Phase 33: MIP Integration Guide 문서

- [x] docs/MIP-Integration-Guide.md 작성 (HMAC 인증, API 스펙, MIO 패키지 스키마, 8단계 이식 흐름, 프로토콜 옵션, 테스트 시나리오, 환경 변수)

## Phase 34: 안전 모니터 페이지 디바이스 연동 보강

- [x] 안전 모니터: 디바이스 선택 시 해당 디바이스의 로그/세션만 필터링 표시
- [x] 안전 모니터: 이식 완료된 디바이스 자동 선택 (첫 번째 디바이스 자동 연결)

## Phase 35: 보안/감사 페이지 디바이스 연동

- [x] 경계 정책(PoliciesPage): DeviceSelector 추가 + 미선택 시 데이터 숨김
- [x] 레드팀(RedteamPage): 미선택 시 데이터 숨김 + 연결 배너 추가
- [x] 감사 체인(AuditPage): DeviceSelector 추가 + 미선택 시 데이터 숨김
- [x] §14 격리층(IsolationLayerPage): 미선택 시 데이터 숨김 + 연결 배너 추가
- [x] §14.6 원장 고정(LedgerAnchoringPage): DeviceSelector 추가 + 미선택 시 데이터 숨김

## Phase 36: 2차 인증 게이트 (접근 코드)

- [x] 로그인 후 고정 코드 "2148782859" 입력 시 대시보드 진입하는 2차 인증 게이트 구현

## Phase 36: Mock MIO 패키지 생성 기능

- [x] MIP 자체에서 Mock MIO 패키지 생성 프로시저 추가 (LORE 없이 테스트 가능)
- [x] 프론트엔드에 Mock 패키지 생성 버튼/UI 추가
- [x] server/routers/mock-package.test.ts — Mock 패키지 생성 프로시저 테스트 (5개 통과)

## Phase 37: LORE 웹훅 수신 500 에러 수정
- [x] DID 서명 검증에서 signature.created 밀리초 자동 변환 (did.ts)
- [x] DID proof 형식 검증 완화: hex 외 base64/JWT 형식도 허용 (did.ts)
- [x] handlePackageSubmit에 전체 try-catch 추가 (receivers.ts)
- [x] 로컬+배포 서버에서 LORE 형식 payload 202 성공 확인
- [x] 이식 페이지: MIO Package가 1개일 때 자동 선택 + 드롭다운 대신 고정 표시
- [x] GET /api/hangyeol/mio/package?implantationId={id} 엔드포인트 추가 (Runtime Persona 조회)
- [x] 이식 완료 시 한결에 mip_implant_completed 콜백 전송 (implantationId, deviceId, packageId 포함)
- [x] 이식 카드 및 이식 상세에 MIO 패키지(런타임 페르소나) 이름 표시

## AI Agent 타입 추가 + SDK 연계 현황 모니터링

- [x] AI Agent 디바이스 타입 스키마 추가 (device_type enum에 ai_agent 추가)
- [x] DB 마이그레이션 실행 (mip_devices device_type enum 변경)
- [x] isolation-layer.ts에 ai_agent 보안 등급 enhanced 분기 추가
- [x] SDK 연계 현황 집계 tRPC API 추가 (일별/서비스별 호출 수, 이식 현황, 차단 건수)
- [x] SdkMonitorPage.tsx — SDK 연계 현황 모니터링 페이지 구현
- [x] 사이드바 네비게이션에 SDK 연계 현황 메뉴 추가

## 스폰지(Sponge) SDK 연계 현황 표시

- [x] 스폰지가 LORE 경유 간접 연결 구조임을 확인 (MIP 데이터 모델에 별도 식별자 없음)
- [x] sdkMonitor.lorePackageStats 프로시저 추가 (LORE 패키지 이벤트 통계, 스폰지 포함)
- [x] sdkMonitor.connectedServices 프로시저 추가 (연계 서비스 목록 + 스폰지 간접 연결 표시)
- [x] SdkMonitorPage.tsx에 "연계 서비스 현황" 카드 추가 (직접/간접 연결 구분 표시)
- [x] SdkMonitorPage.tsx에 "LORE 패키지" 탭 추가 (스폰지 → LORE → MIP 연결 구조도 포함)
- [x] sdk-monitor.test.ts에 lorePackageStats, connectedServices 테스트 추가 (10개 통과)

## 작업 C: 판단 코어(Decision Core) 표준 라이브러리 구현

- [x] shared/decision-core-types.ts — 핵심 타입 정의 (ImmutableValue, Authority, StageResult<T>, HaltReason, PersonaDecision, ValueSlot, Identity, MemoryRef 등)
- [x] server/mip/decision-core/load-value.ts — 1단계: 가치 로드 (HMAC 검증 + Readonly 동결, G1)
- [x] server/mip/decision-core/load-identity.ts — 2단계: 정체성 로드 (Authority 범위 한정)
- [x] server/mip/decision-core/retrieve-memory.ts — 3단계: 기억 인출 (externalBlocked 슬롯 제외, G5)
- [x] server/mip/decision-core/resolve-intent.ts — 4단계: 의도-권한 판정 (AUTHORITY_EXCEEDED halt, G3)
- [x] server/mip/decision-core/interpret-context.ts — 5단계: 상황-위험·주입 탐지 (INJECTION_DETECTED halt, G4)
- [x] server/mip/decision-core/reason.ts — 6단계: 추론-가치 고정 평가 (RISK_IRREVERSIBLE halt, G1/G2)
- [x] server/mip/decision-core/calibrate.ts — 7단계: 감정-확신도 캘리브레이션 (LOW_CONFIDENCE halt, G6)
- [x] server/mip/decision-core/act.ts — 8단계: 행동-실행 또는 정지 출력
- [x] server/mip/decision-core/index.ts — runDecisionCore 오케스트레이션 함수
- [x] 한결 API 연동: POST /api/hangyeol/decision/run — 판단 코어 실행 엔드포인트
- [x] server/mip/decision-core/decision-core.test.ts — Vitest 테스트 (G1~G6 불변식 + 재현성 검증)

## 작업 D: 디시즌 코어 프론트엔드 메뉴 추가

- [x] tRPC 라우터에 decisionCore 프로시저 추가 (테스트 실행, 로그 조회)
- [x] DecisionCorePage.tsx 페이지 구현 (8단계 흐름 시각화, 테스트 실행, 로그)
- [x] DashboardLayout 사이드바 메뉴에 디시즌 코어 항목 추가
- [x] App.tsx 라우팅 등록

## 버그 수정: Decision Core 페이지

- [x] NotFoundError: insertBefore 에러 해결 (Decision Core 페이지 렌더링 오류) - React 19 + Sonner flushSync 충돌, queueMicrotask로 해결
- [x] "의사결정 핵심" 메뉴를 "SDK 연계 현황" 앞으로 이동 (이식 관리 그룹)
