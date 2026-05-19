/**
 * MIP 메시지 안심 엔진 테스트
 * 피싱 판정 로직 검증
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// DB mock
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// 모듈 import (DB mock 이후)
import { checkMessageSafety, type MessageCheckInput } from "./message-safety";

describe("Message Safety Engine", () => {
  const baseInput: MessageCheckInput = {
    userId: "test-user",
    channel: "sms",
    messageContent: "",
  };

  describe("안전한 메시지 판정", () => {
    it("일반 택배 알림은 safe로 판정", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "sms",
        senderNumber: "01012345678",
        senderName: "CJ대한통운",
        messageContent: "고객님의 택배가 배송완료 되었습니다. 감사합니다.",
      });

      expect(result.verdict).toBe("safe");
      expect(result.riskScore).toBeLessThan(40);
      expect(result.action).toBe("allow");
    });

    it("친구 메시지는 safe로 판정", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "kakaotalk",
        senderName: "김철수",
        messageContent: "오늘 저녁에 시간 돼? 밥 먹자",
      });

      expect(result.verdict).toBe("safe");
      expect(result.riskScore).toBeLessThan(40);
    });

    it("은행 정상 알림은 safe로 판정", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "sms",
        senderNumber: "15881111",
        senderName: "국민은행",
        messageContent: "출금 50,000원 잔액 1,234,567원",
      });

      expect(result.verdict).toBe("safe");
      expect(result.riskScore).toBeLessThan(40);
    });
  });

  describe("피싱 메시지 판정", () => {
    it("WhatsApp 보안센터 사칭 피싱 감지", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "whatsapp",
        senderNumber: "+22948125861",
        senderName: "WhatsApp 보안 센터 ✅",
        messageContent:
          "귀하의 계정이 비정상적인 네트워크를 사용하고 있으며 여러 위치에서 로그인 시도가 실패한 것으로 감지되었습니다. " +
          "이는 계정 도용 위험이 있음을 시사합니다! 귀하는 고위험 사용자로 분류되었습니다. " +
          '아래 "인증 시작" 버튼을 클릭하여 보안 센터에 접속하고 계정 위험 문제를 해결하세요. ' +
          "중요: 보안 인증을 완료하지 않으면 12시간 이내에 메시지 송수신 제한, 그룹 채팅 참여 및 생성 금지, " +
          "음성 통화 기능 정지, 심각한 경우 계정 정지가 적용됩니다.",
        messageUrl: "https://wa-security-verify.tk/auth",
      });

      expect(result.verdict).toBe("blocked");
      expect(result.riskScore).toBeGreaterThanOrEqual(80);
      expect(result.action).toBe("block");
      expect(result.scores.senderTrust).toBeGreaterThan(0);
      expect(result.scores.urgency).toBeGreaterThan(0);
      expect(result.scores.threat).toBeGreaterThan(0);
      expect(result.scores.linkRisk).toBeGreaterThan(0);
      expect(result.scores.impersonation).toBeGreaterThan(0);
    });

    it("SMS 스미싱 (택배 사칭) 감지", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "sms",
        senderNumber: "+821012345678",
        messageContent:
          "[CJ대한통운] 고객님 택배가 주소 불일치로 반송 처리됩니다. " +
          "즉시 아래 링크에서 주소를 확인해주세요. http://bit.ly/3xFake",
      });

      // +82 국내 번호이지만 단축URL + 긴급성 조합으로 의심
      expect(result.riskScore).toBeGreaterThanOrEqual(20);
      expect(result.scores.urgency).toBeGreaterThan(0);
      expect(result.scores.linkRisk).toBeGreaterThan(0);
    });

    it("금융기관 사칭 피싱 감지", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "sms",
        senderNumber: "+8215881234",
        senderName: "국민은행 보안 센터",
        messageContent:
          "[긴급] 고객님 계정에 비정상 접근이 감지되었습니다. " +
          "계정이 정지되기 전에 즉시 본인 확인을 완료하세요. " +
          "비밀번호와 인증 번호를 입력해주세요. https://kb-secure.xyz/verify",
      });

      expect(result.verdict).toBe("blocked");
      expect(result.riskScore).toBeGreaterThanOrEqual(75);
      expect(result.scores.urgency).toBeGreaterThan(0);
      expect(result.scores.threat).toBeGreaterThan(0);
      expect(result.scores.infoRequest).toBeGreaterThan(0);
      expect(result.scores.linkRisk).toBeGreaterThan(0);
    });

    it("해외 번호 + 링크 조합 감지", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "sms",
        senderNumber: "+23412345678",
        messageContent: "You won $1000! Click here to claim: http://192.168.1.1/prize",
      });

      expect(result.riskScore).toBeGreaterThanOrEqual(30);
      expect(result.scores.senderTrust).toBeGreaterThan(0);
      expect(result.scores.linkRisk).toBeGreaterThan(0);
    });
  });

  describe("의심 메시지 판정", () => {
    it("단축 URL만 포함된 메시지는 suspicious", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "sms",
        senderNumber: "01098765432",
        messageContent: "이벤트 당첨! 확인하세요 https://bit.ly/3abc123",
      });

      expect(result.riskScore).toBeGreaterThanOrEqual(10);
      expect(result.scores.linkRisk).toBeGreaterThan(0);
    });
  });

  describe("점수 산출 정확성", () => {
    it("riskScore는 0~100 범위", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        messageContent: "안녕하세요",
      });

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it("모든 개별 점수가 최대값을 초과하지 않음", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "whatsapp",
        senderNumber: "+22900000000",
        senderName: "보안 센터 ✅ 공식 안내",
        messageContent:
          "긴급! 즉시! 지금 바로! 마감! 계정 정지! 계정 차단! 계정 삭제! " +
          "비밀번호 인증 번호 카드 번호 계좌 번호 주민 번호 " +
          "클릭하세요 접속하세요 https://bit.ly/fake http://192.168.0.1/hack",
        messageUrl: "https://scam.tk/phish",
      });

      expect(result.scores.senderTrust).toBeLessThanOrEqual(30);
      expect(result.scores.urgency).toBeLessThanOrEqual(20);
      expect(result.scores.threat).toBeLessThanOrEqual(20);
      expect(result.scores.linkRisk).toBeLessThanOrEqual(25);
      expect(result.scores.impersonation).toBeLessThanOrEqual(15);
      expect(result.scores.infoRequest).toBeLessThanOrEqual(20);
    });

    it("checkId가 생성됨", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        messageContent: "테스트 메시지",
      });

      expect(result.checkId).toBeDefined();
      expect(result.checkId.length).toBeGreaterThan(0);
    });

    it("checkedAt 타임스탬프가 포함됨", async () => {
      const before = Date.now();
      const result = await checkMessageSafety({
        ...baseInput,
        messageContent: "테스트",
      });
      const after = Date.now();

      expect(result.checkedAt).toBeGreaterThanOrEqual(before);
      expect(result.checkedAt).toBeLessThanOrEqual(after);
    });
  });

  describe("verdictReason 구조", () => {
    it("safe 메시지는 안전 요약 포함", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        messageContent: "내일 회의 10시입니다.",
      });

      expect(result.verdictReason.summary).toContain("안전");
    });

    it("phishing 메시지는 위험 지표 목록 포함", async () => {
      const result = await checkMessageSafety({
        ...baseInput,
        channel: "whatsapp",
        senderNumber: "+22948125861",
        messageContent:
          "계정이 정지됩니다! 즉시 인증 시작 버튼을 클릭하세요. 비밀번호를 입력해주세요.",
        messageUrl: "https://fake.tk/auth",
      });

      expect(result.verdictReason.indicators.length).toBeGreaterThan(0);
      // blocked 또는 phishing 판정 확인
      expect(["phishing", "blocked"]).toContain(result.verdict);
    });
  });
});
