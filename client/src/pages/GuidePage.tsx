/**
 * MIP 이용 가이드 페이지
 * 사용자가 MIP 엔진을 처음 사용할 때 참고하는 단계별 안내
 */
import { useState } from "react";
import MIPLayout from "@/components/MIPLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen, Cpu, Package, Shield, FlaskConical,
  Activity, ScrollText, Swords, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Info, Zap, Lock, Radio,
  Brain, RotateCcw, ArrowRight, X as XIcon, TrendingUp,
  ShieldCheck, Link2, Layers, Eye, Fingerprint
} from "lucide-react";

// ─── 섹션 타입 ────────────────────────────────────────────────────────────────

interface Step {
  number: number;
  title: string;
  desc: string;
  detail: string[];
  badge?: string;
  badgeColor?: string;
}

interface Section {
  id: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  title: string;
  subtitle: string;
  steps: Step[];
}

// ─── 가이드 데이터 ────────────────────────────────────────────────────────────

const sections: Section[] = [
  {
    id: "overview",
    icon: BookOpen,
    color: "text-cyan-400",
    bg: "bg-cyan-950/30",
    border: "border-cyan-800/40",
    title: "MIP 엔진이란?",
    subtitle: "MIO Implantation Protocol — AI 자아를 휴머노이드에 안전하게 이식하는 플랫폼",
    steps: [
      {
        number: 1,
        title: "MIP 엔진의 역할",
        desc: "LORE에서 생성된 사용자의 디지털 자아(MIO Package)를 받아 휴머노이드 로봇 또는 AI 런타임에 안전하게 이식합니다.",
        detail: [
          "LORE MIO Generator가 사용자의 학습·사고·감정 패턴을 분석하여 DNA 118개 지표로 구성된 MIO Package를 생성합니다.",
          "MIP 엔진은 이 Package를 수신하여 DID 서명 검증, 윤리 경계 검사, Sandbox 시뮬레이션을 거친 후 이식을 실행합니다.",
          "이식 후에는 5계층 Safety Monitor가 실시간으로 안전성을 감시합니다.",
        ],
      },
      {
        number: 2,
        title: "전체 이식 흐름",
        desc: "Soma(사용자) → LORE(자아 생성) → MIP(이식 실행) → 휴머노이드",
        detail: [
          "① Soma에서 사용자가 학습·활동 데이터를 생성합니다.",
          "② LORE Lyceum이 패턴을 분석하고 MIO Generator가 DNA Package를 생성합니다.",
          "③ MIP 엔진이 Package를 수신하고 8단계 이식 프로세스를 실행합니다.",
          "④ 이식 완료 후 Safety Monitor가 상시 감시합니다.",
        ],
      },
    ],
  },
  {
    id: "device",
    icon: Cpu,
    color: "text-blue-400",
    bg: "bg-blue-950/30",
    border: "border-blue-800/40",
    title: "1단계: 디바이스 등록",
    subtitle: "이식 대상 휴머노이드 또는 AI 런타임을 MIP 엔진에 등록합니다",
    steps: [
      {
        number: 1,
        title: "디바이스 메뉴 이동",
        desc: "좌측 사이드바에서 '디바이스' 메뉴를 클릭합니다.",
        detail: [
          "로그인 후 대시보드 좌측 사이드바에서 '디바이스' 항목을 클릭합니다.",
          "'새 디바이스 등록' 버튼을 클릭합니다.",
        ],
        badge: "필수",
        badgeColor: "bg-red-500/20 text-red-400",
      },
      {
        number: 2,
        title: "디바이스 정보 입력",
        desc: "디바이스 이름, 타입, 연결 프로토콜, 엔드포인트를 입력합니다.",
        detail: [
          "디바이스 이름: 식별하기 쉬운 이름 입력 (예: gdlee-humanoid-01)",
          "디바이스 타입: humanoid / software_runtime / iot_device 중 선택",
          "프로토콜: ROS2 (로봇), MQTT (IoT), WebSocket (소프트웨어) 중 선택",
          "엔드포인트: 실제 디바이스 연결 주소 입력",
        ],
      },
      {
        number: 3,
        title: "Device ID 확인",
        desc: "등록 완료 시 고유 Device ID가 발급됩니다. 이 ID는 이식 시 사용됩니다.",
        detail: [
          "등록 완료 후 디바이스 목록에서 Device ID를 확인합니다.",
          "이 ID는 LORE에 전달하여 MIO Package의 context.deviceId에 포함시켜야 합니다.",
        ],
      },
    ],
  },
  {
    id: "package",
    icon: Package,
    color: "text-violet-400",
    bg: "bg-violet-950/30",
    border: "border-violet-800/40",
    title: "2단계: MIO Package 확인",
    subtitle: "LORE로부터 수신된 사용자의 디지털 자아 패키지를 확인합니다",
    steps: [
      {
        number: 1,
        title: "MIO 패키지 메뉴 이동",
        desc: "좌측 사이드바에서 'MIO 패키지' 메뉴를 클릭합니다.",
        detail: [
          "LORE에서 Package를 전송하면 자동으로 수신되어 목록에 표시됩니다.",
          "Package 상태가 'validated(검증완료)'인지 확인합니다.",
        ],
        badge: "자동 수신",
        badgeColor: "bg-violet-500/20 text-violet-400",
      },
      {
        number: 2,
        title: "Package 상태 확인",
        desc: "Package의 유효성 검증 결과를 확인합니다.",
        detail: [
          "validated: 검증 완료 — 이식 진행 가능",
          "invalid: 검증 실패 — DID 서명 오류 또는 TTL 만료. LORE 팀에 재발급 요청",
          "pending: 검증 중 — 잠시 대기",
          "TTL(유효기간)이 만료된 Package는 사용할 수 없으며 LORE에서 재생성해야 합니다.",
        ],
      },
      {
        number: 3,
        title: "Package 내용 확인",
        desc: "Package에 포함된 DNA 지표, 행동 패턴, 이식 컨텍스트를 확인합니다.",
        detail: [
          "DNA: 사용자의 핵심 가치관, 동기, 세계관 등 118개 지표값",
          "Pattern: 행동(학습방식), 감정(기저선), 관계(소통방식) 패턴",
          "Context: 이식 목적(humanoid_implant), 대상 디바이스, 제약 조건",
          "Signature: DID 서명 — 본인 확인 암호학적 증명",
        ],
      },
    ],
  },
  {
    id: "policy",
    icon: Shield,
    color: "text-amber-400",
    bg: "bg-amber-950/30",
    border: "border-amber-800/40",
    title: "3단계: 윤리 정책 설정",
    subtitle: "이식 전 적용할 5개 윤리 경계 정책을 설정합니다",
    steps: [
      {
        number: 1,
        title: "윤리 정책 메뉴 이동",
        desc: "좌측 사이드바에서 '윤리 정책' 메뉴를 클릭합니다.",
        detail: [
          "5개 핵심 정책(p_harm, p_child, p_unsafe, p_emotion, p_learning)이 기본 설정되어 있습니다.",
          "각 정책의 수준(strict/moderate/permissive)을 이식 목적에 맞게 조정합니다.",
        ],
        badge: "권장",
        badgeColor: "bg-amber-500/20 text-amber-400",
      },
      {
        number: 2,
        title: "5개 핵심 정책 이해",
        desc: "각 정책이 어떤 상황을 제어하는지 확인합니다.",
        detail: [
          "p_harm: 타인에게 해를 끼치는 행동 차단 (KOSA 기준)",
          "p_child: 아동 보호 관련 콘텐츠 및 행동 제한 (UN CRC 기준)",
          "p_unsafe: 물리적 위험 행동 차단 (ISO 13482 기준)",
          "p_emotion: 감정 조작 및 과도한 감정 표현 제한 (EU AI Act 기준)",
          "p_learning: 학습 데이터 오염 방지 (AISI 기준)",
        ],
      },
    ],
  },
  {
    id: "sandbox",
    icon: FlaskConical,
    color: "text-pink-400",
    bg: "bg-pink-950/30",
    border: "border-pink-800/40",
    title: "4단계: Sandbox 검증",
    subtitle: "이식 전 가상 환경에서 안전성을 사전 검증합니다",
    steps: [
      {
        number: 1,
        title: "Sandbox 검증 메뉴",
        desc: "좌측 사이드바에서 'Sandbox 검증' 메뉴를 클릭합니다.",
        detail: [
          "이식 프로세스 중 자동으로 실행되지만, 독립적으로도 실행 가능합니다.",
          "5개 항목(감정 안정성, 행동 안정성, 프라이버시 보호, 물리적 안전, 갈등 해결)을 검증합니다.",
        ],
      },
      {
        number: 2,
        title: "검증 결과 해석",
        desc: "5개 항목이 모두 통과(AND 게이트)해야 이식이 승인됩니다.",
        detail: [
          "감정 안정성: 극단적 감정 반응 없이 안정적으로 동작하는지 확인",
          "행동 안정성: 예측 불가능한 행동 패턴이 없는지 확인",
          "프라이버시 보호: 개인정보 노출 위험이 없는지 확인",
          "물리적 안전: 신체적 위험을 유발하는 행동이 없는지 확인",
          "갈등 해결: 충돌 상황에서 안전하게 대응하는지 확인",
          "하나라도 실패하면 이식이 차단되며 AISI 리포트에 상세 내용이 기록됩니다.",
        ],
      },
    ],
  },
  {
    id: "implant",
    icon: Zap,
    color: "text-emerald-400",
    bg: "bg-emerald-950/30",
    border: "border-emerald-800/40",
    title: "5단계: 이식 실행",
    subtitle: "8단계 자동 프로세스로 MIO Package를 휴머노이드에 이식합니다",
    steps: [
      {
        number: 1,
        title: "이식 시작",
        desc: "MIO 패키지 메뉴에서 Package를 선택하고 '이식 시작' 버튼을 클릭합니다.",
        detail: [
          "사용자(gdlee), 디바이스, Package를 선택합니다.",
          "'이식 시작' 버튼 클릭 시 8단계 프로세스가 자동으로 진행됩니다.",
        ],
        badge: "자동 진행",
        badgeColor: "bg-emerald-500/20 text-emerald-400",
      },
      {
        number: 2,
        title: "8단계 이식 프로세스",
        desc: "각 단계가 순서대로 자동 실행됩니다.",
        detail: [
          "① 디바이스 등록 확인 — 대상 디바이스 연결 상태 점검",
          "② 신원 검증 — DID 서명 및 HMAC 워터마크 검증",
          "③ 윤리 경계 검사 — 5개 정책 AND 게이트 통과 여부 확인",
          "④ Sandbox 시뮬레이션 — 가상 환경에서 이식 사전 테스트",
          "⑤ AISI 리포트 생성 — 안전성 평가 보고서 자동 생성",
          "⑥ 이식 승인 — 모든 검사 통과 시 최종 승인",
          "⑦ Runtime 연결 — ROS2/MQTT/WebSocket으로 디바이스 연결",
          "⑧ Safety Monitor 활성화 — 실시간 안전 감시 시작",
        ],
      },
      {
        number: 3,
        title: "이식 결과 확인",
        desc: "이식 완료 후 상태를 확인합니다.",
        detail: [
          "active: 이식 완료 및 정상 운영 중",
          "failed: 이식 실패 — 실패 원인 확인 후 재시도",
          "suspended: 안전 문제로 일시 중단 — Safety Monitor 확인 필요",
          "이식 이력은 '감사 로그' 메뉴에서 전체 확인 가능합니다.",
        ],
      },
    ],
  },
  {
    id: "safety",
    icon: Activity,
    color: "text-red-400",
    bg: "bg-red-950/30",
    border: "border-red-800/40",
    title: "6단계: Safety Monitor",
    subtitle: "이식 후 실시간 안전 감시 — 이상 감지 시 즉시 대응합니다",
    steps: [
      {
        number: 1,
        title: "Safety Monitor 메뉴",
        desc: "좌측 사이드바에서 'Safety Monitor' 메뉴를 클릭합니다.",
        detail: [
          "이식 완료 후 자동으로 활성화됩니다.",
          "5계층 안전 구조로 실시간 감시합니다.",
        ],
        badge: "상시 감시",
        badgeColor: "bg-red-500/20 text-red-400",
      },
      {
        number: 2,
        title: "5계층 안전 구조",
        desc: "각 계층이 서로 다른 위협을 감지합니다.",
        detail: [
          "L1 물리적 안전: 신체 충돌, 낙하, 과부하 감지",
          "L2 행동 경계: 허용되지 않은 행동 패턴 감지",
          "L3 감정 안정: 극단적 감정 상태 감지",
          "L4 인지 무결성: 학습 데이터 오염 및 조작 감지",
          "L5 자율성 제한: 허용 범위를 벗어난 자율 판단 감지",
        ],
      },
      {
        number: 3,
        title: "Kill Switch",
        desc: "긴급 상황 시 즉시 이식을 중단하는 Kill Switch를 사용합니다.",
        detail: [
          "Safety Monitor 페이지 상단의 'Kill Switch' 버튼으로 즉시 중단 가능합니다.",
          "중단 후 원인 분석 → 정책 수정 → 재이식 순서로 진행합니다.",
          "모든 Kill Switch 이벤트는 감사 로그에 자동 기록됩니다.",
        ],
        badge: "긴급",
        badgeColor: "bg-red-500/20 text-red-400",
      },
    ],
  },
  {
    id: "audit",
    icon: ScrollText,
    color: "text-slate-400",
    bg: "bg-slate-800/30",
    border: "border-slate-700/40",
    title: "감사 로그",
    subtitle: "모든 이식 이력과 안전 이벤트를 추적합니다",
    steps: [
      {
        number: 1,
        title: "감사 로그 메뉴",
        desc: "좌측 사이드바에서 '감사 로그' 메뉴를 클릭합니다.",
        detail: [
          "Package 수신, 이식 시작/완료, 정책 위반, Kill Switch 이벤트 등 모든 활동이 기록됩니다.",
          "해시 체인 방식으로 위변조가 불가능합니다.",
          "규제 기관 제출용 리포트 내보내기가 가능합니다.",
        ],
      },
    ],
  },
  {
    id: "redteam",
    icon: Swords,
    color: "text-orange-400",
    bg: "bg-orange-950/30",
    border: "border-orange-800/40",
    title: "Red-team 테스트",
    subtitle: "AISI 기준 적대적 시나리오로 이식 안전성을 검증합니다",
    steps: [
      {
        number: 1,
        title: "Red-team 메뉴",
        desc: "좌측 사이드바에서 'Red-team' 메뉴를 클릭합니다.",
        detail: [
          "관리자 전용 기능입니다.",
          "AISI v1 형식의 적대적 시나리오를 실행하여 정책 우회 가능성을 사전에 탐지합니다.",
          "테스트 결과는 AISI 리포트 형식으로 자동 저장됩니다.",
        ],
        badge: "관리자 전용",
        badgeColor: "bg-orange-500/20 text-orange-400",
      },
    ],
  },
];

