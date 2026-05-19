/**
 * 한결(Hangyeol) ↔ MIP REST API 라우터
 *
 * 한결 서버가 직접 호출하는 7개 엔드포인트:
 *   POST /api/hangyeol/devices/register        → mip.devices.register
 *   POST /api/hangyeol/implant/start           → mip.implant.start
 *   GET  /api/hangyeol/implant/status/:id      → mip.implant.status
 *   POST /api/hangyeol/policies/evaluate       → mip.policies.evaluate
 *   POST /api/hangyeol/isolation/check-command → mip.isolationLayer.checkCommand
 *   POST /api/hangyeol/physical-action/request → mip.physicalAction.request
 *   GET  /api/hangyeol/audit/list              → mip.audit.list
 *
 * 인증: HMAC-SHA256 (X-Service-ID: hangyeol, X-Timestamp, X-Signature)
 * 서비스 계정 userId: "hangyeol-service"
 */
import { Router } from "express";
import { hangyeolHmacMiddleware } from "./hmac-middleware";
import { getDb } from "../db";
import {
  mipDevices,
  mipImplantations,
  mipSafetyLogs,
} from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { startImplantation, getImplantationStatus } from "../mip/implantation-engine";
import { checkIsolationLayer } from "../mip/isolation-layer";
import { requestPhysicalAction } from "../mip/physical-action-engine";
import { getActivePolicies, evaluateAllPolicies, composePolicies } from "../mip/ethical-boundary";
import {
  checkMessageSafety,
  getMessageHistory,
  approveMessage,
  rejectMessage,
  getMessageStats,
  type MessageCheckInput,
} from "../mip/message-safety";
import {
  registerChannel,
  disconnectChannel,
  listChannels,
  updateChannelSettings,
  getChannelStats,
  getChannelProtectionLevel,
  incrementCheckCount,
  CHANNEL_INFO,
  type RegisterChannelInput,
  type UpdateChannelSettingsInput,
} from "../mip/channel-manager";
import { sendCheckResultToHangyeol } from "./webhook-sender";

const hangyeolRouter = Router();

// 서비스 계정 ID (한결 서버 요청에 사용되는 고정 userId)
const HANGYEOL_SERVICE_USER_ID = "hangyeol-service";

