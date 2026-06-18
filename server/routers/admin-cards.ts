/**
 * Admin Card Issuance Router
 * 이영도(admin)만 접근 가능한 페르소나 카드 발급 승인 라우터
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { router, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { personaCardRequests, personaIssuedCards } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { issuePersonaCard, getIssuerPublicKeyPem, verifyPersonaCard } from "../mip/card-issuer";

export const adminCardsRouter = router({
  // 발급 요청 목록 조회
  listRequests: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "rejected", "all"]).default("all"),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const params = input ?? { status: "all", limit: 50 };

      if (params.status !== "all") {
        return await db.select().from(personaCardRequests)
          .where(eq(personaCardRequests.status, params.status))
          .orderBy(desc(personaCardRequests.createdAt))
          .limit(params.limit);
      }

      return await db.select().from(personaCardRequests)
        .orderBy(desc(personaCardRequests.createdAt))
        .limit(params.limit);
    }),

  // 발급 요청 상세 조회
  getRequest: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [request] = await db.select().from(personaCardRequests).where(eq(personaCardRequests.id, input.id));
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다." });
      return request;
    }),

  // 카드 발급 승인
  approve: adminProcedure
    .input(z.object({
      requestId: z.string(),
      expiresInDays: z.number().min(1).max(3650).default(365),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb())!;

      // 요청 조회
      const [request] = await db.select().from(personaCardRequests).where(eq(personaCardRequests.id, input.requestId));
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다." });
      if (request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "이미 처리된 요청입니다." });

      // capabilities 파싱
      let capabilities: string[];
      try {
        capabilities = JSON.parse(request.capabilities);
      } catch {
        capabilities = [];
      }

      // Ed25519 서명 발급
      const signedCard = issuePersonaCard({
        subjectDid: request.subjectDid,
        displayName: request.displayName,
        title: request.title ?? undefined,
        organization: request.organization ?? undefined,
        bio: request.bio ?? undefined,
        capabilities,
        expiresInDays: input.expiresInDays,
      });

      // 검증
      const isValid = verifyPersonaCard(signedCard);
      if (!isValid) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "서명 검증 실패" });

      const now = Date.now();
      const cardId = nanoid();

      // 발급 카드 저장
      await db.insert(personaIssuedCards).values({
        id: cardId,
        requestId: input.requestId,
        subjectDid: request.subjectDid,
        displayName: request.displayName,
        issuerDid: signedCard.payload.issuer,
        signedCardJson: JSON.stringify(signedCard),
        algorithm: "Ed25519",
        issuedAt: new Date(signedCard.payload.issuedAt).getTime(),
        expiresAt: new Date(signedCard.payload.expiresAt).getTime(),
        issuedBy: ctx.user.openId,
        createdAt: now,
      });

      // 요청 상태 업데이트
      await db.update(personaCardRequests)
        .set({
          status: "approved",
          reviewedBy: ctx.user.openId,
          reviewedAt: now,
          issuedCardId: cardId,
          updatedAt: now,
        })
        .where(eq(personaCardRequests.id, input.requestId));

      return {
        cardId,
        signedCard,
        message: `${request.displayName} (${request.subjectDid}) 카드 발급 완료`,
      };
    }),

  // 카드 발급 거부
  reject: adminProcedure
    .input(z.object({
      requestId: z.string(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb())!;

      const [request] = await db.select().from(personaCardRequests).where(eq(personaCardRequests.id, input.requestId));
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다." });
      if (request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "이미 처리된 요청입니다." });

      const now = Date.now();
      await db.update(personaCardRequests)
        .set({
          status: "rejected",
          reviewedBy: ctx.user.openId,
          reviewedAt: now,
          rejectionReason: input.reason,
          updatedAt: now,
        })
        .where(eq(personaCardRequests.id, input.requestId));

      return { success: true, message: `${request.displayName} 카드 발급 거부됨: ${input.reason}` };
    }),

  // 발급된 카드 목록 조회
  listIssuedCards: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const limit = input?.limit ?? 50;
      return await db.select().from(personaIssuedCards).orderBy(desc(personaIssuedCards.createdAt)).limit(limit);
    }),

  // 발급된 카드 상세 (JSON 포함)
  getIssuedCard: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [card] = await db.select().from(personaIssuedCards).where(eq(personaIssuedCards.id, input.id));
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "카드를 찾을 수 없습니다." });
      return card;
    }),

  // 발급자 공개키 조회 (외부 서비스 전달용)
  getPublicKey: adminProcedure.query(() => {
    return { publicKeyPem: getIssuerPublicKeyPem(), issuerDid: "did:mip:issuer:mip-engine-v1" };
  }),

  // 수동 카드 발급 (요청 없이 직접 발급)
  issueDirectly: adminProcedure
    .input(z.object({
      subjectDid: z.string().min(5),
      displayName: z.string().min(1).max(100),
      title: z.string().max(200).optional(),
      organization: z.string().max(100).optional(),
      bio: z.string().max(500).optional(),
      capabilities: z.array(z.string()).min(1),
      expiresInDays: z.number().min(1).max(3650).default(365),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb())!;
      const now = Date.now();

      // 요청 레코드 생성
      const requestId = nanoid();
      await db.insert(personaCardRequests).values({
        id: requestId,
        requesterService: "mip-admin",
        requesterRef: `direct-${ctx.user.openId}`,
        subjectDid: input.subjectDid,
        displayName: input.displayName,
        title: input.title ?? null,
        organization: input.organization ?? null,
        bio: input.bio ?? null,
        capabilities: JSON.stringify(input.capabilities),
        status: "approved",
        reviewedBy: ctx.user.openId,
        reviewedAt: now,
        expiresInDays: input.expiresInDays,
        createdAt: now,
        updatedAt: now,
      });

      // 서명 발급
      const signedCard = issuePersonaCard({
        subjectDid: input.subjectDid,
        displayName: input.displayName,
        title: input.title,
        organization: input.organization,
        bio: input.bio,
        capabilities: input.capabilities,
        expiresInDays: input.expiresInDays,
      });

      const cardId = nanoid();
      await db.insert(personaIssuedCards).values({
        id: cardId,
        requestId,
        subjectDid: input.subjectDid,
        displayName: input.displayName,
        issuerDid: signedCard.payload.issuer,
        signedCardJson: JSON.stringify(signedCard),
        algorithm: "Ed25519",
        issuedAt: new Date(signedCard.payload.issuedAt).getTime(),
        expiresAt: new Date(signedCard.payload.expiresAt).getTime(),
        issuedBy: ctx.user.openId,
        createdAt: now,
      });

      // 요청에 카드 ID 연결
      await db.update(personaCardRequests)
        .set({ issuedCardId: cardId, updatedAt: now })
        .where(eq(personaCardRequests.id, requestId));

      return {
        cardId,
        signedCard,
        message: `${input.displayName} (${input.subjectDid}) 카드 직접 발급 완료`,
      };
    }),
});
