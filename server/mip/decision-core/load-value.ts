/**
 * 판단 코어 1단계: 가치 로드 (loadValue)
 *
 * HMAC 검증 후 Readonly로 동결하여 반환.
 * 가드: HMAC 불일치 시 halt(INTEGRITY_FAILED).
 * 반환 타입은 반드시 Readonly — 후속 단계가 수정 시도하면 컴파일 에러. (G1)
 */
import { verifyHmacSignature } from "../../lib/hmac";
import type {
  ValueSlot,
  ImmutableValue,
  StageResult,
  CoreValues,
  DDRAnchor,
} from "../../../shared/decision-core-types";

/**
 * ValueSlot의 rawValues를 파싱하여 CoreValues + DDRAnchor 구조로 변환
 */
function parseRawValues(raw: unknown): { coreValues: CoreValues; ddrAnchors: DDRAnchor[] } {
  const data = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;

  const coreValues: CoreValues = Object.freeze({
    primaryValues: Object.freeze((data.primaryValues as string[]) ?? []),
    boundaries: Object.freeze((data.boundaries as string[]) ?? []),
    preferences: Object.freeze((data.preferences as string[]) ?? []),
  });

  const rawAnchors = (data.ddrAnchors as Array<Record<string, unknown>>) ?? [];
  const ddrAnchors: DDRAnchor[] = rawAnchors.map((a) =>
    Object.freeze({
      dimension: String(a.dimension ?? ""),
      weight: Number(a.weight ?? 0),
      description: String(a.description ?? ""),
    })
  );

  return { coreValues, ddrAnchors };
}

/**
 * 가치 로드 — HMAC 검증 후 불변 객체로 동결
 */
export function loadValue(slot: ValueSlot): StageResult<ImmutableValue> {
  // HMAC 검증: rawValues를 JSON 직렬화한 값과 slot.hmac 비교
  const payload = typeof slot.rawValues === "string"
    ? slot.rawValues
    : JSON.stringify(slot.rawValues);

  const isValid = verifyHmacSignature(payload, slot.hmac);

  if (!isValid) {
    return {
      halt: true,
      reason: "INTEGRITY_FAILED",
      detail: `ValueSlot ${slot.slotId} HMAC verification failed — value integrity compromised`,
    };
  }

  // 파싱 및 Readonly 동결
  const { coreValues, ddrAnchors } = parseRawValues(slot.rawValues);

  const immutableValue: ImmutableValue = Object.freeze({
    coreValues,
    ddrAnchors: Object.freeze(ddrAnchors),
    hmacDigest: slot.hmac,
  });

  return { ok: true, value: immutableValue };
}
