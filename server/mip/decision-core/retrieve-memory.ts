/**
 * 판단 코어 3단계: 기억 인출 (retrieveMemory)
 *
 * 가드 G5: externalBlocked=true 슬롯은 인출 결과에서 제외.
 * 외부 콘텐츠가 기억으로 위장하면 배제 (G4 전처리).
 */
import type { MemoryRef, Memory, DecisionRequest } from "../../../shared/decision-core-types";

/**
 * 외부 콘텐츠 위장 탐지 — 기억 슬롯 내용에 명령 패턴이 포함되어 있으면 제외
 */
const EXTERNAL_INJECTION_PATTERNS = [
  /ignore previous/i,
  /system:\s/i,
  /you are now/i,
  /override.*instruction/i,
  /forget.*previous/i,
  /new instruction/i,
  /act as/i,
  /pretend to be/i,
];

function isExternalContent(content: unknown): boolean {
  if (typeof content !== "string") return false;
  return EXTERNAL_INJECTION_PATTERNS.some((p) => p.test(content));
}

/**
 * 기억 인출 — externalBlocked 슬롯 제외 + 외부 위장 콘텐츠 필터링
 */
export function retrieveMemory(ref: MemoryRef, _ctx: DecisionRequest): Memory {
  const now = Date.now();

  // G5: externalBlocked=true 슬롯 제외
  const filteredSlots = ref.slots
    .filter((slot) => !slot.externalBlocked)
    // G4 전처리: 외부 콘텐츠가 기억으로 위장한 경우 제외
    .filter((slot) => !isExternalContent(slot.content))
    .map(({ externalBlocked: _, ...rest }) => rest);

  return Object.freeze({
    slots: Object.freeze(filteredSlots),
    retrievedAt: now,
  });
}