// ─── 1. 디바이스 등록 ────────────────────────────────────────────────────────
// POST /api/hangyeol/devices/register
hangyeolRouter.post(
  "/devices/register",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { deviceType, deviceName, did, metadata } = req.body as {
        deviceType: "humanoid" | "iot" | "software" | "sms" | "kakaotalk" | "whatsapp" | "line" | "telegram" | "instagram" | "rcs";
        deviceName: string;
        did: string;
        metadata?: Record<string, unknown>;
      };

      if (!deviceType || !deviceName || !did) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "deviceType, deviceName, did 필드가 필요합니다.",
        });
        return;
      }

      const validDeviceTypes = ["humanoid", "iot", "software", "sms", "kakaotalk", "whatsapp", "line", "telegram", "instagram", "rcs"];
      if (!validDeviceTypes.includes(deviceType)) {
        res.status(400).json({
          error: "INVALID_DEVICE_TYPE",
          message: `deviceType은 ${validDeviceTypes.join(', ')} 중 하나여야 합니다.`,
        });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB_UNAVAILABLE" });
        return;
      }

      const deviceId = nanoid();
      const now = Date.now();

      await db.insert(mipDevices).values({
        id: deviceId,
        userId: HANGYEOL_SERVICE_USER_ID,
        deviceType,
        deviceName,
        did,
        trustLevel: 0,
        status: "pending",
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        createdAt: now,
      });

      res.status(201).json({
        success: true,
        deviceId,
        message: "디바이스가 등록되었습니다. DID 신뢰 검증 후 활성화됩니다.",
      });
    } catch (err) {
      console.error("[Hangyeol] 디바이스 등록 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 2. 이식 시작 ────────────────────────────────────────────────────────────
// POST /api/hangyeol/implant/start
hangyeolRouter.post(
  "/implant/start",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { deviceId, packageId, protocol, endpoint } = req.body as {
        deviceId: string;
        packageId: string;
        protocol?: "ros2" | "mqtt" | "websocket";
        endpoint?: string;
      };

      if (!deviceId || !packageId) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "deviceId, packageId 필드가 필요합니다.",
        });
        return;
      }

      const validProtocol: "ros2" | "mqtt" | "websocket" =
        protocol && ["ros2", "mqtt", "websocket"].includes(protocol)
          ? protocol
          : "mqtt";

      const result = await startImplantation({
        userId: HANGYEOL_SERVICE_USER_ID,
        deviceId,
        packageId,
        protocol: validProtocol,
        endpoint: endpoint ?? "hangyeol-service",
      });

      res.status(202).json({ success: true, ...result });
    } catch (err) {
      console.error("[Hangyeol] 이식 시작 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 3. 이식 상태 조회 ───────────────────────────────────────────────────────
// GET /api/hangyeol/implant/status/:implantationId
hangyeolRouter.get(
  "/implant/status/:implantationId",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { implantationId } = req.params;
      const status = await getImplantationStatus(implantationId);

      if (!status) {
        res.status(404).json({ error: "NOT_FOUND", message: "이식 세션을 찾을 수 없습니다." });
        return;
      }

      res.json({ success: true, ...status });
    } catch (err) {
      console.error("[Hangyeol] 이식 상태 조회 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 4. 정책 평가 ────────────────────────────────────────────────────────────
// POST /api/hangyeol/policies/evaluate
hangyeolRouter.post(
  "/policies/evaluate",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { input, implantationId, deviceContext } = req.body as {
        input: string;
        implantationId?: string;
        deviceContext?: Record<string, unknown>;
      };

      if (!input) {
        res.status(400).json({ error: "MISSING_FIELDS", message: "input 필드가 필요합니다." });
        return;
      }

      const policies = await getActivePolicies(HANGYEOL_SERVICE_USER_ID, implantationId);
      const violations = evaluateAllPolicies(input, policies);
      const composite = composePolicies(policies);

      res.json({
        success: true,
        allowed: violations.length === 0,
        violations,
        composite,
        deviceContext: deviceContext ?? null,
      });
    } catch (err) {
      console.error("[Hangyeol] 정책 평가 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 5. 명령 안전 검사 (핵심) ────────────────────────────────────────────────
// POST /api/hangyeol/isolation/check-command
hangyeolRouter.post(
  "/isolation/check-command",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { command, sessionId, implantationId, stage, deviceId, deviceType } = req.body as {
        command: string;
        sessionId?: string;
        implantationId?: string;
        stage?: string;
        deviceId?: string;
        deviceType?: string;
      };

      if (!command) {
        res.status(400).json({ error: "MISSING_FIELDS", message: "command 필드가 필요합니다." });
        return;
      }

      const result = await checkIsolationLayer(command, {
        sessionId,
        implantationId,
        userId: HANGYEOL_SERVICE_USER_ID,
        stage,
      });

      // 차단된 경우 403, 허용된 경우 200
      const statusCode = result.allowed ? 200 : 403;
      res.status(statusCode).json({
        success: true,
        allowed: result.allowed,
        violationType: result.violationType ?? null,
        severity: result.severity ?? null,
        reason: result.reason ?? null,
        permeable: result.permeable ?? false,
        sanitizedCommand: result.sanitizedCommand ?? null,
        deviceId: deviceId ?? null,
        deviceType: deviceType ?? null,
        command,
        checkedAt: Date.now(),
      });
    } catch (err) {
      console.error("[Hangyeol] 명령 검사 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 6. Physical Action 승인 요청 ────────────────────────────────────────────
// POST /api/hangyeol/physical-action/request
hangyeolRouter.post(
  "/physical-action/request",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { actionType, deviceId, sessionId, actionPayload, contextSnapshot } = req.body as {
        actionType: string;
        deviceId?: string;
        sessionId?: string;
        actionPayload?: Record<string, unknown>;
        contextSnapshot?: Record<string, unknown>;
      };

      if (!actionType) {
        res.status(400).json({ error: "MISSING_FIELDS", message: "actionType 필드가 필요합니다." });
        return;
      }

      const result = await requestPhysicalAction({
        userId: HANGYEOL_SERVICE_USER_ID,
        actionType,
        deviceId,
        sessionId,
        actionPayload,
        contextSnapshot,
      });

      res.status(202).json({ success: true, ...result });
    } catch (err) {
      console.error("[Hangyeol] Physical Action 요청 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 7. 감사 이력 조회 ───────────────────────────────────────────────────────
// GET /api/hangyeol/audit/list?limit=50&deviceId=xxx
hangyeolRouter.get(
  "/audit/list",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
      const deviceId = req.query.deviceId as string | undefined;

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB_UNAVAILABLE" });
        return;
      }

      const logs = await db
        .select()
        .from(mipSafetyLogs)
        .where(eq(mipSafetyLogs.userId, HANGYEOL_SERVICE_USER_ID))
        .orderBy(desc(mipSafetyLogs.createdAt))
        .limit(limit);

      // deviceId 필터링 (metaJson 기반)
      const filtered = deviceId
        ? logs.filter(log => {
            try {
              const meta = JSON.parse(log.metaJson ?? "{}");
              return meta.deviceId === deviceId;
            } catch {
              return false;
            }
          })
        : logs;

      res.json({
        success: true,
        total: filtered.length,
        logs: filtered,
      });
    } catch (err) {
      console.error("[Hangyeol] 감사 이력 조회 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 8. 메시지 안전 검사 ────────────────────────────────────────────────────
// POST /api/hangyeol/message/check
hangyeolRouter.post(
  "/message/check",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { channel, channelId, senderNumber, senderName, messageContent, messageUrl, sessionId, deviceId } = req.body as {
        channel: MessageCheckInput["channel"];
        channelId?: string;
        senderNumber?: string;
        senderName?: string;
        messageContent: string;
        messageUrl?: string;
        sessionId?: string;
        deviceId?: string;
      };

      if (!channel || !messageContent) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "channel, messageContent 필드가 필요합니다.",
        });
        return;
      }

      // channelId가 제공된 경우 채널 존재/상태/보호수준 검증
      if (channelId) {
        const protection = await getChannelProtectionLevel(channelId);
        if (!protection.allowed) {
          res.status(403).json({
            error: "CHANNEL_NOT_ALLOWED",
            message: protection.error || "채널이 검사를 허용하지 않습니다.",
            protectionLevel: protection.protectionLevel,
          });
          return;
        }
      }

      const result = await checkMessageSafety({
        userId: HANGYEOL_SERVICE_USER_ID,
        sessionId,
        deviceId,
        channel,
        senderNumber,
        senderName,
        messageContent,
        messageUrl,
      });

      // channelId가 있으면 검사 카운터 증가
      if (channelId) {
        const blocked = result.verdict === "blocked" || result.verdict === "phishing";
        await incrementCheckCount(channelId, blocked);
      }

      // 피싱/차단/의심 판정 시 한결에 자동 전송 (safe 제외)
      if (result.verdict !== "safe") {
        sendCheckResultToHangyeol({
          checkId: result.checkId,
          channelId,
          deviceId,
          channel,
          senderNumber,
          senderName,
          messageContent,
          riskScore: result.riskScore,
          verdict: result.verdict,
          verdictReason: result.verdictReason,
          scores: result.scores,
          action: result.action,
          timestamp: Date.now(),
        }).catch((err) => {
          console.error("[Hangyeol] 한결 웹훅 전송 오류:", err);
        });
      }

      // 차단/피싱이면 403, 나머지 200
      const statusCode = result.verdict === "blocked" || result.verdict === "phishing" ? 403 : 200;
      res.status(statusCode).json({ success: true, ...result });
    } catch (err) {
      console.error("[Hangyeol] 메시지 안전 검사 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 9. 메시지 검사 이력 조회 ───────────────────────────────────────────────
// GET /api/hangyeol/message/history?channel=sms&verdict=phishing&limit=50
hangyeolRouter.get(
  "/message/history",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const channel = req.query.channel as string | undefined;
      const verdict = req.query.verdict as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);

      const history = await getMessageHistory({
        userId: HANGYEOL_SERVICE_USER_ID,
        channel,
        verdict,
        limit,
      });

      const stats = await getMessageStats(HANGYEOL_SERVICE_USER_ID);

      res.json({
        success: true,
        total: history.length,
        stats,
        history,
      });
    } catch (err) {
      console.error("[Hangyeol] 메시지 이력 조회 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 10. 보류 메시지 승인 ───────────────────────────────────────────────────
// POST /api/hangyeol/message/:id/approve
hangyeolRouter.post(
  "/message/:id/approve",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const success = await approveMessage(id);

      if (!success) {
        res.status(404).json({ error: "NOT_FOUND", message: "메시지 검사 이력을 찾을 수 없습니다." });
        return;
      }

      res.json({ success: true, checkId: id, action: "approved", actionAt: Date.now() });
    } catch (err) {
      console.error("[Hangyeol] 메시지 승인 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 11. 보류 메시지 차단 ───────────────────────────────────────────────────
// POST /api/hangyeol/message/:id/reject
hangyeolRouter.post(
  "/message/:id/reject",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const success = await rejectMessage(id);

      if (!success) {
        res.status(404).json({ error: "NOT_FOUND", message: "메시지 검사 이력을 찾을 수 없습니다." });
        return;
      }

      res.json({ success: true, checkId: id, action: "rejected", actionAt: Date.now() });
    } catch (err) {
      console.error("[Hangyeol] 메시지 차단 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 헬스체크 ────────────────────────────────────────────────────────────────
// GET /api/hangyeol/health (인증 불필요)
hangyeolRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "mip-hangyeol-api",
    version: "1.1.0",
    timestamp: Date.now(),
    endpoints: [
      "POST /api/hangyeol/devices/register",
      "POST /api/hangyeol/implant/start",
      "GET  /api/hangyeol/implant/status/:id",
      "POST /api/hangyeol/policies/evaluate",
      "POST /api/hangyeol/isolation/check-command",
      "POST /api/hangyeol/physical-action/request",
      "GET  /api/hangyeol/audit/list",
      "POST /api/hangyeol/message/check",
      "GET  /api/hangyeol/message/history",
      "POST /api/hangyeol/message/:id/approve",
      "POST /api/hangyeol/message/:id/reject",
      "POST /api/hangyeol/channels/register",
      "POST /api/hangyeol/channels/:id/disconnect",
      "GET  /api/hangyeol/channels/list",
      "PUT  /api/hangyeol/channels/:id/settings",
      "GET  /api/hangyeol/channels/stats",
      "GET  /api/hangyeol/channels/types",
    ],
  });
});

// ─── 9. 채널 등록 ───────────────────────────────────────────────────────────
// POST /api/hangyeol/channels/register
hangyeolRouter.post(
  "/channels/register",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { channelType, protocol, accountId, displayName, accountMetadata, protectionLevel, connectionConfig, ownerId } = req.body;

      if (!channelType || !accountId) {
        return res.status(400).json({ error: "channelType과 accountId는 필수입니다." });
      }

      const validTypes = ["sms", "kakaotalk", "whatsapp", "line", "telegram", "instagram", "rcs"];
      if (!validTypes.includes(channelType)) {
        return res.status(400).json({ error: `유효하지 않은 channelType: ${channelType}` });
      }

      const input: RegisterChannelInput = {
        channelType,
        protocol,
        accountId,
        displayName,
        accountMetadata,
        protectionLevel,
        connectionConfig,
        ownerId: ownerId || HANGYEOL_SERVICE_USER_ID,
      };

      const channel = await registerChannel(input);
      res.status(201).json({ success: true, channel });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "채널 등록 실패" });
    }
  }
);

// ─── 10. 채널 해제 ──────────────────────────────────────────────────────────
// POST /api/hangyeol/channels/:id/disconnect
hangyeolRouter.post(
  "/channels/:id/disconnect",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { ownerId } = req.body;
      const result = await disconnectChannel(id, ownerId || HANGYEOL_SERVICE_USER_ID);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "채널 해제 실패" });
    }
  }
);

// ─── 11. 채널 목록 조회 ─────────────────────────────────────────────────────
// GET /api/hangyeol/channels/list
hangyeolRouter.get(
  "/channels/list",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { ownerId, channelType, status } = req.query as {
        ownerId?: string;
        channelType?: string;
        status?: string;
      };

      const channels = await listChannels({
        ownerId: ownerId || HANGYEOL_SERVICE_USER_ID,
        channelType: channelType as any,
        status: status as any,
      });

      res.json({ success: true, channels });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "채널 목록 조회 실패" });
    }
  }
);

