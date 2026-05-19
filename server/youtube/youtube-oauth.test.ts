import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env
vi.mock("../_core/env", () => ({
  ENV: {
    googleClientId: "test-client-id.apps.googleusercontent.com",
    googleClientSecret: "GOCSPX-test-secret",
  },
}));

describe("YouTube OAuth Module", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("generateAuthUrl", () => {
    it("올바른 Google OAuth URL을 생성해야 한다", async () => {
      const { generateYouTubeAuthUrl } = await import("./youtube-oauth");
      const url = generateYouTubeAuthUrl("channel-123", "user-456", "https://example.com");

      expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url).toContain("client_id=test-client-id.apps.googleusercontent.com");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("scope=");
      expect(url).toContain("youtube.force-ssl");
      expect(url).toContain("access_type=offline");
      expect(url).toContain("prompt=consent");
      expect(url).toContain("state=");
    });

    it("state에 deviceId와 userId가 인코딩되어야 한다", async () => {
      const { generateOAuthState } = await import("./youtube-oauth");
      const state = generateOAuthState("ch-1", "user-1");
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      expect(decoded.deviceId).toBe("ch-1");
      expect(decoded.userId).toBe("user-1");
    });
  });

  describe("generateOAuthState / parseOAuthState", () => {
    it("state를 생성하고 파싱할 수 있어야 한다", async () => {
      const { generateOAuthState, parseOAuthState } = await import("./youtube-oauth");
      const state = generateOAuthState("device-abc", "user-xyz");
      const decoded = parseOAuthState(state);
      expect(decoded).not.toBeNull();
      expect(decoded!.deviceId).toBe("device-abc");
      expect(decoded!.userId).toBe("user-xyz");
    });
  });

  describe("refreshAccessToken", () => {
    it("Google 토큰 갱신 API를 호출해야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: "new-access-token",
          expires_in: 3600,
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { refreshAccessToken } = await import("./youtube-oauth");
      const result = await refreshAccessToken("test-refresh-token");

      expect(result.accessToken).toBe("new-access-token");
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({ method: "POST" })
      );

      vi.unstubAllGlobals();
    });

    it("갱신 실패 시 에러를 던져야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("invalid_grant"),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { refreshAccessToken } = await import("./youtube-oauth");
      await expect(refreshAccessToken("bad-token")).rejects.toThrow("Google token refresh failed");

      vi.unstubAllGlobals();
    });
  });

  describe("getValidAccessToken", () => {
    it("토큰이 유효하면 그대로 반환해야 한다", async () => {
      const { getValidAccessToken } = await import("./youtube-oauth");
      const tokens = {
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 30 * 60 * 1000, // 30분 후 만료
      };
      const result = await getValidAccessToken(tokens);
      expect(result).toBe("valid-token");
    });

    it("토큰이 만료 임박하면 갱신해야 한다", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: "refreshed-token",
          expires_in: 3600,
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getValidAccessToken } = await import("./youtube-oauth");
      const tokens = {
        accessToken: "expired-token",
        refreshToken: "my-refresh-token",
        expiresAt: Date.now() - 1000, // 이미 만료
      };
      const result = await getValidAccessToken(tokens);
      expect(result).toBe("refreshed-token");
      expect(tokens.accessToken).toBe("refreshed-token");

      vi.unstubAllGlobals();
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("인증 코드를 토큰으로 교환해야 한다", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          // Token exchange
          ok: true,
          json: () => Promise.resolve({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          // Channel info fetch
          ok: true,
          json: () => Promise.resolve({
            items: [{ id: "UC123", snippet: { title: "Test Channel" } }],
          }),
        });
      vi.stubGlobal("fetch", mockFetch);

      const { exchangeCodeForTokens } = await import("./youtube-oauth");
      const result = await exchangeCodeForTokens("auth-code", "https://example.com/api/youtube/callback");

      expect(result.accessToken).toBe("new-access");
      expect(result.refreshToken).toBe("new-refresh");
      expect(result.channelId).toBe("UC123");
      expect(result.channelTitle).toBe("Test Channel");

      vi.unstubAllGlobals();
    });
  });
});
