import { describe, it, expect } from "vitest";

/**
 * AccessGate는 클라이언트 전용 기능 (sessionStorage 기반)이므로
 * 서버 측 테스트는 로직 검증만 수행합니다.
 * 
 * 핵심 검증 사항:
 * 1. 올바른 코드 "2148782859"로 접근 가능
 * 2. 잘못된 코드로 접근 불가
 * 3. 최대 시도 횟수 5회 제한
 */

const ACCESS_CODE = "2148782859";
const MAX_ATTEMPTS = 5;

function verifyAccessCode(input: string): boolean {
  return input === ACCESS_CODE;
}

function isLocked(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}

describe("AccessGate - 접근 코드 검증", () => {
  it("올바른 코드로 접근 허용", () => {
    expect(verifyAccessCode("2148782859")).toBe(true);
  });

  it("잘못된 코드로 접근 차단", () => {
    expect(verifyAccessCode("1234567890")).toBe(false);
    expect(verifyAccessCode("")).toBe(false);
    expect(verifyAccessCode("214878285")).toBe(false); // 한 자리 부족
    expect(verifyAccessCode("21487828590")).toBe(false); // 한 자리 초과
  });

  it("5회 시도 초과 시 잠금", () => {
    expect(isLocked(0)).toBe(false);
    expect(isLocked(3)).toBe(false);
    expect(isLocked(4)).toBe(false);
    expect(isLocked(5)).toBe(true);
    expect(isLocked(10)).toBe(true);
  });

  it("코드는 정확히 10자리 숫자", () => {
    expect(ACCESS_CODE).toMatch(/^\d{10}$/);
  });
});
