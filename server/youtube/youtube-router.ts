/**
 * YouTube OAuth Express 라우터
 * 
 * GET  /api/youtube/auth    — OAuth 인증 URL 생성 (프론트엔드 리다이렉트용)
 * GET  /api/youtube/callback — Google OAuth 콜백 처리 (토큰 교환 + DB 저장)
 */
import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { mipChannels } from "../../drizzle/schema";
import {
  generateYouTubeAuthUrl,
  exchangeCodeForTokens,
  generateOAuthState,
  parseOAuthState,
  YouTubeTokens,
} from "./youtube-oauth";

const youtubeRouter = Router();

/**
 * GET /api/youtube/auth
 * Query: channelId (mip_channels.id), userId, origin
 * → Google OAuth 인증 URL 반환
 */
youtubeRouter.get("/auth", (req: Request, res: Response) => {
  const { channelId, userId, origin } = req.query as {
    channelId?: string;
    userId?: string;
    origin?: string;
  };

  if (!channelId || !userId) {
    res.status(400).json({ error: "channelId and userId are required" });
    return;
  }

  const frontendOrigin = origin || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${frontendOrigin}/api/youtube/callback`;
  const state = generateOAuthState(channelId, userId);

  const authUrl = generateYouTubeAuthUrl(redirectUri, state);
  res.json({ authUrl });
});

/**
 * GET /api/youtube/callback
 * Query: code, state
 * → 토큰 교환 후 DB에 저장, 프론트엔드로 리다이렉트
 */
youtubeRouter.get("/callback", async (req: Request, res: Response) => {
  const { code, state, error: authError } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  if (authError) {
    res.redirect(`/devices?youtube_auth=denied&error=${authError}`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Missing code or state parameter" });
    return;
  }

  const parsed = parseOAuthState(state);
  if (!parsed) {
    res.status(400).json({ error: "Invalid state parameter" });
    return;
  }

  // parsed.deviceId is actually channelId (mip_channels.id)
  const { deviceId: mipChannelId, userId } = parsed;
  const origin = `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${origin}/api/youtube/callback`;

  try {
    // Authorization code → tokens
    const tokens: YouTubeTokens = await exchangeCodeForTokens(code, redirectUri);

    // DB에 토큰 저장 (mip_channels.connectionConfig)
    const db = await getDb();
    if (db) {
      const channels = await db
        .select()
        .from(mipChannels)
        .where(
          and(
            eq(mipChannels.id, mipChannelId),
            eq(mipChannels.channelType, "youtube")
          )
        );

      if (channels.length > 0) {
        const existingConfig = channels[0].connectionConfig
          ? JSON.parse(channels[0].connectionConfig)
          : {};

        const updatedConfig = {
          ...existingConfig,
          oauth: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            channelId: tokens.channelId,
            channelTitle: tokens.channelTitle,
            authenticatedAt: Date.now(),
          },
        };

        await db
          .update(mipChannels)
          .set({
            connectionConfig: JSON.stringify(updatedConfig),
            status: "active",
            updatedAt: Date.now(),
          })
          .where(eq(mipChannels.id, mipChannelId));

        console.log(
          `[YouTube OAuth] 토큰 저장 완료 — channel: ${mipChannelId}, ytChannel: ${tokens.channelId}`
        );
      } else {
        console.warn(
          `[YouTube OAuth] 채널 ${mipChannelId}을 찾을 수 없습니다.`
        );
      }
    }

    // 프론트엔드로 리다이렉트 (성공)
    res.redirect(
      `/devices?youtube_auth=success&channel=${tokens.channelId || ""}&title=${encodeURIComponent(tokens.channelTitle || "")}`
    );
  } catch (err) {
    console.error("[YouTube OAuth] 토큰 교환 실패:", err);
    res.redirect(
      `/devices?youtube_auth=error&message=${encodeURIComponent((err as Error).message)}`
    );
  }
});

export default youtubeRouter;
