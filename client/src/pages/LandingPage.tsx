import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Shield, Cpu, Activity, Lock, ChevronRight, Zap } from "lucide-react";
import { Link } from "wouter";

const FEATURES = [
  { icon: Shield, title: "MIO Package Receiver", desc: "DID 서명 검증, HMAC 워터마크, TTL 유효성 검사를 통한 안전한 패키지 수신" },
  { icon: Lock, title: "Ethical Boundary Engine", desc: "p_harm·p_child·p_unsafe·p_emotion·p_learning 5개 표준 정책 실시간 합성 및 위반 차단" },
  { icon: Zap, title: "Simulation Sandbox", desc: "5항목 AND 게이트 검증 및 AISI 포맷 리포트 생성으로 Live Activation 전 안전성 보장" },
  { icon: Cpu, title: "Runtime Connector", desc: "ROS2·MQTT·WebSocket 다중 프로토콜 지원 및 Emergency Kill Switch" },
  { icon: Activity, title: "Safety Monitor", desc: "5계층 안전 구조 실시간 모니터링 및 Soma Gateway 이상 이벤트 전송" },
];

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-foreground">MIP Engine</span>
          <span className="text-xs text-muted-foreground ml-1">PSDI v2.0</span>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            isAuthenticated ? (
              <Link href="/access-gate">
                <Button size="sm">대시보드 <ChevronRight className="w-3 h-3 ml-1" /></Button>
              </Link>
            ) : (
              <Button size="sm" onClick={() => window.location.href = getLoginUrl()}>
                로그인
              </Button>
            )
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          WO-MIP-2026-001 · MIO Implantation Protocol
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
          MIP 엔진<br />
          <span className="text-primary">신뢰 기반 AI 이식 플랫폼</span>
        </h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
          MIO Package 수신부터 안전 모니터링까지, PSDI v2.0 기반의 완전한 AI 이식 프로세스를 제공합니다.
          5대 서브시스템이 8단계 검증을 통해 안전하고 신뢰할 수 있는 AI 이식을 보장합니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isAuthenticated ? (
            <Link href="/access-gate">
              <Button size="lg" className="gap-2">
                대시보드 시작 <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          ) : (
            <Button size="lg" onClick={() => window.location.href = getLoginUrl()} className="gap-2">
              시작하기 <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20 max-w-6xl mx-auto">
        <h2 className="text-center text-2xl font-bold text-foreground mb-10">5대 핵심 서브시스템</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-sm">{feature.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
          {/* 8단계 프로세스 카드 */}
          <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors md:col-span-2 lg:col-span-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2 text-sm">8단계 이식 프로세스</h3>
            <div className="space-y-1">
              {["디바이스 등록", "신뢰 검증", "사용자 인증", "패키지 생성", "경계 주입", "런타임 바인딩", "Sandbox 검증", "Live Activation"].map((stage, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                  {stage}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        MIP Engine · WO-MIP-2026-001 · PSDI v2.0 · Soma Framework
      </footer>
    </div>
  );
}