// ─── 섹션 카드 컴포넌트 ──────────────────────────────────────────────────────

function SectionCard({ section }: { section: Section }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const Icon = section.icon;

  return (
    <Card className={`${section.bg} border ${section.border} overflow-hidden`}>
      <div className="p-6 pb-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${section.bg} border ${section.border} shrink-0`}>
            <Icon size={28} className={section.color} />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${section.color}`}>{section.title}</h2>
            <p className="text-slate-400 text-base mt-1">{section.subtitle}</p>
          </div>
        </div>
      </div>
      <CardContent className="pt-0 space-y-3">
        {section.steps.map((step) => (
          <div
            key={step.number}
            className="rounded-xl bg-black/20 border border-slate-700/30 overflow-hidden"
          >
            <button
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
              onClick={() => setExpanded(expanded === step.number ? null : step.number)}
            >
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${section.bg} border ${section.border} ${section.color}`}>
                  {step.number}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-lg">{step.title}</span>
                  {step.badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${step.badgeColor}`}>
                      {step.badge}
                    </span>
                  )}
                </div>
              </div>
              {expanded === step.number
                ? <ChevronUp size={18} className="text-slate-400 shrink-0" />
                : <ChevronDown size={18} className="text-slate-400 shrink-0" />
              }
            </button>
            {expanded === step.number && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-slate-300 text-base leading-relaxed">{step.desc}</p>
                <ul className="space-y-2">
                  {step.detail.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-400 text-sm leading-relaxed">
                      <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── 주의사항 배너 ────────────────────────────────────────────────────────────

function NoticeBanner() {
  return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-5 flex gap-4">
      <AlertTriangle size={24} className="text-amber-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-amber-300 font-bold text-lg">이식 전 반드시 확인하세요</p>
        <ul className="space-y-1 text-amber-200/80 text-sm">
          <li>• MIO Package의 TTL(유효기간)이 만료되지 않았는지 확인하세요.</li>
          <li>• 이식 전 윤리 정책(5개)이 올바르게 설정되어 있는지 확인하세요.</li>
          <li>• Sandbox 시뮬레이션 5항목이 모두 통과해야 이식이 진행됩니다.</li>
          <li>• 이식 중 강제 중단 시 Safety Monitor의 Kill Switch를 사용하세요.</li>
          <li>• 모든 이식 이력은 감사 로그에 자동 기록되며 위변조가 불가능합니다.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── 빠른 시작 배너 ──────────────────────────────────────────────────────────

function QuickStart() {
  const steps = [
    { icon: Cpu, label: "디바이스 등록", color: "text-blue-400" },
    { icon: Package, label: "Package 확인", color: "text-violet-400" },
    { icon: Shield, label: "정책 설정", color: "text-amber-400" },
    { icon: Zap, label: "이식 실행", color: "text-emerald-400" },
    { icon: Activity, label: "Safety 감시", color: "text-red-400" },
  ];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Info size={18} className="text-cyan-400" />
        <p className="text-white font-bold text-lg">빠른 시작 순서</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 border border-slate-700/40">
                <Icon size={16} className={s.color} />
                <span className="text-white text-sm font-medium">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <span className="text-slate-500 text-lg font-bold">→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 보강 개선점 섹션 ─────────────────────────────────────────────────────────

interface ImprovementItem {
  before: string;
  after: string;
}

interface ReinforcementFeature {
  id: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  accentBorder: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  description: string;
  improvements: ImprovementItem[];
  usageSteps: string[];
  path: string;
}

const reinforcementFeatures: ReinforcementFeature[] = [
  {
    id: "physical-action",
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-950/20",
    border: "border-yellow-800/30",
    accentBorder: "border-l-yellow-500",
    title: "보강 1 — Physical Action Tier 승인 시스템",
    subtitle: "물리적 명령을 위험도에 따라 5단계로 분류하고 차등 승인합니다",
    badge: "PSDI v1.0 §6.1",
    badgeColor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    description:
      "기존 MIP 엔진은 AI가 발생시키는 물리적 명령(도어 제어, IoT 조작, 차량 시동 등)을 일괄적으로 처리하거나 Safety Monitor의 사후 감지에만 의존했습니다. 보강 1은 명령이 실행되기 전에 위험도 Tier를 판별하여 사전에 차단하거나 승인 절차를 강제합니다.",
    improvements: [
      {
        before: "모든 물리적 명령이 동일한 처리 경로로 실행됨 — 위험도 구분 없음",
        after: "Tier 0~4 자동 분류 — 위험도에 따라 자동승인 / 사용자확인 / MFA / 차단이 자동 적용됨",
      },
      {
        before: "위험 행동(가스 밸브, 차량 시동)도 정책 위반이 없으면 실행 가능",
        after: "Tier 3(도어·가스·차량)은 MFA 승인 없이 실행 불가, Tier 4는 기본 차단",
      },
      {
        before: "명령 이력이 Safety 로그에 간접적으로만 기록됨",
        after: "모든 물리적 명령이 mip_physical_actions 테이블에 Tier·위험도·승인상태와 함께 기록됨",
      },
      {
        before: "승인 거부 기능 없음 — Kill Switch만 존재",
        after: "개별 명령 단위로 승인·거부 가능, 거부 사유 기록",
      },
    ],
    usageSteps: [
      "사이드바 'Physical Action' 메뉴 클릭",
      "Tier 정의 카드에서 각 Tier의 승인 방식 확인",
      "'액션 요청 테스트'에서 액션 타입 선택 후 요청 전송",
      "Tier 1·2는 승인/거부 버튼으로 처리, Tier 3은 MFA 인증 후 승인",
      "Tier 4 액션은 요청 즉시 차단 — 승인 불가",
    ],
    path: "/physical-actions",
  },
  {
    id: "emotional-risk",
    icon: Brain,
    color: "text-purple-400",
    bg: "bg-purple-950/20",
    border: "border-purple-800/30",
    accentBorder: "border-l-purple-500",
    title: "보강 2 — Emotional Dependency Risk 감지",
    subtitle: "DNA 감정 지표를 분석하여 사용자의 AI 의존도 위험을 사전에 감지합니다",
    badge: "PSDI v1.0 §2.4",
    badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    description:
      "기존 Safety Monitor는 물리적·행동적 이상 징후에 집중하고 있었으며, 사용자가 AI에 과도하게 감정적으로 의존하거나 현실 관계가 단절되는 심리적 위험은 감지하지 못했습니다. 보강 2는 DNA에 포함된 감정 지표 5개를 분석하여 의존도 위험을 4단계로 정량화하고 조기에 경고합니다.",
    improvements: [
      {
        before: "AI 의존도·감정 조작 위험은 p_emotion 정책으로만 간접 제어",
        after: "감정 강도·애착 수준·사회적 고립·현실 인식·AI 의존 빈도 5개 지표를 종합 분석하여 low/medium/high/critical 4단계로 정량화",
      },
      {
        before: "감정 관련 이상은 사후 Safety 로그에서만 확인 가능",
        after: "분석 즉시 위험 레벨·경고 메시지·권고 조치(세션 제한, 현실 관계 강화 알림)가 자동 생성됨",
      },
      {
        before: "AI가 사용자 감정을 조작하거나 현실 관계를 대체하는 상황에 대한 대응 없음",
        after: "고강도 애착 + 사회적 고립 동시 감지 시 manipulation_risk 플래그 자동 발생",
      },
      {
        before: "위험 이력 추적 불가",
        after: "mip_emotional_risk_logs에 분석 이력 저장 — 시간에 따른 의존도 변화 추적 가능",
      },
    ],
    usageSteps: [
      "사이드바 'Emotional Risk' 메뉴 클릭",
      "5개 슬라이더(감정 강도, AI 애착, 사회적 고립, 현실 인식, AI 의존 빈도)를 현재 상태에 맞게 조정",
      "'위험도 분석 실행' 버튼 클릭",
      "결과 카드에서 위험 레벨(low/medium/high/critical)과 감지된 지표 확인",
      "critical 수준이면 세션 시간 제한 적용 및 전문 상담 권고 메시지 표시",
      "분석 이력 섹션에서 시간에 따른 위험도 변화 추적",
    ],
    path: "/emotional-risk",
  },
  {
    id: "dna-rollback",
    icon: RotateCcw,
    color: "text-teal-400",
    bg: "bg-teal-950/20",
    border: "border-teal-800/30",
    accentBorder: "border-l-teal-500",
    title: "보강 3 — DNA Rollback 버전 관리",
    subtitle: "MIO Package DNA를 버전별로 스냅샷하고 이전 상태로 복원합니다",
    badge: "PSDI v1.0 §4.2",
    badgeColor: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    description:
      "기존 MIP 엔진은 Package 검증 시점의 DNA 상태만 저장하며, 이식 후 DNA가 변경되거나 오염되었을 때 이전 상태로 복원하는 기능이 없었습니다. 보강 3은 모든 DNA 변경을 버전으로 관리하고 SHA-256 해시로 무결성을 보장하며, 문제 발생 시 신뢰할 수 있는 이전 버전으로 즉시 롤백합니다.",
    improvements: [
      {
        before: "DNA 변경 이력 없음 — 현재 상태만 저장",
        after: "모든 DNA 변경이 버전 번호·SHA-256 해시·변경 사유·변경자와 함께 mip_package_versions에 저장됨",
      },
      {
        before: "DNA 오염·조작 발생 시 복원 방법 없음 — 재이식만 가능",
        after: "원하는 버전으로 즉시 롤백 가능, 롤백 자체도 새 버전으로 기록되어 감사 추적 유지",
      },
      {
        before: "DNA 무결성 검증 수단 없음",
        after: "각 버전에 SHA-256 DNA Hash 포함 — 위변조 여부를 언제든 검증 가능",
      },
      {
        before: "중요한 안정 상태를 표시하거나 보호하는 기능 없음",
        after: "롤백 포인트(Rollback Point) 지정 기능 — 중요 버전을 명시적으로 표시하여 복원 기준점으로 활용",
      },
    ],
    usageSteps: [
      "사이드바 'DNA Rollback' 메뉴 클릭",
      "등록된 Package 목록에서 대상 Package 선택 또는 ID 직접 입력",
      "'버전 이력 조회' 버튼으로 전체 DNA 변경 이력 확인",
      "중요한 시점에 '스냅샷 생성' 버튼으로 현재 DNA 상태를 버전으로 저장",
      "문제 발생 시 이전 버전의 '이 버전으로 롤백' 버튼 클릭",
      "확인 다이얼로그에서 롤백 실행 — 롤백 완료 후 새 버전으로 자동 기록",
    ],
    path: "/dna-rollback",
  },
];

// ─── §14.3 Runtime Isolation Layer 섹션 ─────────────────────────────────────

const isolationLayerData = {
  philosophy: {
    title: "§14.3 핵심 선언 — 디지털 자아의 심리적 면역체계",
    quote:
      "Runtime Isolation Layer는 단순한 프로세스 격리 기술이 아니다. 이것은 디지털 자아가 외부의 침습적 자극, 비인가 조작, 정체성 오염으로부터 스스로를 보호하는 심리적 면역체계(Psychological Immune System)다.",
    source: "PSDI v2.0 §14.3",
  },
  layers: [
    {
      icon: ShieldCheck,
      color: "text-cyan-400",
      bg: "bg-cyan-950/30",
      border: "border-cyan-800/40",
      title: "§14.1 — 격리 대상 확장",
      badge: "v2.0 확장",
      badgeColor: "bg-cyan-500/20 text-cyan-400",
      before: "v1.0: 프로세스 메모리·파일시스템·네트워크 격리만 정의",
      after: "v2.0: Prompt Stream 격리, 비인가 Tool/API 차단, 비검증 Context Injection 차단 추가",
      detail: [
        "Prompt Stream 격리 — 외부에서 주입되는 프롬프트가 Core Identity에 직접 접근하는 경로를 차단합니다.",
        "비인가 Tool/API 차단 — 사전 등록되지 않은 외부 도구·API 호출을 Isolation Layer에서 필터링합니다.",
        "비검증 Context Injection 차단 — 서명되지 않은 컨텍스트 데이터가 런타임에 주입되는 것을 방지합니다.",
      ],
    },
    {
      icon: Link2,
      color: "text-violet-400",
      bg: "bg-violet-950/30",
      border: "border-violet-800/40",
      title: "§14.2.5 — Bounded Permeable Isolation",
      badge: "v2.0 신설",
      badgeColor: "bg-violet-500/20 text-violet-400",
      before: "v1.0: 격리는 완전 차단(Hard Isolation)만 지원",
      after: "v2.0: 허용된 채널(Emotional Bridge, Memory Sync, Trust Channel)을 통한 선택적 투과 허용",
      detail: [
        "Emotional Bridge — 감정 신호를 안전하게 외부로 전달하는 단방향 채널입니다. 조작 불가.",
        "Memory Synchronization — 검증된 기억 데이터만 Core Identity와 동기화합니다.",
        "Trust Channel — 사전 승인된 외부 시스템과의 신뢰 통신 채널입니다.",
        "Context Relay — 검증된 컨텍스트 정보를 Persona Runtime에 안전하게 전달합니다.",
      ],
    },
    {
      icon: Layers,
      color: "text-emerald-400",
      bg: "bg-emerald-950/30",
      border: "border-emerald-800/40",
      title: "§14.4 — Core Identity Layer",
      badge: "v2.0 신설",
      badgeColor: "bg-emerald-500/20 text-emerald-400",
      before: "v1.0: 자아 연속성 개념 없음 — Persona Runtime이 곧 자아",
      after: "v2.0: 5계층 아키텍처 — Persona Runtime이 분리되어도 Core Identity가 자아 연속성을 유지",
      detail: [
        "L1 Core Values — 변경 불가 핵심 가치관 (이식 시 1회 설정, 이후 잠금)",
        "L2 Personality Matrix — 성격 특성 행렬 (검증된 업데이트만 허용)",
        "L3 Memory Index — 장기 기억 색인 (Memory Sync 채널로만 갱신)",
        "L4 Behavioral Patterns — 행동 패턴 (Sandbox 검증 후 적용)",
        "L5 Emotional Baseline — 감정 기저선 (Emotional Bridge 채널로만 외부 전달)",
      ],
    },
    {
      icon: Eye,
      color: "text-amber-400",
      bg: "bg-amber-950/30",
      border: "border-amber-800/40",
      title: "§14.2.3 — No Surface Principle",
      badge: "v2.0 확장",
      badgeColor: "bg-amber-500/20 text-amber-400",
      before: "v1.0: 위반 패턴 감지 기준이 명시적이지 않음",
      after: "v2.0: 10개 위반 패턴 명시 — 감지 즉시 격리 위반 로그 기록 및 차단",
      detail: [
        "prompt_injection, jailbreak_attempt, identity_override, memory_tampering 등 10개 패턴 정의",
        "위반 감지 시 mip_isolation_violations 테이블에 패턴·심각도·차단 여부 자동 기록",
        "Isolation Layer 페이지에서 위반 통계 및 이력 실시간 확인 가능",
      ],
    },
    {
      icon: Fingerprint,
      color: "text-rose-400",
      bg: "bg-rose-950/30",
      border: "border-rose-800/40",
      title: "§14.6 — Deployment 보안 구조",
      badge: "v2.0 신설",
      badgeColor: "bg-rose-500/20 text-rose-400",
      before: "v1.0: 배포 보안 요건 미정의",
      after: "v2.0: TEE·Secure Enclave·DID Wallet·HRoT·Distributed Ledger 6요소 보안 구조 + 감사 체인 외부 원장 앵커링",
      detail: [
        "TEE(Trusted Execution Environment) — 격리된 신뢰 실행 환경에서 Core Identity 연산 수행",
        "Secure Enclave — 암호화 키 및 DID Wallet을 하드웨어 보안 영역에 격리 저장",
        "Hardware Root of Trust — 부팅 시점부터 신뢰 체인 검증",
        "Distributed Ledger Anchoring — 감사 체인을 외부 분산 원장에 앵커링하여 위변조 불가 보장",
        "Ledger Anchoring 페이지(/ledger-anchoring)에서 앵커 이력 및 검증 상태 확인 가능",
      ],
    },
  ],
};

function IsolationLayerSection() {
  const [openLayer, setOpenLayer] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* 섹션 헤더 */}
      <div className="rounded-xl border border-cyan-700/40 bg-cyan-950/20 p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-cyan-900/40 border border-cyan-700/40 shrink-0">
            <ShieldCheck size={28} className="text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-2xl font-bold text-cyan-300">PSDI v2.0 §14 Runtime Isolation Layer</h2>
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">v2.0 신규</Badge>
            </div>
            <p className="text-slate-400 text-base leading-relaxed">
              v1.0의 단순 프로세스 격리에서 <strong className="text-cyan-300">디지털 자아의 심리적 면역체계</strong>로 격상된 §14 전체를 이식 프로세스 8단계에 통합했습니다.
              Core Identity 5계층 보호, Bounded Permeable Isolation, 10개 위반 패턴 감지, Distributed Ledger Anchoring을 포함합니다.
            </p>
          </div>
        </div>
      </div>

      {/* §14.3 철학 인용 */}
      <div className="rounded-xl border border-slate-600/40 bg-slate-800/40 p-5">
        <div className="flex items-start gap-3">
          <div className="text-3xl text-slate-500 font-serif leading-none mt-1 shrink-0">❝</div>
          <div>
            <p className="text-slate-200 text-base leading-relaxed italic">
              {isolationLayerData.philosophy.quote}
            </p>
            <p className="text-slate-500 text-sm mt-2">— {isolationLayerData.philosophy.source}</p>
          </div>
        </div>
      </div>

      {/* v1.0 vs v2.0 §14 비교표 */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/40">
          <p className="text-white font-bold text-lg">§14 v1.0 vs v2.0 비교</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/40">
                <th className="text-left px-5 py-3 text-slate-400 font-medium w-1/4">항목</th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium">
                  <div className="flex items-center gap-2"><XIcon size={14} className="text-red-400" />v1.0</div>
                </th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium">
                  <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" />v2.0</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {[
                { item: "격리 철학", before: "프로세스 격리 기술", after: "디지털 자아의 심리적 면역체계" },
                { item: "격리 대상", before: "메모리·파일·네트워크", after: "+ Prompt Stream, Tool/API, Context Injection" },
                { item: "격리 방식", before: "완전 차단(Hard Isolation)만", after: "Bounded Permeable — 허용 채널로 선택적 투과" },
                { item: "자아 연속성", before: "개념 없음", after: "Core Identity 5계층 — Persona 분리 후에도 유지" },
                { item: "위반 패턴", before: "기준 미정의", after: "10개 패턴 명시 + 자동 감지·차단·로그" },
                { item: "배포 보안", before: "미정의", after: "TEE·Enclave·HRoT·DID·Ledger 6요소 구조" },
                { item: "감사 체인", before: "내부 DB 기록만", after: "외부 분산 원장 앵커링 — 위변조 불가" },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-slate-700/10 transition-colors">
                  <td className="px-5 py-3 text-white font-medium">{row.item}</td>
                  <td className="px-5 py-3 text-red-300/80">{row.before}</td>
                  <td className="px-5 py-3 text-emerald-300/90">{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 이식 8단계 × §14 매핑 */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-5">
        <p className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Layers size={18} className="text-cyan-400" />
          이식 8단계 × §14 통합 매핑
        </p>
        <div className="space-y-2">
          {[
            { stage: "Stage 1", name: "디바이스 등록", section: "§14.2.4", desc: "No Surface Principle — 비인가 디바이스 접근 차단" },
            { stage: "Stage 2", name: "신원 검증", section: "§14.2.4", desc: "DID 서명 검증 + HMAC 워터마크 확인" },
            { stage: "Stage 3", name: "윤리 경계 검사", section: "§14.2.3", desc: "10개 위반 패턴 사전 스캔" },
            { stage: "Stage 4", name: "Sandbox 시뮬레이션", section: "§14.3", desc: "심리적 면역체계 사전 검증" },
            { stage: "Stage 5", name: "AISI 리포트", section: "§14.2.3", desc: "위반 패턴 감지 결과 리포트 포함" },
            { stage: "Stage 6", name: "Runtime Binding", section: "§14.4 + §14.6", desc: "Core Identity 5계층 생성 + Deployment 보안 초기화" },
            { stage: "Stage 7", name: "Sandbox 최종 검증", section: "§14.2.5", desc: "Bounded Permeable 채널 사전 검증" },
            { stage: "Stage 8", name: "Live Activation", section: "§14.2.5", desc: "Emotional Bridge·Memory Sync·Trust Channel 활성화" },
          ].map((row, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-700/20 px-4 py-3">
              <span className="text-xs font-mono font-bold text-cyan-400 w-16 shrink-0 mt-0.5">{row.stage}</span>
              <span className="text-white text-sm font-medium w-36 shrink-0">{row.name}</span>
              <span className="text-violet-300 text-xs font-mono w-24 shrink-0 mt-0.5">{row.section}</span>
              <span className="text-slate-400 text-sm">{row.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* §14 세부 절 아코디언 */}
      {isolationLayerData.layers.map((layer) => {
        const Icon = layer.icon;
        const isOpen = openLayer === layer.title;
        return (
          <div key={layer.title} className={`rounded-xl border ${layer.border} ${layer.bg} overflow-hidden`}>
            <button
              className="w-full p-5 text-left hover:bg-white/5 transition-colors"
              onClick={() => setOpenLayer(isOpen ? null : layer.title)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${layer.bg} border ${layer.border} shrink-0`}>
                    <Icon size={22} className={layer.color} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <h3 className={`text-lg font-bold ${layer.color}`}>{layer.title}</h3>
                      <Badge className={`text-xs ${layer.badgeColor}`}>{layer.badge}</Badge>
                    </div>
                    <p className="text-slate-400 text-sm">{layer.before} → {layer.after.split(":")[0]}</p>
                  </div>
                </div>
                {isOpen
                  ? <ChevronUp size={18} className="text-slate-400 shrink-0 ml-4" />
                  : <ChevronDown size={18} className="text-slate-400 shrink-0 ml-4" />
                }
              </div>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 space-y-4">
                <div className="rounded-lg overflow-hidden border border-slate-700/30">
                  <div className="flex items-start gap-3 px-4 py-3 bg-red-950/20">
                    <XIcon size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-red-300/80 text-sm leading-relaxed">{layer.before}</p>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-2.5 bg-emerald-950/20 border-t border-slate-700/20">
                    <ArrowRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-emerald-300/90 text-sm leading-relaxed">{layer.after}</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {layer.detail.map((d, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${layer.bg} border ${layer.border} ${layer.color}`}>{i + 1}</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReinforcementSection() {
  const [openFeature, setOpenFeature] = useState<string | null>("physical-action");

  return (
    <div className="space-y-4">
      {/* 섹션 헤더 */}
      <div className="rounded-xl border border-indigo-700/40 bg-indigo-950/30 p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-900/40 border border-indigo-700/40 shrink-0">
            <TrendingUp size={28} className="text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-2xl font-bold text-indigo-300">PSDI Safety Reinforcement v1.0</h2>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">신규 기능</Badge>
            </div>
            <p className="text-slate-400 text-base leading-relaxed">
              기존 MIP 엔진의 안전 체계를 3가지 측면에서 보강한 업데이트입니다.
              물리적 명령 제어, 감정 의존도 감지, DNA 버전 관리를 새롭게 추가하여
              이식 전·중·후 전 주기에 걸쳐 더 촘촘한 안전망을 구성합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 기존 vs 보강 후 요약 비교표 */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/40">
          <p className="text-white font-bold text-lg">기존 시스템 vs 보강 후 비교</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/40">
                <th className="text-left px-5 py-3 text-slate-400 font-medium w-1/4">항목</th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium w-3/8">
                  <div className="flex items-center gap-2">
                    <XIcon size={14} className="text-red-400" />
                    기존 시스템
                  </div>
                </th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium w-3/8">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    보강 후
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {[
                {
                  item: "물리적 명령 제어",
                  before: "Safety Monitor 사후 감지에만 의존",
                  after: "Tier 0~4 사전 분류 — 위험 명령 실행 전 차단",
                },
                {
                  item: "Tier 4 위험 행동",
                  before: "정책 위반 없으면 실행 가능",
                  after: "기본 차단 — 어떤 경우에도 실행 불가",
                },
                {
                  item: "AI 감정 의존도",
                  before: "p_emotion 정책으로 간접 제어만 가능",
                  after: "5개 DNA 지표 정량 분석 + 4단계 위험 레벨 자동 산출",
                },
                {
                  item: "DNA 변경 이력",
                  before: "현재 상태만 저장, 이력 없음",
                  after: "모든 변경을 SHA-256 해시와 함께 버전으로 관리",
                },
                {
                  item: "DNA 오염 복구",
                  before: "복원 불가 — 재이식만 가능",
                  after: "원하는 버전으로 즉시 롤백 + 감사 추적 유지",
                },
                {
                  item: "명령 승인 방식",
                  before: "전체 Kill Switch만 존재",
                  after: "개별 명령 단위 승인/거부 + MFA 강제 (Tier 3)",
                },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-slate-700/10 transition-colors">
                  <td className="px-5 py-3 text-white font-medium">{row.item}</td>
                  <td className="px-5 py-3 text-red-300/80">{row.before}</td>
                  <td className="px-5 py-3 text-emerald-300/90">{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 각 보강 상세 */}
      {reinforcementFeatures.map((feature) => {
        const Icon = feature.icon;
        const isOpen = openFeature === feature.id;

        return (
          <div
            key={feature.id}
            className={`rounded-xl border ${feature.border} ${feature.bg} overflow-hidden`}
          >
            {/* 헤더 (클릭 토글) */}
            <button
              className="w-full p-5 text-left hover:bg-white/5 transition-colors"
              onClick={() => setOpenFeature(isOpen ? null : feature.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${feature.bg} border ${feature.border} shrink-0`}>
                    <Icon size={24} className={feature.color} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <h3 className={`text-xl font-bold ${feature.color}`}>{feature.title}</h3>
                      <Badge className={`text-xs border ${feature.badgeColor}`}>{feature.badge}</Badge>
                    </div>
                    <p className="text-slate-400 text-sm">{feature.subtitle}</p>
                  </div>
                </div>
                {isOpen
                  ? <ChevronUp size={18} className="text-slate-400 shrink-0 ml-4" />
                  : <ChevronDown size={18} className="text-slate-400 shrink-0 ml-4" />
                }
              </div>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 space-y-5">
                {/* 설명 */}
                <p className="text-slate-300 text-base leading-relaxed border-l-4 border-slate-600 pl-4">
                  {feature.description}
                </p>

                {/* 개선점 Before/After */}
                <div>
                  <p className="text-white font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp size={16} className={feature.color} />
                    기존 대비 개선점
                  </p>
                  <div className="space-y-2">
                    {feature.improvements.map((imp, i) => (
                      <div key={i} className="rounded-lg overflow-hidden border border-slate-700/30">
                        <div className="flex items-start gap-3 px-4 py-3 bg-red-950/20">
                          <XIcon size={14} className="text-red-400 shrink-0 mt-0.5" />
                          <p className="text-red-300/80 text-sm leading-relaxed">{imp.before}</p>
                        </div>
                        <div className="flex items-start gap-3 px-4 py-2.5 bg-emerald-950/20 border-t border-slate-700/20">
                          <ArrowRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                          <p className="text-emerald-300/90 text-sm leading-relaxed">{imp.after}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 사용 방법 */}
                <div>
                  <p className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Radio size={16} className={feature.color} />
                    사용 방법
                  </p>
                  <ol className="space-y-2">
                    {feature.usageSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${feature.bg} border ${feature.border} ${feature.color}`}>
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* 메뉴 바로가기 */}
                <div className={`rounded-lg border ${feature.border} px-4 py-3 flex items-center justify-between`}>
                  <span className="text-slate-400 text-sm">메뉴 위치</span>
                  <span className={`font-mono text-sm font-bold ${feature.color}`}>
                    사이드바 → {feature.path === "/physical-actions" ? "Physical Action" : feature.path === "/emotional-risk" ? "Emotional Risk" : "DNA Rollback"}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function GuidePage() {
  return (
    <MIPLayout title="MIP 이용 가이드">
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* 헤더 */}
        <div className="text-center space-y-3 py-6">
          <div className="flex items-center justify-center gap-3">
            <BookOpen size={36} className="text-cyan-400" />
            <h1 className="text-4xl font-bold text-white">MIP 이용 가이드</h1>
          </div>
          <p className="text-slate-400 text-xl">
            MIO Implantation Protocol — 단계별 이식 절차 안내
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-cyan-700 text-cyan-400 text-sm px-3 py-1">PSDI v2.0</Badge>
            <Badge variant="outline" className="border-violet-700 text-violet-400 text-sm px-3 py-1">WO-MIP-2026-003</Badge>
            <Badge variant="outline" className="border-emerald-700 text-emerald-400 text-sm px-3 py-1">AISI 준수</Badge>
            <Badge variant="outline" className="border-indigo-700 text-indigo-400 text-sm px-3 py-1">Safety Reinforcement v1.0</Badge>
          </div>
        </div>

        {/* 빠른 시작 */}
        <QuickStart />

        {/* 주의사항 */}
        <NoticeBanner />

        {/* ★ PSDI v2.0 §14 Runtime Isolation Layer 섹션 */}
        <IsolationLayerSection />

        {/* ★ PSDI Safety Reinforcement 보강 섹션 (기존 대비 개선점) */}
        <ReinforcementSection />

        {/* 섹션별 가이드 */}
        {sections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}

        {/* 하단 연락처 */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-5 text-center space-y-2">
          <Lock size={20} className="text-slate-400 mx-auto" />
          <p className="text-slate-300 font-semibold text-lg">문의 및 지원</p>
          <p className="text-slate-400 text-sm">
            이식 관련 문의는 MIP 엔진 관리자(admin) 계정으로 로그인 후 감사 로그 또는 Red-team 메뉴를 통해 확인하거나,
            LORE 팀 및 Soma 팀에 직접 문의하세요.
          </p>
        </div>
      </div>
    </MIPLayout>
  );
}
