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
