import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import {
  Shield, Cpu, Package, Activity, Terminal, BookOpen,
  Link2, ChevronRight, LogOut, User, Menu, X, AlertTriangle,
  Zap, Brain, RotateCcw, ShieldCheck, Anchor, ScrollText,
  FlaskConical, BarChart2, CreditCard
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { isAccessVerified, clearAccessVerification } from "@/pages/AccessGatePage";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "이식 관리",
    items: [
      { path: "/dashboard", label: "대시보드", icon: Activity },
      { path: "/devices", label: "디바이스 관리", icon: Cpu },
      { path: "/packages", label: "MIO Package", icon: Package },
      { path: "/implantations", label: "이식 프로세스", icon: Link2 },
      { path: "/sandbox", label: "Sandbox 검증", icon: FlaskConical },
      { path: "/decision-core", label: "의사결정 핵심", icon: Brain },
      { path: "/sdk-monitor", label: "SDK 연계 현황", icon: BarChart2 },
    ],
  },
  {
    label: "안전 보강",
    items: [
      { path: "/safety", label: "Safety Monitor", icon: AlertTriangle },
      { path: "/physical-actions", label: "Physical Action", icon: Zap },
      { path: "/emotional-risk", label: "Emotional Risk", icon: Brain },
      { path: "/dna-rollback", label: "DNA Rollback", icon: RotateCcw },
    ],
  },
  {
    label: "보안 · 감사",
    items: [
      { path: "/policies", label: "경계 정책", icon: Shield },
      { path: "/redteam", label: "Red-teaming", icon: Terminal },
      { path: "/audit", label: "감사 체인", icon: ScrollText },
      { path: "/isolation-layer", label: "§14 Isolation Layer", icon: ShieldCheck },
      { path: "/ledger-anchoring", label: "§14.6 Ledger Anchoring", icon: Anchor },
    ],
  },

  {
    label: "관리자",
    items: [
      { path: "/card-issuance", label: "카드 발급", icon: CreditCard, adminOnly: true },
    ],
  },
  {
    label: "설정 · 가이드",
    items: [
      { path: "/guide", label: "이용 가이드", icon: BookOpen },
    ],
  },
];

interface MIPLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function MIPLayout({ children, title }: MIPLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { clearAccessVerification(); window.location.href = "/"; },
    onError: () => toast.error("로그아웃 실패"),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">MIP 엔진 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-primary mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">인증이 필요합니다</h2>
          <p className="text-muted-foreground text-sm">MIP 엔진에 접근하려면 로그인이 필요합니다.</p>
          <Button onClick={() => window.location.href = getLoginUrl()}>
            로그인
          </Button>
        </div>
      </div>
    );
  }

  // 2차 인증 게이트: 접근 코드 미입력 시 게이트 페이지로 리다이렉트
  if (!isAccessVerified()) {
    window.location.href = "/access-gate";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-sidebar border-r border-sidebar-border
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground">MIP Engine</p>
            <p className="text-xs text-sidebar-foreground/50">PSDI v2.0</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4 text-sidebar-foreground/50" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <div className="px-3 space-y-4">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter(item => !item.adminOnly || user?.role === 'admin');
              if (visibleItems.length === 0) return null;
              return (
              <div key={group.label}>
                {/* 그룹 헤더 */}
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 select-none">
                  {group.label}
                </p>
                {/* 그룹 아이템 */}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150
                          ${isActive
                            ? "bg-sidebar-primary/20 text-sidebar-primary font-medium"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }
                        `}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                        {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name || "사용자"}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user?.role === "admin" ? "관리자" : "일반 사용자"}</p>
            </div>
            <button
              onClick={() => logoutMutation.mutate()}
              className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center gap-4 px-6 shrink-0">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <h1 className="text-base font-semibold text-foreground">{title || "MIP Engine"}</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">WO-MIP-2026-001</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="시스템 정상" />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
