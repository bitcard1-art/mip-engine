import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Loader2, Plus, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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

      <div className="space-y-2">
        {IMPLANTATION_STAGES.map((stage, i) => {
          const histEntry = data.stageHistory.find((h: any) => h.stage === stage);
          const isCurrentStage = stage === data.currentStage;
          let stageStatus = "pending";
          if (histEntry) stageStatus = histEntry.status;
          else if (i < IMPLANTATION_STAGES.indexOf(data.currentStage)) stageStatus = "completed";
          else if (isCurrentStage) stageStatus = data.status === "failed" ? "failed" : "in_progress";

          const icons = {
            completed: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
            in_progress: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
            failed: <XCircle className="w-3.5 h-3.5 text-red-400" />,
            pending: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
          };

          return (
            <div key={stage} className={`flex items-center gap-3 p-2 rounded-md ${isCurrentStage ? "bg-primary/5 border border-primary/20" : ""}`}>
              <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
              {icons[stageStatus as keyof typeof icons] || icons.pending}
              <span className={`text-xs flex-1 ${stageStatus === "completed" ? "text-foreground" : stageStatus === "failed" ? "text-red-400" : "text-muted-foreground"}`}>
                {STAGE_LABELS[stage]}
              </span>
              {histEntry?.completedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(histEntry.completedAt).toLocaleTimeString("ko-KR")}
                </span>
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
  const { data: devices } = trpc.mip.devices.list.useQuery();

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
                <label className="text-xs text-muted-foreground mb-1 block">MIO Package ID</label>
                <Input
                  placeholder="패키지 ID 입력..."
                  value={form.packageId}
                  onChange={(e) => setForm({ ...form, packageId: e.target.value })}
                  className="bg-input border-border text-foreground font-mono text-xs"
                />
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
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
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
                <CardTitle className="text-sm font-semibold text-foreground">이식 상세</CardTitle>
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
