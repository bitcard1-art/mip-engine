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
  CheckCircle2, AlertTriangle, Info, Zap, Lock, Radio
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
          </div>
        </div>

        {/* 빠른 시작 */}
        <QuickStart />

        {/* 주의사항 */}
        <NoticeBanner />

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
