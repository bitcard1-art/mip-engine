/**
 * 판단 코어 2단계: 정체성 로드 (loadIdentity)
 *
 * 동일 DID라도 authority는 현재 기기 범위로 한정.
 * 크로스 런타임 권한 승계 금지.
 */
import type { Identity, Authority, PersonaPackage } from "../../../shared/decision-core-types";

export interface IdentityResult {
  self: Identity;
  authority: Authority;
}

/**
 * 정체성 및 권한 로드
 * - authority는 현재 기기 범위(deviceScope)로 한정
 * - 만료된 권한은 빈 범주로 축소
 */
export function loadIdentity(pkg: PersonaPackage): IdentityResult {
  const now = Date.now();

  // 권한 만료 확인 — 만료 시 범주를 빈 배열로 축소 (실질적 halt 효과)
  const isExpired = pkg.authority.expiresAt > 0 && pkg.authority.expiresAt < now;

  const authority: Authority = isExpired
    ? Object.freeze({
        ...pkg.authority,
        categories: Object.freeze([] as string[]),
        amountLimit: 0,
        tierLimit: 0,
      })
    : pkg.authority;

  return {
    self: pkg.identity,
    authority,
  };
}
