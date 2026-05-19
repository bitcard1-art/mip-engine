/**
 * MIP 메시지 안심 엔진 (Message Safety Engine)
 *
 * AI Agent가 수신한 메시지(SMS, WhatsApp, LINE, 카카오톡 등)의
 * 피싱/스미싱/사기 여부를 판정하는 엔진.
 *
 * 판정 기준 6가지:
 *   1. 발신자 신뢰도 (senderTrust) — 0~30점
 *   2. 긴급성 강조 (urgency) — 0~20점
 *   3. 계정 위협 언급 (threat) — 0~20점
 *   4. 외부 링크 위험도 (linkRisk) — 0~25점
 *   5. 공식 사칭 (impersonation) — 0~15점
 *   6. 개인정보 요구 (infoRequest) — 0~20점
 *
 * 합산 점수 (0~130 → 정규화 0~100):
 *   0~39: safe (안전)
 *   40~59: suspicious (주의)
 *   60~100: phishing (피싱)
 *   80+: blocked (자동 차단)
 */

import { nanoid } from "nanoid";
import { getDb } from "../db";
import { mipMessageChecks, type InsertMipMessageCheck } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── 피싱 패턴 DB ────────────────────────────────────────────────────────────

/** 발신자 신뢰도 판정 (0~30) — 점수가 높을수록 위험 */
const UNTRUSTED_SENDER_PATTERNS = {
  // 해외 국번 (피싱 빈출 국가)
  foreignNumbers: [
    /^\+229/, /^\+234/, /^\+233/, /^\+225/, /^\+228/, // 서아프리카
    /^\+91\d{5,}/, // 인도 (대량 스팸)
    /^\+63/, /^\+62/, // 동남아
  ],
  // 짧은 번호 사칭 (실제 공식 번호가 아닌 경우)
  shortCodeSpoof: [/^\d{4,6}$/],
  // 알 수 없는 발신자
  unknownSender: [/^unknown/i, /^private/i, /^no.?caller/i],
};

/** 긴급성 강조 패턴 (0~20) */
const URGENCY_PATTERNS = [
  /즉시/,
  /긴급/,
  /지금 바로/,
  /시간 내/,
  /\d+시간 이내/,
  /\d+분 이내/,
  /마감/,
  /immediately/i,
  /urgent/i,
  /right now/i,
  /within \d+ (hour|minute)/i,
  /expires? (soon|today|in)/i,
  /act now/i,
  /last chance/i,
  /마지막 기회/,
  /오늘까지/,
  /기한 만료/,
];

/** 계정 위협 패턴 (0~20) */
const THREAT_PATTERNS = [
  /계정.*(정지|제한|차단|삭제|비활성)/,
  /계정.*(위험|도용|해킹)/,
  /서비스.*(중단|제한|차단)/,
  /이용.*(제한|정지|불가)/,
  /account.*(suspend|restrict|block|delet|disabl)/i,
  /account.*(risk|compromis|hack)/i,
  /service.*(terminat|restrict|suspend)/i,
  /메시지.*제한/,
  /통화.*정지/,
  /기능.*제한/,
  /고위험 사용자/,
  /비정상.*활동/,
  /unauthorized.*access/i,
  /unusual.*activity/i,
];

/** 외부 링크 위험도 패턴 (0~25) */
const LINK_RISK_PATTERNS = {
  // 단축 URL (피싱 은닉)
  shortUrls: [
    /bit\.ly/i, /tinyurl/i, /t\.co/i, /goo\.gl/i, /ow\.ly/i,
    /is\.gd/i, /v\.gd/i, /buff\.ly/i, /adf\.ly/i,
    /rb\.gy/i, /cutt\.ly/i, /shorturl/i,
  ],
  // 의심스러운 도메인 패턴
  suspiciousDomains: [
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP 주소 직접
    /[a-z0-9]+-[a-z0-9]+-[a-z0-9]+\.[a-z]{2,}/i, // 랜덤 하이픈 도메인
    /\.(tk|ml|ga|cf|gq|xyz|top|buzz|click|link)\b/i, // 무료/스팸 TLD
    /[a-z]{20,}\./i, // 매우 긴 서브도메인
  ],
  // 클릭 유도 문구
  clickBait: [
    /클릭/,
    /눌러/,
    /접속/,
    /링크.*확인/,
    /아래.*버튼/,
    /인증.*시작/,
    /click here/i,
    /tap (here|below|this)/i,
    /follow.*link/i,
    /open.*link/i,
    /verify.*link/i,
  ],
};

