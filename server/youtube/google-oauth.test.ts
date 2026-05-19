/**
 * Google OAuth 환경변수 검증 테스트
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET이 올바르게 설정되어 있는지 확인
 */
import { describe, it, expect } from "vitest";

describe("Google OAuth 환경변수 검증", () => {
  it("GOOGLE_CLIENT_ID가 설정되어 있다", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId).toBeTruthy();
    expect(clientId).toContain(".apps.googleusercontent.com");
  });

  it("GOOGLE_CLIENT_SECRET이 설정되어 있다", () => {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    expect(clientSecret).toBeTruthy();
    expect(clientSecret!.startsWith("GOCSPX-")).toBe(true);
  });

  it("Google OAuth tokeninfo 엔드포인트에 접근 가능하다", async () => {
    // Google의 OAuth2 discovery endpoint 접근 확인
    const res = await fetch("https://accounts.google.com/.well-known/openid-configuration", {
      signal: AbortSignal.timeout(10_000),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.authorization_endpoint).toContain("accounts.google.com");
    expect(data.token_endpoint).toContain("oauth2.googleapis.com");
  });
});
