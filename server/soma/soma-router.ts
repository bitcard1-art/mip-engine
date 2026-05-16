/**
 * Soma → MIP 수신 인터페이스 Express 라우터
 * WO-MIP-2026-002 §3
 *
 * 모든 엔드포인트는 HMAC 검증 미들웨어를 통과해야 함
 */
import { Router } from "express";
import { somaHmacMiddleware } from "./hmac-middleware";
import {
  handleImplantApproved,
  handleDeviceRegister,
  getImplantStatus,
  handleKillSwitch,
  type ImplantApprovedPayload,
  type DeviceRegisterRequest,
  type KillSwitchRequest,
} from "./receivers";

const somaRouter = Router();

// ─── 인터페이스 1: 이식 승인 이벤트 수신 ────────────────────────────────────
// POST /api/soma/webhook/implant-approved
somaRouter.post(
  "/webhook/implant-approved",
  somaHmacMiddleware,
  async (req, res) => {
    try {
      const payload = req.body as ImplantApprovedPayload;

      if (!payload.eventId || !payload.userId || !payload.deviceId || !payload.packageId) {
        res.status(400).json({ status: "rejected", code: "MISSING_FIELDS", message: "필수 필드가 누락되었습니다." });
        return;
      }

      const result = await handleImplantApproved(payload);

      if (result.status === "accepted") {
        res.status(202).json(result);
      } else if (result.status === "already_processed") {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (err) {
      console.error("[Soma] 이식 승인 처리 오류:", err);
      res.status(500).json({ status: "error", message: "내부 서버 오류", retryable: true });
    }
  }
);

// ─── 인터페이스 2: 디바이스 등록 요청 수신 ──────────────────────────────────
// POST /api/soma/devices/register
somaRouter.post(
  "/devices/register",
  somaHmacMiddleware,
  async (req, res) => {
    try {
      const body = req.body as DeviceRegisterRequest;

      if (!body.userId || !body.did || !body.deviceType || !body.deviceName) {
        res.status(400).json({ error: "MISSING_FIELDS", message: "필수 필드가 누락되었습니다." });
        return;
      }

      const result = await handleDeviceRegister(body);

      if (result.status === "already_registered") {
        res.status(200).json(result);
      } else {
        res.status(201).json(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "Invalid DID Document") {
        res.status(400).json({ error: "INVALID_DID", message: "DID Document가 유효하지 않습니다." });
      } else {
        console.error("[Soma] 디바이스 등록 오류:", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
      }
    }
  }
);

// ─── 인터페이스 3: 이식 상태 조회 ───────────────────────────────────────────
// GET /api/soma/implant/:implantationId/status
somaRouter.get(
  "/implant/:implantationId/status",
  somaHmacMiddleware,
  async (req, res) => {
    try {
      const { implantationId } = req.params;
      const requestUserId = req.headers["x-user-id"] as string | undefined;

      const result = await getImplantStatus(implantationId, requestUserId);

      if (!result) {
        res.status(404).json({ error: "NOT_FOUND", message: "이식 작업을 찾을 수 없습니다." });
        return;
      }

      res.status(200).json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "FORBIDDEN") {
        res.status(403).json({ error: "FORBIDDEN", message: "접근 권한이 없습니다." });
      } else {
        console.error("[Soma] 이식 상태 조회 오류:", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
      }
    }
  }
);

// ─── 인터페이스 4: Kill Switch 요청 수신 ────────────────────────────────────
// POST /api/soma/sessions/:sessionId/kill
somaRouter.post(
  "/sessions/:sessionId/kill",
  somaHmacMiddleware,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const body = req.body as KillSwitchRequest;

      if (!body.userId || !body.reason) {
        res.status(400).json({ error: "MISSING_FIELDS", message: "userId와 reason이 필요합니다." });
        return;
      }

      const result = await handleKillSwitch(sessionId, body);
      res.status(200).json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "FORBIDDEN") {
        res.status(403).json({ error: "FORBIDDEN", message: "본인 세션만 종료할 수 있습니다." });
      } else if (msg === "SESSION_NOT_FOUND") {
        res.status(404).json({ error: "NOT_FOUND", message: "세션을 찾을 수 없습니다." });
      } else {
        console.error("[Soma] Kill Switch 처리 오류:", err);
        res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
      }
    }
  }
);

export default somaRouter;
