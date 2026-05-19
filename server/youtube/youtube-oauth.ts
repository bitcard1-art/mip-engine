/**
 * YouTube OAuth 2.0 인증 모듈
 * - Google OAuth로 YouTube 채널 권한 획득
 * - Access Token / Refresh Token 관리
 * - 토큰 자동 갱신
 */
import crypto from "crypto";
import { ENV } from "../_core/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl", // 댓글 관리 (삭제, 차단, 스팸 처리)
];

export interface YouTubeTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  channelId?: string;
  channelTitle?: string;
}

/**
 * YouTube OAuth 인증 URL 생성
 * @param redirectUri - 콜백 URL (프론트엔드에서 전달)
 * @param state - CSRF 방지용 state (deviceId 등 포함)
 */
export function generateYouTubeAuthUrl(
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline", // refresh_token 받기 위해 필수
    prompt: "consent", // 매번 동의 화면 표시 (refresh_token 보장)
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Authorization code를 토큰으로 교환
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<YouTubeTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  };

  if (!data.refresh_token) {
    throw new Error("No refresh_token received. User may need to re-authorize with prompt=consent.");
  }

  // 채널 정보 가져오기
  const channelInfo = await fetchChannelInfo(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    channelId: channelInfo?.id,
    channelTitle: channelInfo?.title,
  };
}

/**
 * Refresh token으로 access token 갱신
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * 유효한 access token 반환 (만료 시 자동 갱신)
 */
export async function getValidAccessToken(
  tokens: YouTubeTokens
): Promise<string> {
  // 만료 5분 전에 미리 갱신
  if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    tokens.accessToken = refreshed.accessToken;
    tokens.expiresAt = refreshed.expiresAt;
  }
  return tokens.accessToken;
}

/**
 * 현재 인증된 사용자의 YouTube 채널 정보 조회
 */
async function fetchChannelInfo(
  accessToken: string
): Promise<{ id: string; title: string } | null> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: Array<{ id: string; snippet: { title: string } }>;
    };
    if (!data.items || data.items.length === 0) return null;
    return { id: data.items[0].id, title: data.items[0].snippet.title };
  } catch {
    return null;
  }
}

/**
 * OAuth state 생성 (CSRF 방지)
 */
export function generateOAuthState(deviceId: string, userId: string): string {
  const payload = JSON.stringify({ deviceId, userId, nonce: crypto.randomUUID() });
  return Buffer.from(payload).toString("base64url");
}

/**
 * OAuth state 파싱
 */
export function parseOAuthState(state: string): { deviceId: string; userId: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    if (!payload.deviceId || !payload.userId) return null;
    return { deviceId: payload.deviceId, userId: payload.userId };
  } catch {
    return null;
  }
}