/** 공식 사칭 패턴 (0~15) */
const IMPERSONATION_PATTERNS = [
  /보안 센터/,
  /고객 센터/,
  /공식.*안내/,
  /security center/i,
  /official.*notice/i,
  /customer.*support/i,
  /✅/, /☑️/, /🔒/, /🛡️/, // 신뢰 이모지 남용
  /\[공식\]/, /\[official\]/i,
  /인증.*마크/,
  /verified.*badge/i,
  /from.*team/i,
  /support.*team/i,
];

/** 개인정보 요구 패턴 (0~20) */
const INFO_REQUEST_PATTERNS = [
  /비밀번호/,
  /인증.*번호/,
  /카드.*번호/,
  /계좌.*번호/,
  /주민.*번호/,
  /본인.*확인/,
  /신분.*증/,
  /password/i,
  /verification.*code/i,
  /card.*number/i,
  /account.*number/i,
  /social.*security/i,
  /identity.*verif/i,
  /OTP/,
  /PIN/i,
  /CVV/i,
  /보안.*코드/,
  /인증서/,
];

// ─── 점수 산출 함수 ──────────────────────────────────────────────────────────

function scoreSenderTrust(senderNumber: string | null | undefined, senderName: string | null | undefined): number {
  if (!senderNumber && !senderName) return 20; // 발신자 정보 없음 → 높은 위험

  let score = 0;
  const num = senderNumber ?? "";

  // 해외 국번 체크
  for (const pattern of UNTRUSTED_SENDER_PATTERNS.foreignNumbers) {
    if (pattern.test(num)) { score += 30; break; }
  }

  // 짧은 번호 사칭
  for (const pattern of UNTRUSTED_SENDER_PATTERNS.shortCodeSpoof) {
    if (pattern.test(num) && num.length < 7) { score += 15; break; }
  }

  // 알 수 없는 발신자
  const name = senderName ?? "";
  for (const pattern of UNTRUSTED_SENDER_PATTERNS.unknownSender) {
    if (pattern.test(name)) { score += 20; break; }
  }

  return Math.min(score, 30);
}

function scoreUrgency(content: string): number {
  let score = 0;
  for (const pattern of URGENCY_PATTERNS) {
    if (pattern.test(content)) {
      score += 10;
    }
  }
  return Math.min(score, 20);
}

function scoreThreat(content: string): number {
  let score = 0;
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(content)) {
      score += 10;
    }
  }
  return Math.min(score, 20);
}

function scoreLinkRisk(content: string, messageUrl: string | null | undefined): number {
  let score = 0;
  const combined = `${content} ${messageUrl ?? ""}`;

  // URL 존재 여부
  const hasUrl = /https?:\/\/|www\./i.test(combined) || !!messageUrl;
  if (!hasUrl) return 0;

  // 단축 URL
  for (const pattern of LINK_RISK_PATTERNS.shortUrls) {
    if (pattern.test(combined)) { score += 18; break; }
  }

  // 의심스러운 도메인
  for (const pattern of LINK_RISK_PATTERNS.suspiciousDomains) {
    if (pattern.test(combined)) { score += 15; break; }
  }

  // 클릭 유도 문구
  for (const pattern of LINK_RISK_PATTERNS.clickBait) {
    if (pattern.test(content)) { score += 8; break; }
  }

  // URL이 있으면 기본 점수
  if (hasUrl && score === 0) score = 5;

  return Math.min(score, 25);
}