// ─── 12. 채널 설정 변경 ─────────────────────────────────────────────────────
// PUT /api/hangyeol/channels/:id/settings
hangyeolRouter.put(
  "/channels/:id/settings",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { ownerId, protectionLevel, displayName, connectionConfig } = req.body;

      const settings: UpdateChannelSettingsInput = {};
      if (protectionLevel !== undefined) settings.protectionLevel = protectionLevel;
      if (displayName !== undefined) settings.displayName = displayName;
      if (connectionConfig !== undefined) settings.connectionConfig = connectionConfig;

      const result = await updateChannelSettings(id, ownerId || HANGYEOL_SERVICE_USER_ID, settings);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "채널 설정 변경 실패" });
    }
  }
);

// ─── 13. 채널 통계 ──────────────────────────────────────────────────────────
// GET /api/hangyeol/channels/stats
hangyeolRouter.get(
  "/channels/stats",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { ownerId } = req.query as { ownerId?: string };
      const stats = await getChannelStats(ownerId || HANGYEOL_SERVICE_USER_ID);
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "채널 통계 조회 실패" });
    }
  }
);

// ─── 14. 채널 타입 정보 ─────────────────────────────────────────────────────
// GET /api/hangyeol/channels/types
hangyeolRouter.get(
  "/channels/types",
  hangyeolHmacMiddleware,
  async (_req, res) => {
    res.json({ success: true, types: CHANNEL_INFO });
  }
);

