/**
 * Lore → MIP 수신 인터페이스 Express 라우터
 * WO-MIP-2026-003 §3
 *
 * 모든 엔드포인트는 loreHmacMiddleware를 통해 HMAC 검증 후 처리됩니다.
 */
import { Router } from "express";
import { loreHmacMiddleware } from "./hmac-middleware";
import {
  handlePackageSubmit,
  handlePackageUpdate,
  handlePackageRevoke,
  handleDNAReady,
} from "./receivers";

const router = Router();

// ─── 수신 인터페이스 1: MIO Package 전송 수신 ────────────────────────────────
// POST /api/lore/packages/submit
router.post("/packages/submit", loreHmacMiddleware, handlePackageSubmit);

// ─── 수신 인터페이스 2: Package 갱신 알림 ───────────────────────────────────
// POST /api/lore/packages/update
router.post("/packages/update", loreHmacMiddleware, handlePackageUpdate);

// ─── 수신 인터페이스 3: Package 철회 요청 ───────────────────────────────────
// POST /api/lore/packages/revoke
router.post("/packages/revoke", loreHmacMiddleware, handlePackageRevoke);

// ─── 수신 인터페이스 4: DNA 재생성 완료 알림 ─────────────────────────────────
// POST /api/lore/packages/dna-ready
router.post("/packages/dna-ready", loreHmacMiddleware, handleDNAReady);

export default router;
