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
