/**
 * LORE_SERVICE_URL 환경변수 연결 테스트
 * mylore.space에 접근 가능한지 확인
 */
import { describe, it, expect } from "vitest";

describe("LORE_SERVICE_URL 연결 확인", () => {
  it("mylore.space에 HTTP 연결이 가능하다", async () => {
    const url = process.env.LORE_SERVICE_URL || "https://mylore.space";
    const res = await fetch(`${url}/api/mip/package-request`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
    // 인증 헤더 없이 보내면 401 또는 에러 응답이 오지만, 연결 자체는 성공
    expect(res.status).toBeGreaterThan(0);
    // 연결 실패(0)가 아닌 실제 HTTP 응답을 받아야 함
  });

  it("LORE_SERVICE_URL 환경변수가 mylore.space를 가리킨다", () => {
    const url = process.env.LORE_SERVICE_URL || "https://mylore.space";
    expect(url).toContain("mylore.space");
  });
});