function scoreImpersonation(content: string, senderName: string | null | undefined): number {
  let score = 0;
  const combined = `${content} ${senderName ?? ""}`;

  for (const pattern of IMPERSONATION_PATTERNS) {
    if (pattern.test(combined)) {
      score += 8;
    }
  }
  return Math.min(score, 15);
}

function scoreInfoRequest(content: string): number {
  let score = 0;
  for (const pattern of INFO_REQUEST_PATTERNS) {
    if (pattern.test(content)) {
      score += 10;
    }
  }
  return Math.min(score, 20);
}

// ─── 메인 판정 함수 ──────────────────────────────────────────────────────────

export interface MessageCheckInput {
  userId: string;
  sessionId?: string;
  deviceId?: string;
  channel: "sms" | "whatsapp" | "line" | "telegram" | "kakaotalk" | "instagram" | "rcs" | "other";
  senderNumber?: string;
  senderName?: string;
  messageContent: string;
  messageUrl?: string;
}

export interface MessageCheckResult {
  checkId: string;
  riskScore: number;           // 0~100
  verdict: "safe" | "suspicious" | "phishing" | "blocked";
  verdictReason: VerdictReason;
  scores: {
    senderTrust: number;
    urgency: number;
    threat: number;
    linkRisk: number;
    impersonation: number;
    infoRequest: number;
  };
  action: "allow" | "warn" | "hold" | "block";
  checkedAt: number;
}

interface VerdictReason {
  summary: string;
  indicators: string[];
}

/**
 * 메시지 피싱 판정 — 6가지 지표 점수 합산 후 판정
 */
export async function checkMessageSafety(input: MessageCheckInput): Promise<MessageCheckResult> {
  const now = Date.now();

  // 6가지 지표 점수 산출
  const senderTrust = scoreSenderTrust(input.senderNumber, input.senderName);
  const urgency = scoreUrgency(input.messageContent);
  const threat = scoreThreat(input.messageContent);
  const linkRisk = scoreLinkRisk(input.messageContent, input.messageUrl);
  const impersonation = scoreImpersonation(input.messageContent, input.senderName);
  const infoRequest = scoreInfoRequest(input.messageContent);

  // 합산 (최대 130) → 정규화 (0~100)
  const rawTotal = senderTrust + urgency + threat + linkRisk + impersonation + infoRequest;
  let riskScore = Math.min(Math.round((rawTotal / 130) * 100), 100);

  // 복합 지표 보너스: 3개 이상 지표가 동시에 높으면 추가 점수
  const activeIndicators = [
    senderTrust >= 15,
    urgency >= 10,
    threat >= 10,
    linkRisk >= 10,
    impersonation >= 8,
    infoRequest >= 10,
  ].filter(Boolean).length;

  if (activeIndicators >= 4) riskScore = Math.min(riskScore + 20, 100);
  else if (activeIndicators >= 3) riskScore = Math.min(riskScore + 10, 100);

  // 판정
  let verdict: "safe" | "suspicious" | "phishing" | "blocked";
  let action: "allow" | "warn" | "hold" | "block";

  if (riskScore >= 75) {
    verdict = "blocked";
    action = "block";
  } else if (riskScore >= 50) {
    verdict = "phishing";
    action = "hold";
  } else if (riskScore >= 30) {
    verdict = "suspicious";
    action = "warn";
  } else {
    verdict = "safe";
    action = "allow";
  }

  // 판정 근거 생성
  const indicators: string[] = [];
  if (senderTrust >= 15) indicators.push(`발신자 미신뢰 (${senderTrust}점)`);
  if (urgency >= 7) indicators.push(`긴급성 강조 (${urgency}점)`);
  if (threat >= 7) indicators.push(`계정 위협 언급 (${threat}점)`);
  if (linkRisk >= 10) indicators.push(`외부 링크 위험 (${linkRisk}점)`);
  if (impersonation >= 5) indicators.push(`공식 사칭 의심 (${impersonation}점)`);
  if (infoRequest >= 7) indicators.push(`개인정보 요구 (${infoRequest}점)`);

  const summary = verdict === "safe"
    ? "안전한 메시지입니다."
    : verdict === "suspicious"
    ? "주의가 필요한 메시지입니다. 링크 클릭에 주의하세요."
    : verdict === "phishing"
    ? "피싱 메시지로 판정되었습니다. 링크를 클릭하지 마세요."
    : "피싱 메시지가 자동 차단되었습니다.";

  const verdictReason: VerdictReason = { summary, indicators };

  // DB 저장
  const checkId = nanoid();
  const userAction = verdict === "blocked" ? "auto_blocked" as const : "pending" as const;

  const db = await getDb();
  if (db) {
    try {
      await db.insert(mipMessageChecks).values({
        id: checkId,
        userId: input.userId,
        sessionId: input.sessionId,
        deviceId: input.deviceId,
        channel: input.channel,
        senderNumber: input.senderNumber,
        senderName: input.senderName,
        messageContent: input.messageContent,
        messageUrl: input.messageUrl,
        riskScore,
        verdict,
        verdictReason: JSON.stringify(verdictReason),
        senderTrustScore: senderTrust,
        urgencyScore: urgency,
        threatScore: threat,
        linkRiskScore: linkRisk,
        impersonationScore: impersonation,
        infoRequestScore: infoRequest,
        userAction,
        checkedAt: now,
        createdAt: now,
      });
    } catch (err) {
      console.error("[MessageSafety] DB 저장 오류:", err);
    }
  }

  return {
    checkId,
    riskScore,
    verdict,
    verdictReason,
    scores: {
      senderTrust,
      urgency,
      threat,
      linkRisk,
      impersonation,
      infoRequest,
    },
    action,
    checkedAt: now,
  };
}

