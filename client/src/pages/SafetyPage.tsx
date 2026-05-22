import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Activity, Zap, RefreshCw, Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import DeviceSelector, { DeviceBadge, type SelectedDevice } from "@/components/DeviceSelector";

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  emergency: { label: "긴급", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  critical: { label: "심각", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  high: { label: "높음", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  warning: { label: "경고", bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  medium: { label: "중간", bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  low: { label: "낮음", bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  info: { label: "정보", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  anomaly_detected: "이상 감지",
  policy_violation: "정책 위반",
  emotion_overflow: "감정 폭주",
  physical_limit_exceeded: "물리 한계 초과",
  kill_switch_activated: "Kill Switch 발동",
  hardware_signal_sent: "하드웨어 신호 전송",
  soma_notified: "Soma 알림",
  threshold_adjusted: "임계값 조정",
};

const SAFETY_LAYER_LABELS: Record<number, { name: string; desc: string }> = {
  1: { name: "하드웨어", desc: "ROS2 토크·속도 제한" },
  2: { name: "펌웨어", desc: "MQTT 긴급 정지" },
  3: { name: "OS", desc: "행동 Allowlist 필터" },
  4: { name: "MIP", desc: "윤리적 경계 정책" },
  5: { name: "미오", desc: "자율 윤리 판단" },
};

export default function SafetyPage() {
  const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(null);
  const utils = trpc.useUtils();

  // 선택된 디바이스 기준으로 로그 조회 (선택 안 되면 쿼리 비활성)
  const queryInput = useMemo(() => ({
    deviceId: selectedDevice?.deviceId,
    limit: 50,
  }), [selectedDevice?.deviceId]);

  const { data: logs, isLoading, refetch } = trpc.mip.safety.getLogs.useQuery(
    queryInput,
    { refetchInterval: 5000, enabled: !!selectedDevice }
  );

  // 선택된 디바이스 기준으로 활성 세션 조회
  const sessionInput = useMemo(() => (
    selectedDevice ? { deviceId: selectedDevice.deviceId } : undefined
  ), [selectedDevice?.deviceId]);

  const { data: activeSessions } = trpc.mip.safety.activeSessions.useQuery(
    sessionInput,
    { refetchInterval: 5000, enabled: !!selectedDevice }
  );
  const { data: thresholds } = trpc.mip.safety.getThresholds.useQuery();

  const killSwitchMutation = trpc.mip.safety.killSwitch.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.mip.safety.activeSessions.invalidate();
    },
    onError: (e) => toast.error(`Kill Switch 실패: ${e.message}`),
  });

  const severityCounts = logs?.reduce((acc, log) => {
    acc[log.severity] = (acc[log.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <MIPLayout title="안전 모니터">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">5계층 안전 구조 모니터링</h2>
        <p className="text-sm text-muted-foreground">실시간 이상 감지 및 자동 경보 시스템</p>
      </div>

      {/* 디바이스 선택 */}
      <Card className="bg-card border-border mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">대상 디바이스 선택</CardTitle>
          <p className="text-xs text-muted-foreground">
            모니터링할 디바이스를 선택하세요. 선택한 디바이스의 안전 데이터만 표시됩니다.
          </p>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <DeviceSelector
            value={selectedDevice}
            onChange={setSelectedDevice}
            className="flex-1"
          />
          {selectedDevice && (
            <div className="flex items-center gap-2">
              <DeviceBadge device={selectedDevice} />
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                연결됨
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 디바이스 미선택 시 안내 */}
      {!selectedDevice && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">디바이스를 선택하세요</h3>
          <p className="text-sm text-muted-foreground/70 max-w-md">
            이식 완료된 디바이스를 선택하면 해당 디바이스의 안전 모니터링 데이터가 표시됩니다.
          </p>

        </div>
      )}

      {/* 선택된 디바이스가 있을 때만 모니터링 데이터 표시 */}
      {selectedDevice && (
        <>
          {/* 연결 상태 배너 */}
          <div className="mb-6 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  모니터링 중: <span className="text-primary font-semibold">{selectedDevice.deviceName}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  ({selectedDevice.deviceType})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {activeSessions && activeSessions.length > 0 ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    활성 세션 {activeSessions.length}개
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">활성 세션 없음</span>
                )}
              </div>
            </div>
          </div>

          {/* Safety Layers */}
          <div className="grid grid-cols-5 gap-2 mb-6">
            {[5, 4, 3, 2, 1].map((level) => {
              const layer = SAFETY_LAYER_LABELS[level];
              const levelLogs = logs?.filter((l) => l.safetyLevel === level) || [];
              const hasEmergency = levelLogs.some((l) => l.severity === "emergency" || l.severity === "critical");
              return (
                <div key={level} className={`p-3 rounded-lg border text-center ${hasEmergency ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"}`}>
                  <div className={`text-lg font-bold mb-0.5 safety-${level}`}>L{level}</div>
                  <div className="text-xs font-medium text-foreground">{layer.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{layer.desc}</div>
                  {levelLogs.length > 0 && (
                    <div className={`text-xs mt-1 font-medium ${hasEmergency ? "text-red-400" : "text-muted-foreground"}`}>
                      {levelLogs.length}건
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Severity Summary */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  심각도 분포
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(SEVERITY_CONFIG).map(([severity, cfg]) => (
                  <div key={severity} className={`flex items-center justify-between p-2 rounded-md ${cfg.bg} border ${cfg.border}`}>
                    <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                    <span className={`text-sm font-bold ${cfg.text}`}>{severityCounts[severity] || 0}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Active Sessions + Kill Switch */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  활성 세션
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!activeSessions || activeSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {selectedDevice.deviceName}의 활성 세션 없음
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeSessions.map((session) => (
                      <div key={session.id} className="p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-foreground">{session.id.substring(0, 10)}...</span>
                          <span className="text-xs text-emerald-400 uppercase">{session.protocol}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-6 text-xs text-red-400 border-red-400/30 hover:bg-red-400/10 mt-1"
                          onClick={() => killSwitchMutation.mutate({ sessionId: session.id, reason: "수동 Kill Switch" })}
                          disabled={killSwitchMutation.isPending}
                        >
                          Kill Switch 발동
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Thresholds */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  현재 임계값
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {thresholds && Object.entries(thresholds).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{key}</span>
                    <span className="text-xs font-mono text-foreground">{String(value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Safety Logs */}
          <Card className="bg-card border-border mt-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  안전 이벤트 로그
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs gap-1">
                  <RefreshCw className="w-3 h-3" />갱신
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto" /></div>
              ) : !logs || logs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {selectedDevice.deviceName}의 안전 이벤트가 없습니다
                </div>
              ) : (
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {logs.map((log) => {
                    const cfg = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
                    return (
                      <div key={log.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground">Level {log.safetyLevel}</span>
                          <span className="text-xs text-muted-foreground">{EVENT_TYPE_LABELS[log.eventType] || log.eventType}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString("ko-KR") : "-"}
                          </span>
                        </div>
                        <p className="text-xs text-foreground">{log.description}</p>
                        {log.somaNotified && (
                          <span className="text-xs text-blue-400 mt-1 block">✓ Soma Gateway 알림 전송됨</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </MIPLayout>
  );
}
