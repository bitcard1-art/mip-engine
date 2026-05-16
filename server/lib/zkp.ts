import { sha256Hash } from "./hmac";

/**
 * ZKP (Zero-Knowledge Proof) 선택적 공개 처리 기본 구현
 * PSDI §9 수식 18 기반
 *
 * 실제 운영 환경에서는 snarkjs, circom 등 ZKP 라이브러리 사용 권장
 * 본 구현은 PSDI 표준 기반 해시 커밋먼트 방식의 선택적 공개를 제공한다.
 */

export interface ZKPCommitment {
  commitment: string; // 해시 커밋먼트
  nonce: string; // 랜덤 논스
  revealedFields: string[]; // 공개된 필드 목록
}

export interface ZKPProof {
  proof: string;
  publicInputs: Record<string, unknown>;
  commitment: string;
  timestamp: number;
}

export interface SelectiveDisclosureResult {
  disclosed: Record<string, unknown>;
  proof: ZKPProof;
  hiddenCount: number;
}

/**
 * 데이터 커밋먼트 생성 (해시 기반)
 */
export function createCommitment(data: Record<string, unknown>, nonce: string): string {
  const payload = JSON.stringify({ data, nonce });
  return sha256Hash(payload);
}

/**
 * ZKP 기반 선택적 공개 처리 (PSDI §9 수식 18)
 * 지정된 필드만 공개하고 나머지는 해시 커밋먼트로 대체
 */
export function selectiveDisclose(
  data: Record<string, unknown>,
  fieldsToReveal: string[],
  nonce?: string
): SelectiveDisclosureResult {
  const actualNonce = nonce || generateNonce();
  const disclosed: Record<string, unknown> = {};
  const hidden: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (fieldsToReveal.includes(key)) {
      disclosed[key] = value;
    } else {
      hidden[key] = value;
    }
  }

  // 숨겨진 필드들의 커밋먼트 생성
  const hiddenCommitment = createCommitment(hidden, actualNonce);

  // ZKP 증명 생성 (해시 기반 시뮬레이션)
  const proofInput = {
    disclosed,
    hiddenCommitment,
    nonce: actualNonce,
    timestamp: Date.now(),
  };
  const proof: ZKPProof = {
    proof: sha256Hash(JSON.stringify(proofInput)),
    publicInputs: {
      disclosedFields: fieldsToReveal,
      hiddenCommitment,
    },
    commitment: createCommitment(data, actualNonce),
    timestamp: proofInput.timestamp,
  };

  return {
    disclosed,
    proof,
    hiddenCount: Object.keys(hidden).length,
  };
}

/**
 * ZKP 증명 검증
 */
export function verifyZKPProof(
  disclosed: Record<string, unknown>,
  proof: ZKPProof,
  nonce: string
): boolean {
  try {
    const proofInput = {
      disclosed,
      hiddenCommitment: proof.publicInputs.hiddenCommitment,
      nonce,
      timestamp: proof.timestamp,
    };
    const expectedProof = sha256Hash(JSON.stringify(proofInput));
    return expectedProof === proof.proof;
  } catch {
    return false;
  }
}

/**
 * DNA 데이터 선택적 공개 (개인정보 보호)
 * 민감 지표는 숨기고 이식에 필요한 지표만 공개
 */
export function discloseDNASelectively(
  dnaIndicators: Record<string, number>,
  requiredIndicators: string[]
): SelectiveDisclosureResult {
  return selectiveDisclose(
    dnaIndicators as Record<string, unknown>,
    requiredIndicators
  );
}

/**
 * 랜덤 논스 생성
 */
export function generateNonce(): string {
  return sha256Hash(`${Date.now()}-${Math.random()}-${process.pid}`);
}
