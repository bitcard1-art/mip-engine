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
