import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
// Input removed - using Select for packageId
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Loader2, Plus, RefreshCw, ShieldCheck, Shield, Link2, Brain, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { IMPLANTATION_STAGES } from "../../../shared/mip-types";

// §14 단계별 통합 매핑
const STAGE_S14_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  device_registration: { label: "§14.2.4 No Surface",  icon: <Shield className="w-3 h-3" />,      color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  trust_verification:  { label: "§14.2.4 접근 차단",   icon: <Shield className="w-3 h-3" />,      color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  user_authentication: { label: "§14.2.3 조작 차단",   icon: <ShieldCheck className="w-3 h-3" />, color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
  package_generation:  { label: "§14.2.1 자아 보호",   icon: <ShieldCheck className="w-3 h-3" />, color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
  boundary_injection:  { label: "§14.2.3 패턴 검사",   icon: <AlertTriangle className="w-3 h-3" />,color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
  runtime_binding:     { label: "§14.4 Core Identity", icon: <Brain className="w-3 h-3" />,       color: "text-green-400 border-green-500/30 bg-green-500/10" },
  sandbox_validation:  { label: "§14.3 면역체계",     icon: <ShieldCheck className="w-3 h-3" />, color: "text-teal-400 border-teal-500/30 bg-teal-500/10" },
  live_activation:     { label: "§14.6 Deployment",   icon: <Link2 className="w-3 h-3" />,       color: "text-pink-400 border-pink-500/30 bg-pink-500/10" },
};

function S14Badge({ stage, stageStatus }: { stage: string; stageStatus: string }) {
  const s14 = STAGE_S14_MAP[stage];
  if (!s14 || stageStatus === "pending") return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border font-medium ${
      stageStatus === "completed" ? s14.color : "text-slate-500 border-slate-600/30 bg-slate-700/20"
    }`}>
      {stageStatus === "completed" ? s14.icon : <Clock className="w-3 h-3" />}
      {s14.label}
    </span>
  );
}

function IsolationSummaryBadges({ isolationLayer }: {
  isolationLayer?: {
    coreIdentityId?: string;
    coreIdentityStatus?: string;
    deploymentSecurityId?: string;
    securityLevel?: string;
    trustChainValid?: boolean;
  };
}) {
  if (!isolationLayer) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
      <span className="text-[10px] text-muted-foreground self-center">§14 상태:</span>
      {isolationLayer.coreIdentityId && (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border font-medium ${
          isolationLayer.coreIdentityStatus === "active"
            ? "text-green-400 border-green-500/30 bg-green-500/10"
            : "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
        }`}>
          <Brain className="w-3 h-3" />
          Core Identity {isolationLayer.coreIdentityStatus === "active" ? "활성" : isolationLayer.coreIdentityStatus}
        </span>
      )}
      {isolationLayer.deploymentSecurityId && (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border font-medium ${
          isolationLayer.trustChainValid
            ? "text-teal-400 border-teal-500/30 bg-teal-500/10"
            : "text-orange-400 border-orange-500/30 bg-orange-500/10"
        }`}>
          <Link2 className="w-3 h-3" />
          §14.6 {isolationLayer.securityLevel ?? "standard"} {isolationLayer.trustChainValid ? "✓" : "⚠"}
        </span>
      )}
      {!isolationLayer.coreIdentityId && !isolationLayer.deploymentSecurityId && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border text-muted-foreground border-border">
          <Clock className="w-3 h-3" />§14 미활성 (Stage 6 이전)
        </span>
      )}
    </div>
  );
}

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

function StageProgress({ stage, status, stageHistory }: { stage: string; status: string; stageHistory: any[] }) {
  const currentIdx = IMPLANTATION_STAGES.indexOf(stage as any);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {IMPLANTATION_STAGES.map((s, i) => {
        const histEntry = stageHistory.find((h: any) => h.stage === s);
        let stageStatus = "pending";
        if (histEntry) stageStatus = histEntry.status;
        else if (i < currentIdx) stageStatus = "completed";
        else if (i === currentIdx) stageStatus = status === "failed" ? "failed" : "in_progress";

        const colors = {
          completed: "bg-emerald-500",
          in_progress: "bg-blue-500 animate-pulse",
          failed: "bg-red-500",
          pending: "bg-border",
        };

        return (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <div className={`w-2.5 h-2.5 rounded-full ${colors[stageStatus as keyof typeof colors] || colors.pending}`} title={STAGE_LABELS[s]} />
            {i < IMPLANTATION_STAGES.length - 1 && (
              <div className={`w-4 h-0.5 ${i < currentIdx ? "bg-emerald-500" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImplantationDetail({ implantationId }: { implantationId: string }) {
  const { data, isLoading, refetch } = trpc.mip.implant.status.useQuery({ implantationId }, { refetchInterval: 3000 });

  if (isLoading) return <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></div>;
  if (!data) return <div className="py-4 text-center text-muted-foreground text-sm">데이터 없음</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">진행률: {data.progress}%</p>
          <p className="text-xs text-muted-foreground">현재 단계: {STAGE_LABELS[data.currentStage]}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs gap-1">
          <RefreshCw className="w-3 h-3" />갱신
        </Button>
      </div>

      <div className="w-full bg-border rounded-full h-1.5">
        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${data.progress}%` }} />
      </div>

      {/* §14 통합 상태 요약 배지 */}
      <IsolationSummaryBadges isolationLayer={data.isolationLayer} />

      {/* 단계별 상세 (§14 배지 포함) */}
      <div className="space-y-1.5">
        {IMPLANTATION_STAGES.map((stage, i) => {
          const histEntry = data.stageHistory.find((h: any) => h.stage === stage);
          const isCurrentStage = stage === data.currentStage;
          let stageStatus = "pending";
          if (histEntry) stageStatus = histEntry.status;
          else if (i < IMPLANTATION_STAGES.indexOf(data.currentStage)) stageStatus = "completed";
          else if (isCurrentStage) stageStatus = data.status === "failed" ? "failed" : "in_progress";

          const icons = {
            completed: <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
            in_progress: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />,
            failed: <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />,
            pending: <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />,
          };

          return (
            <div
              key={stage}
              className={`p-2.5 rounded-md border ${
                isCurrentStage
                  ? "bg-primary/5 border-primary/20"
                  : stageStatus === "completed"
                  ? "bg-emerald-950/20 border-emerald-800/20"
                  : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                {icons[stageStatus as keyof typeof icons] || icons.pending}
                <span className={`text-xs flex-1 ${
                  stageStatus === "completed" ? "text-foreground" :
                  stageStatus === "failed" ? "text-red-400" : "text-muted-foreground"
                }`}>
                  {STAGE_LABELS[stage]}
                </span>
                {histEntry?.completedAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(histEntry.completedAt).toLocaleTimeString("ko-KR")}
                  </span>
                )}
              </div>
              {/* §14 배지 — 완료된 단계에만 표시 */}
              {stageStatus !== "pending" && (
                <div className="ml-8 mt-1.5">
                  <S14Badge stage={stage} stageStatus={stageStatus} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.errorMessage && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{data.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

export default function ImplantationsPage() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ deviceId: "", packageId: "", protocol: "websocket" as "ros2" | "mqtt" | "websocket" });
  const utils = trpc.useUtils();

  const { data: implantations, isLoading } = trpc.mip.implant.list.useQuery();
  const { data: devices } = trpc.mip.devices.listAll.useQuery();
  const { data: packages, isLoading: packagesLoading } = trpc.mip.packages.listAll.useQuery();

  const startMutation = trpc.mip.implant.start.useMutation({
    onSuccess: (data) => {
      toast.success("이식 프로세스 시작됨");
      utils.mip.implant.list.invalidate();
      setOpen(false);
      setSelectedId(data.implantationId);
    },
    onError: (e) => toast.error(`시작 실패: ${e.message}`),
  });

  const cancelMutation = trpc.mip.implant.cancel.useMutation({
    onSuccess: () => { toast.success("이식 취소됨"); utils.mip.implant.list.invalidate(); },
  });

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    completed: { label: "완료", color: "text-emerald-400" },
    in_progress: { label: "진행 중", color: "text-blue-400" },
    failed: { label: "실패", color: "text-red-400" },
    pending: { label: "대기", color: "text-yellow-400" },
    cancelled: { label: "취소", color: "text-gray-400" },
  };

  return (
    <MIPLayout title="이식 프로세스">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">이식 이력</h2>
          <p className="text-sm text-muted-foreground">8단계 MIO Implantation Protocol 상태 관리</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />이식 시작</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">새 이식 프로세스 시작</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">디바이스 선택</label>
                <Select value={form.deviceId} onValueChange={(v) => setForm({ ...form, deviceId: v })}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="디바이스 선택..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {devices?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.deviceName} ({d.deviceType})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">MIO Package 선택</label>
                <Select value={form.packageId} onValueChange={(v) => setForm({ ...form, packageId: v })} disabled={packagesLoading}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder={packagesLoading ? "패키지 로딩 중..." : "패키지 선택..."} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {packagesLoading ? (
                      <SelectItem value="__loading__" disabled>
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          로딩 중...
                        </span>
                      </SelectItem>
                    ) : packages && packages.length > 0 ? (
                      packages.map((pkg) => {
                        let pkgName = pkg.id;
                        let pkgDesc = "";
                        try {
                          const ctx = pkg.contextJson ? JSON.parse(pkg.contextJson) : null;
                          if (ctx?.name) pkgName = ctx.name;
                          if (ctx?.description) pkgDesc = ctx.description;
                        } catch {}
                        return (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            <div className="flex flex-col gap-0.5 py-0.5">
                              <span className="text-sm font-medium">{pkgName}</span>
                              {pkgDesc && <span className="text-xs text-muted-foreground">{pkgDesc.substring(0, 40)}...</span>}
                              <span className="text-[10px] text-muted-foreground font-mono">{pkg.id}</span>
                            </div>
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="__none__" disabled>등록된 패키지가 없습니다</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">연결 프로토콜</label>
                <Select value={form.protocol} onValueChange={(v) => setForm({ ...form, protocol: v as any })}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="ros2">ROS2 (휴머노이드)</SelectItem>
                    <SelectItem value="mqtt">MQTT (IoT)</SelectItem>
                    <SelectItem value="websocket">WebSocket (소프트웨어)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => startMutation.mutate(form)}
                disabled={!form.deviceId || !form.packageId || startMutation.isPending}
              >
                {startMutation.isPending ? "시작 중..." : "이식 시작"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !implantations || implantations.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center text-muted-foreground text-sm">이식 이력이 없습니다</CardContent>
            </Card>
          ) : (
            implantations.map((item) => {
              const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
              const stageHistory = item.stageHistory ? JSON.parse(item.stageHistory as string) : [];
              const currentIdx = IMPLANTATION_STAGES.indexOf(item.stage as any);
              const progress = Math.round(((currentIdx + 1) / IMPLANTATION_STAGES.length) * 100);

              return (
                <Card
                  key={item.id}
                  className={`bg-card border-border cursor-pointer hover:border-primary/30 transition-colors ${selectedId === item.id ? "border-primary/50" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-muted-foreground">{item.id.substring(0, 12)}...</span>
                      <div className="flex items-center gap-1.5">
                        {IMPLANTATION_STAGES.indexOf(item.stage as any) >= IMPLANTATION_STAGES.indexOf("runtime_binding") && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border text-green-400 border-green-500/30 bg-green-500/10 font-medium">
                            <ShieldCheck className="w-3 h-3" />§14 활성
                          </span>
                        )}
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    </div>
                    <StageProgress stage={item.stage} status={item.status} stageHistory={stageHistory} />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{STAGE_LABELS[item.stage]}</span>
                      <span className="text-xs text-muted-foreground">{progress}%</span>
                    </div>
                    {item.status === "in_progress" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-6 text-xs text-red-400 border-red-400/30"
                        onClick={(e) => { e.stopPropagation(); cancelMutation.mutate({ implantationId: item.id }); }}
                      >
                        취소
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Detail */}
        <div>
          {selectedId ? (
            <Card className="bg-card border-border sticky top-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                이식 상세
                <span className="text-[10px] text-muted-foreground font-normal">§14 단계별 통합 상태 포함</span>
              </CardTitle>
              </CardHeader>
              <CardContent>
                <ImplantationDetail implantationId={selectedId} />
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-16 text-center text-muted-foreground text-sm">
                좌측 목록에서 이식 항목을 선택하세요
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MIPLayout>
  );
}
