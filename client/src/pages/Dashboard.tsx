import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { Shield, Cpu, Activity, AlertTriangle, CheckCircle, XCircle, Clock, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IMPLANTATION_STAGES } from "../../../shared/mip-types";

const STAGE_LABELS: Record<string, string> = {
  device_registration: "디바이스 등록",
  trust_verification: "신뢰 검증",
  user_authentication: "사용자 인증",
  package_generation: "패키지 생성",
  boundary_injection: "경계 주입",
  runtime_binding: "런타임 바인딩",
  sandbox_validation: "Sandbox 검증",
  live_activation: "Live Activation",
};

const STATUS_CONFIG = {
  completed: { label: "완료", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: CheckCircle },
  in_progress: { label: "진행 중", color: "text-blue-400", bg: "bg-blue-400/10", icon: Clock },
  failed: { label: "실패", color: "text-red-400", bg: "bg-red-400/10", icon: XCircle },
  pending: { label: "대기", color: "text-yellow-400", bg: "bg-yellow-400/10", icon: Clock },
  cancelled: { label: "취소", color: "text-gray-400", bg: "bg-gray-400/10", icon: XCircle },
};

export default function Dashboard() {
  const { data: stats } = trpc.mip.dashboard.stats.useQuery();
  const { data: recentActivity } = trpc.mip.dashboard.recentActivity.useQuery();
  const { data: safetyLogs } = trpc.mip.safety.getLogs.useQuery({ limit: 5 });

  const totalImplantations = Object.values(stats?.implantations || {}).reduce((a, b) => a + b, 0);

  return (
    <MIPLayout title="대시보드">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">등록 디바이스</span>
              <Cpu className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.totalDevices ?? "—"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">전체 이식</span>
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{totalImplantations || "—"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">활성 세션</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400">{stats?.activeSessions ?? "—"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">안전 로그</span>
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.totalSafetyLogs ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Implantations */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              최근 이식 프로세스
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!recentActivity || recentActivity.length === 0 ? (
              <div className="px-4 pb-4 text-center text-muted-foreground text-sm py-8">
                이식 이력이 없습니다
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentActivity.map((item) => {
                  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  const stageIdx = IMPLANTATION_STAGES.indexOf(item.stage as any);
                  const progress = Math.round(((stageIdx + 1) / IMPLANTATION_STAGES.length) * 100);
                  return (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {STAGE_LABELS[item.stage] || item.stage}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.startedAt).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        <p className="text-xs text-muted-foreground">{progress}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Safety Logs */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              최근 안전 이벤트
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!safetyLogs || safetyLogs.length === 0 ? (
              <div className="px-4 pb-4 text-center text-muted-foreground text-sm py-8">
                안전 이벤트가 없습니다
              </div>
            ) : (
              <div className="divide-y divide-border">
                {safetyLogs.map((log) => (
                  <div key={log.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded severity-${log.severity}`}>
                        {log.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">Level {log.safetyLevel}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("ko-KR") : "-"}
                      </span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{log.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Implantation Status Summary */}
      {stats?.implantations && Object.keys(stats.implantations).length > 0 && (
        <Card className="bg-card border-border mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              이식 상태 분포
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.implantations).map(([status, count]) => {
                const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                return (
                  <div key={status} className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${cfg.bg}`}>
                    <span className={`text-sm font-bold ${cfg.color}`}>{count}</span>
                    <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </MIPLayout>
  );
}