// ─── 15. 채널 디바이스 메시지 수신 (자동 검열) ─────────────────────────────
// POST /api/hangyeol/channel/inbound
// 이식 완료된 채널 디바이스에 메시지가 들어오면 자동 검열 수행
hangyeolRouter.post(
  "/channel/inbound",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const {
        deviceId,
        channelType,
        senderNumber,
        senderName,
        messageContent,
        messageUrl,
      } = req.body as {
        deviceId: string;
        channelType: string;
        senderNumber?: string;
        senderName?: string;
        messageContent: string;
        messageUrl?: string;
      };

      if (!deviceId || !messageContent) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "deviceId, messageContent 필드가 필요합니다.",
        });
        return;
      }

      // 디바이스가 이식 완료된 채널 타입인지 확인
      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB_ERROR", message: "DB 연결 실패" });
        return;
      }

      const [device] = await db
        .select()
        .from(mipDevices)
        .where(eq(mipDevices.id, deviceId))
        .limit(1);

      if (!device) {
        res.status(404).json({ error: "DEVICE_NOT_FOUND", message: "디바이스를 찾을 수 없습니다." });
        return;
      }

      // 채널 타입 디바이스인지 확인
      const channelTypes = ["sms", "kakaotalk", "whatsapp", "line", "telegram", "instagram", "rcs"];
      if (!channelTypes.includes(device.deviceType)) {
        res.status(400).json({
          error: "NOT_CHANNEL_DEVICE",
          message: `디바이스 타입이 채널이 아닙니다: ${device.deviceType}`,
        });
        return;
      }

      // 이식 완료 상태 확인 (active 세션 존재)
      const { mipRuntimeSessions } = await import("../../drizzle/schema");
      const { and } = await import("drizzle-orm");
      const [activeSession] = await db
        .select()
        .from(mipRuntimeSessions)
        .where(
          and(
            eq(mipRuntimeSessions.deviceId, deviceId),
            eq(mipRuntimeSessions.status, "active")
          )
        )
        .limit(1);

      if (!activeSession) {
        res.status(403).json({
          error: "IMPLANTATION_NOT_ACTIVE",
          message: "이식이 완료되지 않았거나 비활성 상태입니다.",
        });
        return;
      }

      // 자동 검열 수행
      const result = await checkMessageSafety({
        userId: device.userId,
        sessionId: activeSession.id,
        deviceId,
        channel: (channelType || device.deviceType) as MessageCheckInput["channel"],
        senderNumber,
        senderName,
        messageContent,
        messageUrl,
      });

      // 피싱/차단 판정 시 실제 채널 API를 통해 차단 실행
      let blockResult: { success: boolean; actionId: string; blockAction: string } | null = null;
      if (result.verdict === "phishing" || result.verdict === "blocked") {
        const { executeBlock } = await import("../mip/channel-blocker");
        // mipChannels에서 connectionConfig 조회
        const { mipChannels } = await import("../../drizzle/schema");
        const [channelRecord] = await db.select().from(mipChannels).where(eq(mipChannels.id, deviceId)).limit(1);
        const connectionConfig = channelRecord?.connectionConfig as string | undefined;

        const blocked = await executeBlock({
          deviceId,
          channelType: channelType || device.deviceType,
          senderIdentifier: senderNumber || "unknown",
          messagePreview: messageContent.slice(0, 100),
          verdictLevel: result.verdict,
          riskScore: result.riskScore,
          checkId: result.checkId,
          connectionConfig: connectionConfig || undefined,
        });
        blockResult = { success: blocked.success, actionId: blocked.actionId, blockAction: blocked.blockAction };
      }

      // safe가 아니면 한결에 자동 전송 (blocked/blockAction 포함)
      if (result.verdict !== "safe") {
        sendCheckResultToHangyeol({
          checkId: result.checkId,
          deviceId,
          channel: channelType || device.deviceType,
          senderNumber,
          senderName,
          messageContent,
          riskScore: result.riskScore,
          verdict: result.verdict,
          verdictReason: result.verdictReason,
          scores: result.scores,
          action: result.action,
          blocked: blockResult?.success ?? false,
          blockAction: blockResult?.blockAction,
          blockActionId: blockResult?.actionId,
          timestamp: Date.now(),
        }).catch((err) => {
          console.error("[ChannelInbound] 한결 웹훅 전송 오류:", err);
        });
      }

      const statusCode = result.verdict === "blocked" || result.verdict === "phishing" ? 403 : 200;
      res.status(statusCode).json({
        success: true,
        deviceId,
        channelType: device.deviceType,
        ...result,
        blocked: blockResult?.success ?? false,
        blockAction: blockResult?.blockAction ?? null,
        blockActionId: blockResult?.actionId ?? null,
      });
    } catch (err) {
      console.error("[ChannelInbound] 채널 메시지 검열 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

// ─── 16. 채널 차단 해제 (한결 역방향 API) ─────────────────────────────
// POST /api/hangyeol/channel/unblock
// 한결이 차단된 발신자/메시지의 차단을 해제 요청할 때 사용
hangyeolRouter.post(
  "/channel/unblock",
  hangyeolHmacMiddleware,
  async (req, res) => {
    try {
      const { actionId } = req.body as { actionId?: string };

      if (!actionId) {
        res.status(400).json({
          error: "MISSING_ACTION_ID",
          message: "actionId 필드가 필요합니다.",
        });
        return;
      }

      const { executeUnblock } = await import("../mip/channel-blocker");
      const result = await executeUnblock({ actionId, requestedBy: "hangyeol" });

      if (!result.success) {
        res.status(404).json({
          error: "UNBLOCK_FAILED",
          message: result.error || "차단 해제에 실패했습니다.",
        });
        return;
      }

      res.json({
        success: true,
        actionId,
        message: "차단 해제 완료",
      });
    } catch (err) {
      console.error("[ChannelUnblock] 차단 해제 오류:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "내부 서버 오류" });
    }
  }
);

export default hangyeolRouter;
