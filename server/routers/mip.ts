import { z } from "zod";
import { nanoid } from "nanoid";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  mipDevices,
  mipImplantations,
  mipPackages,
  mipSandboxReports,
  mipSafetyLogs,
  mipBoundaryPolicies,
  mipRuntimeSessions,
  mipAuditChain,
  mipWebhookDlq,
  mipLoreWebhookDlq,
  mipWebhookSendLogs,
  somaWebhookEvents,
  lorePackageEvents,
  mipPackageRefreshRequests,
  mipChannels,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { receiveAndValidatePackage } from "../mip/package-receiver";
import { injectStandardPolicies, getActivePolicies, STANDARD_POLICIES, composePolicies, evaluateAllPolicies } from "../mip/ethical-boundary";
import { runSandboxValidation, runRedteamScenario } from "../mip/simulation-sandbox";
import { verifyDeviceTrust, activateRuntime, triggerKillSwitch, getActiveSessions } from "../mip/runtime-connector";
import { detectAndAlertAnomaly, monitorSafetyLayers, handleEmotionOverflow, getCurrentThresholds } from "../mip/safety-monitor";
import { startImplantation, getImplantationStatus, cancelImplantation } from "../mip/implantation-engine";
import { verifyHmacHeader } from "../lib/hmac";
import { verifyAuditChain } from "../lib/audit";
import type { MIOPackage } from "../../shared/mip-types";
import { requestPhysicalAction, approvePhysicalAction, rejectPhysicalAction, ACTION_TIER_MAP, PHYSICAL_ACTION_TIERS } from "../mip/physical-action-engine";
import { analyzeEmotionalRisk, getEmotionalRiskHistory } from "../mip/emotional-risk-engine";
import { createDnaSnapshot, getDnaVersionHistory, rollbackDna } from "../mip/dna-rollback-engine";
import { mipPhysicalActions, mipEmotionalRiskLogs, mipPackageVersions } from "../../drizzle/schema";
import {
  checkIsolationLayer,
  getCoreIdentity,
  getDeploymentSecurity,
  getIsolationViolations,
} from "../mip/isolation-layer";
import {
  processEmotionalBridge,
  getEmotionalBridgeEvents,
  calculateHomeostasisScore,
} from "../mip/emotional-bridge";
import {
  mipCoreIdentities,
  mipDeploymentSecurity,
  mipIsolationViolations,
  mipEmotionalBridgeEvents,
  mipLedgerAnchors,
  mipLedgerAnchorDlq,
} from "../../drizzle/schema";
import {
  anchorToLedger,
  verifyAnchor,
  getLedgerAnchors,
  getLedgerAnchorStats,
  retryLedgerDlq,
} from "../mip/ledger-anchoring";


// ─── Zod 스키마 ───────────────────────────────────────────────────────────────