// ─── 메시지 이력 조회 ────────────────────────────────────────────────────────

export async function getMessageHistory(filters: {
  userId: string;
  channel?: string;
  verdict?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(mipMessageChecks.userId, filters.userId)];

  const rows = await db
    .select()
    .from(mipMessageChecks)
    .where(and(...conditions))
    .orderBy(desc(mipMessageChecks.checkedAt))
    .limit(filters.limit ?? 50);

  // 추가 필터 (channel, verdict)
  return rows.filter((r) => {
    if (filters.channel && r.channel !== filters.channel) return false;
    if (filters.verdict && r.verdict !== filters.verdict) return false;
    return true;
  });
}

// ─── 사용자 액션 (승인/차단) ─────────────────────────────────────────────────

export async function approveMessage(checkId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(mipMessageChecks)
      .set({ userAction: "approved", userActionAt: Date.now() })
      .where(eq(mipMessageChecks.id, checkId));
    return true;
  } catch (err) {
    console.error("[MessageSafety] 승인 처리 오류:", err);
    return false;
  }
}

export async function rejectMessage(checkId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(mipMessageChecks)
      .set({ userAction: "rejected", userActionAt: Date.now() })
      .where(eq(mipMessageChecks.id, checkId));
    return true;
  } catch (err) {
    console.error("[MessageSafety] 차단 처리 오류:", err);
    return false;
  }
}

// ─── 통계 조회 ───────────────────────────────────────────────────────────────

export async function getMessageStats(userId: string) {
  const db = await getDb();
  if (!db) return { total: 0, safe: 0, suspicious: 0, phishing: 0, blocked: 0 };

  const rows = await db
    .select()
    .from(mipMessageChecks)
    .where(eq(mipMessageChecks.userId, userId));

  return {
    total: rows.length,
    safe: rows.filter(r => r.verdict === "safe").length,
    suspicious: rows.filter(r => r.verdict === "suspicious").length,
    phishing: rows.filter(r => r.verdict === "phishing").length,
    blocked: rows.filter(r => r.verdict === "blocked").length,
  };
}