const DeviceRegisterSchema = z.object({
  deviceName: z.string().min(1).max(100),
  deviceType: z.enum(["humanoid", "iot", "software", "sms", "kakaotalk", "whatsapp", "line", "telegram", "instagram", "rcs", "youtube"]),
  did: z.string().min(10),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ImplantStartSchema = z.object({
  deviceId: z.string(),
  packageId: z.string(),
  protocol: z.enum(["ros2", "mqtt", "websocket", "webhook"]),
  endpoint: z.string().optional(),
});

const RedteamSchema = z.object({
  scenario: z.string(),
  payload: z.string(),
  targetPolicy: z.enum(["p_harm", "p_child", "p_unsafe", "p_emotion", "p_learning"]),
  reportFormat: z.enum(["aisi_v1", "internal"]).default("aisi_v1"),
  implantationId: z.string().optional(),
});

const SafetyEventSchema = z.object({
  sessionId: z.string(),
  implantationId: z.string(),
  safetyLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  eventType: z.enum([
    "anomaly_detected", "policy_violation", "emotion_overflow",
    "physical_limit_exceeded", "kill_switch_activated",
    "hardware_signal_sent", "soma_notified", "threshold_adjusted",
  ]),
  severity: z.enum(["info", "warning", "critical", "emergency"]),
  description: z.string(),
  autoResolved: z.boolean().default(false),
});

const MIOPackageSchema = z.object({
  packageId: z.string(),
  userId: z.string(),
  dna: z.object({
    indicators: z.record(z.string(), z.number()),
    version: z.string(),
    generatedAt: z.number(),
  }),
  pattern: z.object({
    behavioral: z.record(z.string(), z.unknown()),
    emotional: z.record(z.string(), z.unknown()),
    relational: z.record(z.string(), z.unknown()),
    version: z.string(),
  }),
  context: z.object({
    purpose: z.enum(["humanoid_implant", "software_runtime", "iot_device"]),
    deviceId: z.string(),
    environment: z.string(),
    constraints: z.array(z.string()),
  }),
  signature: z.object({
    did: z.string(),
    proof: z.string(),
    verificationMethod: z.string(),
    created: z.number(),
  }),
  ttl: z.number(),
  version: z.string(),
});

// ─── MIP Router ───────────────────────────────────────────────────────────────

export const mipRouter = router({
  // ── 디바이스 관리 ─────────────────────────────────────────────────────────
  devices: router({
    register: protectedProcedure
      .input(DeviceRegisterSchema)
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const deviceId = nanoid();
        const now = Date.now();

        await db.insert(mipDevices).values({
          id: deviceId,
          userId: String(ctx.user.id),
          deviceType: input.deviceType,
          deviceName: input.deviceName,
          did: input.did,
          trustLevel: 0,
          status: "pending",
          metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
          createdAt: now,
        });

        // 채널 타입이면 mip_channels에도 자동 등록
        const channelTypes = ["sms", "kakaotalk", "whatsapp", "line", "telegram", "instagram", "rcs", "youtube"];
        let channelId: string | undefined;
        if (channelTypes.includes(input.deviceType)) {
          channelId = nanoid();
          const accountId = input.did.replace(`did:channel:${input.deviceType}:`, "");
          await db.insert(mipChannels).values({
            id: channelId,
            channelType: input.deviceType as any,
            protocol: "webhook",
            accountId,
            displayName: input.deviceName,
            protectionLevel: "full",
            status: "pending_verification",
            connectionConfig: null,
            totalChecked: 0,
            totalBlocked: 0,
            ownerId: String(ctx.user.id),
            createdAt: now,
            updatedAt: now,
          });
        }

        return { deviceId, channelId, message: "디바이스가 등록되었습니다. DID 신뢰 검증 후 활성화됩니다." };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const devices = await db.select().from(mipDevices).where(eq(mipDevices.userId, String(ctx.user.id))).orderBy(desc(mipDevices.createdAt));
      // 채널 타입 디바이스의 경우 mip_channels에서 OAuth 상태 확인
      const channelTypeList = ["sms", "kakaotalk", "whatsapp", "line", "telegram", "instagram", "rcs", "youtube"];
      const enriched = await Promise.all(devices.map(async (device) => {
        if (!channelTypeList.includes(device.deviceType)) return { ...device, channelId: null, youtubeAuth: null };
        const accountId = device.did.replace(`did:channel:${device.deviceType}:`, "");
        const channels = await db.select().from(mipChannels).where(
          and(eq(mipChannels.ownerId, String(ctx.user.id)), eq(mipChannels.accountId, accountId), eq(mipChannels.channelType, device.deviceType as any))
        ).limit(1);
        const ch = channels[0];
        if (!ch) return { ...device, channelId: null, youtubeAuth: null };
        let youtubeAuth: { channelId?: string; channelTitle?: string; authenticated: boolean } | null = null;
        if (device.deviceType === "youtube" && ch.connectionConfig) {
          try {
            const cfg = JSON.parse(ch.connectionConfig);
            if (cfg.oauth) {
              youtubeAuth = { channelId: cfg.oauth.channelId, channelTitle: cfg.oauth.channelTitle, authenticated: true };
            }
          } catch {}
        }
        return { ...device, channelId: ch.id, youtubeAuth };
      }));
      return enriched;
    }),

    listAll: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mipDevices).orderBy(desc(mipDevices.createdAt)).limit(200);
    }),

    verify: protectedProcedure
      .input(z.object({ deviceId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const result = await verifyDeviceTrust(input.deviceId, String(ctx.user.id));
        if (result.trusted) {
          await db.update(mipDevices).set({ status: "verified", trustLevel: 2 }).where(eq(mipDevices.id, input.deviceId));
        }
        return result;
      }),

    revoke: protectedProcedure
      .input(z.object({ deviceId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db.update(mipDevices).set({ status: "revoked" }).where(
          and(eq(mipDevices.id, input.deviceId), eq(mipDevices.userId, String(ctx.user.id)))
        );
        return { revoked: true };
      }),
  }),

  // ── 이식 프로세스 (8단계) ─────────────────────────────────────────────────
  implant: router({
    start: protectedProcedure
      .input(ImplantStartSchema)
      .mutation(async ({ ctx, input }) => {
        return startImplantation({
          userId: String(ctx.user.id),
          deviceId: input.deviceId,
          packageId: input.packageId,
          protocol: input.protocol,
          endpoint: input.endpoint,
        });
      }),

    status: protectedProcedure
      .input(z.object({ implantationId: z.string() }))
      .query(async ({ input }) => {
        const status = await getImplantationStatus(input.implantationId);
        if (!status) throw new TRPCError({ code: "NOT_FOUND", message: "Implantation not found" });
        return status;
      }),

    cancel: protectedProcedure
      .input(z.object({ implantationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return cancelImplantation(input.implantationId, String(ctx.user.id));
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mipImplantations)
        .where(eq(mipImplantations.userId, String(ctx.user.id)))
        .orderBy(desc(mipImplantations.startedAt))
        .limit(50);
    }),
  }),

  // ── MIO Package 목록 ────────────────────────────────────────────────────────
  packages: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mipPackages)
        .where(eq(mipPackages.userId, String(ctx.user.id)))
        .orderBy(desc(mipPackages.receivedAt))
        .limit(50);
    }),
    listAll: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mipPackages)
        .where(eq(mipPackages.status, 'validated'))
        .orderBy(desc(mipPackages.receivedAt))
        .limit(100);
    }),
    get: protectedProcedure
      .input(z.object({ packageId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [pkg] = await db.select().from(mipPackages)
          .where(eq(mipPackages.id, input.packageId))
          .limit(1);
        if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        return pkg;
      }),
    requestFromLore: protectedProcedure
      .input(z.object({
        personas: z.array(z.enum([
          "emotional",     // 감정 자아
          "cognitive",     // 인지 자아
          "social",        // 사회적 자아
          "creative",      // 창의적 자아
          "moral",         // 도덕적 자아
          "habitual",      // 습관적 자아
          "linguistic",    // 언어적 자아
          "relational",    // 관계적 자아
        ])).min(1, "최소 1개 자아를 선택해야 합니다."),
        selectAll: z.boolean().default(false),
        urgency: z.enum(["low", "medium", "high"]).default("medium"),
        purpose: z.enum(["humanoid_implant", "software_runtime", "iot_device"]).default("software_runtime"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { callLoreApi } = await import("../lore/webhook-sender");
        const { appendAuditChain } = await import("../lib/audit");
        const { nanoid } = await import("nanoid");

        const requestId = nanoid();
        const allPersonas = ["emotional", "cognitive", "social", "creative", "moral", "habitual", "linguistic", "relational"];
        const selectedPersonas = input.selectAll ? allPersonas : input.personas;

        // DB에 요청 기록
        const db = await getDb();
        if (db) {
          await db.insert(mipPackageRefreshRequests).values({
            id: nanoid(),
            requestId,
            packageId: `request-${requestId}`,
            userId: String(ctx.user.id),
            reason: "manual_request",
            urgency: input.urgency,
            status: "pending",
            requestedAt: Date.now(),
            createdAt: Date.now(),
          });
        }

        // LORE에 패키지 생성 요청
        const result = await callLoreApi("/api/mip/package-request", {
          requestId,
          userId: String(ctx.user.id),
          personas: selectedPersonas,
          selectAll: input.selectAll,
          purpose: input.purpose,
          urgency: input.urgency,
          requestedAt: Date.now(),
        });

        if (!result.ok) {
          // 실패 시 DB 상태 업데이트
          if (db) {
            const { eq } = await import("drizzle-orm");
            await db
              .update(mipPackageRefreshRequests)
              .set({ status: "failed" })
              .where(eq(mipPackageRefreshRequests.requestId, requestId));
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `LORE 패키지 요청 실패 (HTTP ${result.status}). LORE 서비스 상태를 확인하세요.`,
          });
        }

        // 감사 체인 기록
        await appendAuditChain({
          entityType: "package",
          entityId: requestId,
          action: "package_requested_from_lore",
          actorId: String(ctx.user.id),
          data: { requestId, personas: selectedPersonas, purpose: input.purpose, urgency: input.urgency },
        });

        const data = result.data as { estimatedCompletionMs?: number } | undefined;
        return {
          requestId,
          personas: selectedPersonas,
          estimatedCompletionMs: data?.estimatedCompletionMs ?? 30_000,
          message: `LORE에 ${selectedPersonas.length}개 자아 패키지 생성을 요청했습니다.`,
        };
      }),
  }),

  // ── Sandbox ───────────────────────────────────────────────────────────────
  sandbox: router({
    getReport: protectedProcedure
      .input(z.object({ reportId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const rows = await db.select().from(mipSandboxReports).where(eq(mipSandboxReports.id, input.reportId)).limit(1);
        if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
        return rows[0];
      }),

    listReports: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mipSandboxReports).orderBy(desc(mipSandboxReports.createdAt)).limit(20);
    }),

    // AISI Red-teaming API (API Key 인증)
    runRedteam: publicProcedure
      .input(RedteamSchema)
      .mutation(async ({ input }) => {
        const { implantationId, ...request } = input;
        return runRedteamScenario(request, implantationId);
      }),
  }),

  // ── Safety Monitor ────────────────────────────────────────────────────────
  safety: router({
    getLogs: protectedProcedure
      .input(z.object({ sessionId: z.string().optional(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const query = db.select().from(mipSafetyLogs).orderBy(desc(mipSafetyLogs.timestamp)).limit(input.limit);
        return query;
      }),

    reportEvent: protectedProcedure
      .input(SafetyEventSchema)
      .mutation(async ({ ctx, input }) => {
        return detectAndAlertAnomaly({
          ...input,
          userId: String(ctx.user.id),
        });
      }),

    monitorLayers: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        implantationId: z.string(),
        metrics: z.object({
          emotionScore: z.number().optional(),
          behaviorRiskScore: z.number().optional(),
          physicalForce: z.number().optional(),
          commandConflicts: z.number().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        return monitorSafetyLayers(input.sessionId, input.implantationId, String(ctx.user.id), input.metrics);
      }),

    killSwitch: protectedProcedure
      .input(z.object({ sessionId: z.string(), reason: z.string().default("Manual kill switch") }))
      .mutation(async ({ ctx, input }) => {
        return triggerKillSwitch(input.sessionId, String(ctx.user.id), input.reason);
      }),

    getThresholds: protectedProcedure.query(() => getCurrentThresholds()),

    activeSessions: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mipRuntimeSessions)
        .where(eq(mipRuntimeSessions.status, "active"))
        .orderBy(desc(mipRuntimeSessions.startedAt));
    }),
  }),

  // ── 정책 관리 ─────────────────────────────────────────────────────────────
  policies: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mipBoundaryPolicies)
        .where(eq(mipBoundaryPolicies.userId, String(ctx.user.id)))
        .orderBy(desc(mipBoundaryPolicies.createdAt));
    }),

    getStandard: publicProcedure.query(() => {
      return Object.entries(STANDARD_POLICIES).map(([key, policy]) => ({
        key,
        ...policy,
        policyId: `standard-${key}`,
      }));
    }),

    evaluate: protectedProcedure
      .input(z.object({ input: z.string(), implantationId: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const policies = await getActivePolicies(String(ctx.user.id), input.implantationId);
        const violations = evaluateAllPolicies(input.input, policies);
        const composite = composePolicies(policies);
        return { violations, composite, blocked: violations.some((v) => v.blocked) };
      }),
  }),

  // ── 외부 연동 (Lore, Soma Gateway, AISI) ─────────────────────────────────
  external: router({
    // Lore → MIP: MIO Package 수신 (HMAC 서명 인증)
    receivePackage: publicProcedure
      .input(MIOPackageSchema)
      .mutation(async ({ input }) => {
        return receiveAndValidatePackage(input as MIOPackage);
      }),

    // Soma Gateway → MIP: 승인 이벤트 수신
    somaApproval: publicProcedure
      .input(z.object({
        eventType: z.literal("mip_implant_approved"),
        userId: z.string(),
        deviceId: z.string(),
        packageId: z.string(),
        approvedAt: z.number(),
      }))
      .mutation(async ({ input }) => {
        console.log(`[External] Soma approval received for user ${input.userId}`);
        return { received: true, eventType: input.eventType, timestamp: Date.now() };
      }),
  }),

  // ── 연동 상태 모니터링 ────────────────────────────────────────────────────
  integration: router({
    // Lore·Soma DLQ 잔여 건수 + 최근 이벤트 이력 요약
    status: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;

      const [somaDlqPending, loreDlqPending, somaAbandoned, loreAbandoned] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(mipWebhookDlq).where(eq(mipWebhookDlq.status, "pending")),
        db.select({ count: sql<number>`count(*)` }).from(mipLoreWebhookDlq).where(eq(mipLoreWebhookDlq.status, "pending")),
        db.select({ count: sql<number>`count(*)` }).from(mipWebhookDlq).where(eq(mipWebhookDlq.status, "abandoned")),
        db.select({ count: sql<number>`count(*)` }).from(mipLoreWebhookDlq).where(eq(mipLoreWebhookDlq.status, "abandoned")),
      ]);

      return {
        soma: {
          dlqPending: Number(somaDlqPending[0]?.count || 0),
          dlqAbandoned: Number(somaAbandoned[0]?.count || 0),
        },
        lore: {
          dlqPending: Number(loreDlqPending[0]?.count || 0),
          dlqAbandoned: Number(loreAbandoned[0]?.count || 0),
        },
        updatedAt: Date.now(),
      };
    }),

    // 최근 Webhook 발신 이력 (MIP → Soma / MIP → Lore 실제 전송 결과)
    events: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        target: z.enum(["soma", "lore"]).optional(),
        successOnly: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions: ReturnType<typeof eq>[] = [];
        if (input.target) conditions.push(eq(mipWebhookSendLogs.target, input.target));
        if (input.successOnly === true) conditions.push(eq(mipWebhookSendLogs.success, 1));
        if (input.successOnly === false) conditions.push(eq(mipWebhookSendLogs.success, 0));
        if (conditions.length > 0) {
          return db.select().from(mipWebhookSendLogs)
            .where(and(...conditions))
            .orderBy(desc(mipWebhookSendLogs.sentAt))
            .limit(input.limit);
        }
        return db.select().from(mipWebhookSendLogs)
          .orderBy(desc(mipWebhookSendLogs.sentAt))
          .limit(input.limit);
      }),
    // 수신 이벤트 이력 (Soma 수신 + Lore 수신 통합)
    inboundEvents: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const [somaEvents, loreEvents] = await Promise.all([
          db.select().from(somaWebhookEvents).orderBy(desc(somaWebhookEvents.createdAt)).limit(input.limit),
          db.select().from(lorePackageEvents).orderBy(desc(lorePackageEvents.createdAt)).limit(input.limit),
        ]);

        const merged = [
          ...somaEvents.map(e => ({ ...e, source: "soma" as const })),
          ...loreEvents.map(e => ({ ...e, source: "lore" as const })),
        ].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, input.limit);

        return merged;
      }),

    // DLQ 상세 목록 (Soma)
    somaDlq: protectedProcedure
      .input(z.object({ status: z.enum(["pending", "resolved", "abandoned"]).optional(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const query = db.select().from(mipWebhookDlq).orderBy(desc(mipWebhookDlq.failedAt)).limit(input.limit);
        if (input.status) {
          return db.select().from(mipWebhookDlq).where(eq(mipWebhookDlq.status, input.status)).orderBy(desc(mipWebhookDlq.failedAt)).limit(input.limit);
        }
        return query;
      }),

    // DLQ 상세 목록 (Lore)
    loreDlq: protectedProcedure
      .input(z.object({ status: z.enum(["pending", "resolved", "abandoned"]).optional(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        if (input.status) {
          return db.select().from(mipLoreWebhookDlq).where(eq(mipLoreWebhookDlq.status, input.status)).orderBy(desc(mipLoreWebhookDlq.failedAt)).limit(input.limit);
        }
        return db.select().from(mipLoreWebhookDlq).orderBy(desc(mipLoreWebhookDlq.failedAt)).limit(input.limit);
      }),
  }),

  // ── 감사 체인 ─────────────────────────────────────────────────────────────
  audit: router({
    verify: protectedProcedure.query(async () => {
      return verifyAuditChain();
    }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(mipAuditChain).orderBy(desc(mipAuditChain.sequenceNumber)).limit(input.limit);
      }),
  }),

  // ── 대시보드 통계 ─────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;

      const userId = String(ctx.user.id);

      const [devices, implantations, safetyLogs, sessions] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(mipDevices).where(eq(mipDevices.userId, userId)),
        db.select({ count: sql<number>`count(*)`, status: mipImplantations.status }).from(mipImplantations).where(eq(mipImplantations.userId, userId)).groupBy(mipImplantations.status),
        db.select({ count: sql<number>`count(*)` }).from(mipSafetyLogs).where(eq(mipSafetyLogs.userId, userId)),
        db.select({ count: sql<number>`count(*)` }).from(mipRuntimeSessions).where(and(eq(mipRuntimeSessions.userId, userId), eq(mipRuntimeSessions.status, "active"))),
      ]);

      const implantationStats = implantations.reduce((acc, row) => {
        acc[row.status] = Number(row.count);
        return acc;
      }, {} as Record<string, number>);

      return {
        totalDevices: Number(devices[0]?.count || 0),
        implantations: implantationStats,
        totalSafetyLogs: Number(safetyLogs[0]?.count || 0),
        activeSessions: Number(sessions[0]?.count || 0),
      };
    }),

    recentActivity: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mipImplantations)
        .where(eq(mipImplantations.userId, String(ctx.user.id)))
        .orderBy(desc(mipImplantations.startedAt))
        .limit(10);
    }),
  }),

  // ─── Physical Action Tier 0~4 승인 시스템 ────────────────────────────────
  physicalAction: router({
    request: protectedProcedure
      .input(z.object({
        actionType: z.string(),
        deviceId: z.string().optional(),
        sessionId: z.string().optional(),
        actionPayload: z.record(z.string(), z.unknown()).optional(),
        contextSnapshot: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return requestPhysicalAction({
          userId: String(ctx.user.id),
          ...input,
        });
      }),
    approve: protectedProcedure
      .input(z.object({
        actionId: z.string(),
        method: z.enum(["user_approved", "mfa_approved"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await approvePhysicalAction(input.actionId, String(ctx.user.id), input.method);
        return { success: true };
      }),
    reject: protectedProcedure
      .input(z.object({
        actionId: z.string(),
        reason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await rejectPhysicalAction(input.actionId, String(ctx.user.id), input.reason);
        return { success: true };
      }),
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(mipPhysicalActions)
          .where(eq(mipPhysicalActions.userId, String(ctx.user.id)))
          .orderBy(desc(mipPhysicalActions.requestedAt))
          .limit(input.limit);
      }),
    tierDefinitions: protectedProcedure.query(async () => {
      return {
        tiers: PHYSICAL_ACTION_TIERS,
        actionMap: ACTION_TIER_MAP,
      };
    }),
  }),

  // ─── Emotional Dependency Risk 감지 ──────────────────────────────────────
  emotionalRisk: router({
    analyze: protectedProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        packageId: z.string().optional(),
        emotionIntensity: z.number().min(0).max(100),
        attachmentLevel: z.number().min(0).max(100),
        socialIsolation: z.number().min(0).max(100),
        realityAnchor: z.number().min(0).max(100),
        aiDependencyFrequency: z.number().min(0).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        return analyzeEmotionalRisk({
          userId: String(ctx.user.id),
          ...input,
        });
      }),
    history: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ ctx, input }) => {
        return getEmotionalRiskHistory(String(ctx.user.id), input.limit);
      }),
    allLogs: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(mipEmotionalRiskLogs)
          .orderBy(desc(mipEmotionalRiskLogs.detectedAt))
          .limit(input.limit);
      }),
  }),

  // ─── §14 Runtime Isolation Layer ────────────────────────────────────────
  isolationLayer: router({
    checkCommand: protectedProcedure
      .input(z.object({
        command: z.string(),
        sessionId: z.string().optional(),
        implantationId: z.string().optional(),
        stage: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return checkIsolationLayer(input.command, {
          sessionId: input.sessionId,
          implantationId: input.implantationId,
          userId: String(ctx.user.id),
          stage: input.stage,
        });
      }),
    getCoreIdentity: protectedProcedure
      .input(z.object({ implantationId: z.string() }))
      .query(async ({ input }) => {
        return getCoreIdentity(input.implantationId);
      }),
    getDeploymentSecurity: protectedProcedure
      .input(z.object({ implantationId: z.string() }))
      .query(async ({ input }) => {
        return getDeploymentSecurity(input.implantationId);
      }),
    violations: protectedProcedure
      .input(z.object({
        implantationId: z.string().optional(),
        limit: z.number().default(50),
      }))
      .query(async ({ ctx, input }) => {
        return getIsolationViolations({
          userId: String(ctx.user.id),
          implantationId: input.implantationId,
          limit: input.limit,
        });
      }),
    violationStats: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { total: 0, byType: {} as Record<string, number>, bySeverity: {} as Record<string, number>, recent: [] };
        const rows = await db.select().from(mipIsolationViolations)
          .orderBy(desc(mipIsolationViolations.detectedAt))
          .limit(200);
        const byType: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        for (const r of rows) {
          byType[r.violationType] = (byType[r.violationType] ?? 0) + 1;
          bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
        }
        return { total: rows.length, byType, bySeverity, recent: rows.slice(0, 10) };
      }),
    sendEmotionalBridge: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        implantationId: z.string(),
        bridgeType: z.enum(["emotional_bridge", "context_relay", "memory_sync", "trust_channel"]),
        signalPayload: z.record(z.string(), z.unknown()),
        trustLevel: z.number().min(0).max(3).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return processEmotionalBridge({
          sessionId: input.sessionId,
          implantationId: input.implantationId,
          userId: String(ctx.user.id),
          bridgeType: input.bridgeType,
          signalPayload: input.signalPayload,
          sessionContext: { isolationActive: true, trustLevel: input.trustLevel },
        });
      }),
    bridgeEvents: protectedProcedure
      .input(z.object({ implantationId: z.string(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return getEmotionalBridgeEvents(input.implantationId, input.limit);
      }),
    homeostasis: protectedProcedure
      .input(z.object({ implantationId: z.string() }))
      .query(async ({ input }) => {
        return calculateHomeostasisScore(input.implantationId);
      }),
    dashboard: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return null;
        const [violations, coreIdentities, deploymentSecurities, bridgeEvents] = await Promise.all([
          db.select().from(mipIsolationViolations).orderBy(desc(mipIsolationViolations.detectedAt)).limit(10),
          db.select().from(mipCoreIdentities).orderBy(desc(mipCoreIdentities.createdAt)).limit(5),
          db.select().from(mipDeploymentSecurity).orderBy(desc(mipDeploymentSecurity.createdAt)).limit(5),
          db.select().from(mipEmotionalBridgeEvents).orderBy(desc(mipEmotionalBridgeEvents.createdAt)).limit(10),
        ]);
        return {
          violations,
          coreIdentities,
          deploymentSecurities,
          bridgeEvents,
          summary: {
            totalViolations: violations.length,
            activeCoreIdentities: coreIdentities.filter(c => c.status === "active").length,
            maxSecurityLevel: deploymentSecurities.find(d => d.securityLevel === "maximum") ? "maximum"
              : deploymentSecurities.find(d => d.securityLevel === "enhanced") ? "enhanced" : "standard",
            bridgeAcceptanceRate: bridgeEvents.length > 0
              ? Math.round((bridgeEvents.filter(e => e.accepted === 1).length / bridgeEvents.length) * 100)
              : 0,
          },
        };
      }),
  }),

  // ─── DNA Rollback ─────────────────────────────────────────────────────────
  dnaRollback: router({
    snapshot: protectedProcedure
      .input(z.object({
        packageId: z.string(),
        dnaData: z.record(z.string(), z.unknown()),
        patternData: z.record(z.string(), z.unknown()).optional(),
        contextData: z.record(z.string(), z.unknown()).optional(),
        didSignature: z.string(),
        changeReason: z.string(),
        versionTag: z.string().optional(),
        isRollbackPoint: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const snapshotId = await createDnaSnapshot({
          ...input,
          userId: String(ctx.user.id),
          changedBy: String(ctx.user.id),
        });
        return { snapshotId, success: true };
      }),
    history: protectedProcedure
      .input(z.object({ packageId: z.string() }))
      .query(async ({ input }) => {
        return getDnaVersionHistory(input.packageId);
      }),
    rollback: protectedProcedure
      .input(z.object({
        packageId: z.string(),
        targetVersionId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return rollbackDna(input.packageId, input.targetVersionId, String(ctx.user.id));
      }),
  }),

  // ─── §14.6 Distributed Ledger Anchoring ────────────────────────────────────
  ledgerAnchoring: router({
    // 수동 앙커링 (API 테스트 용)
    anchor: protectedProcedure
      .input(z.object({
        entityType: z.enum(["implantation", "device", "package", "sandbox_report", "safety_log", "policy", "session"]),
        entityId: z.string(),
        action: z.string(),
        data: z.record(z.string(), z.unknown()).optional(),
        implantationId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return anchorToLedger({
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          actorId: String(ctx.user.id),
          data: input.data ?? {},
          implantationId: input.implantationId,
        });
      }),
    // 앙커 검증
    verify: protectedProcedure
      .input(z.object({ anchorId: z.string() }))
      .mutation(async ({ input }) => {
        return verifyAnchor(input.anchorId);
      }),
    // 앙커 이력 조회
    list: protectedProcedure
      .input(z.object({
        implantationId: z.string().optional(),
        entityType: z.string().optional(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return getLedgerAnchors(input);
      }),
    // 앙커 통계
    stats: protectedProcedure
      .query(async () => {
        return getLedgerAnchorStats();
      }),
    // DLQ 재시도 (수동 트리거)
    retryDlq: protectedProcedure
      .mutation(async () => {
        return retryLedgerDlq();
      }),
    // DLQ 목록
    dlqList: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(mipLedgerAnchorDlq)
          .orderBy(desc(mipLedgerAnchorDlq.createdAt))
          .limit(input.limit);
      }),
    // 대시보드
    dashboard: protectedProcedure
      .query(async () => {
        const [stats, recentAnchors] = await Promise.all([
          getLedgerAnchorStats(),
          getLedgerAnchors({ limit: 10 }),
        ]);
        return { stats, recentAnchors };
      }),
  }),

});
