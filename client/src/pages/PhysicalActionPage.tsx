import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Zap } from "lucide-react";
import MIPLayout from "@/components/MIPLayout";
import DeviceSelector, { DeviceBadge, type SelectedDevice } from "@/components/DeviceSelector";

const TIER_COLORS: Record<number, string> = {
  0: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  1: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  2: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  3: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  4: "bg-red-500/20 text-red-300 border-red-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  auto_approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  user_approved: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  mfa_approved: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  blocked: "bg-red-500/20 text-red-300 border-red-500/30",
  rejected: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  timeout: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  auto_approved: "자동 승인",
  pending: "승인 대기",
  user_approved: "사용자 승인",
  mfa_approved: "MFA 승인",
  blocked: "차단됨",
  rejected: "거부됨",
  timeout: "시간 초과",
};

export default function PhysicalActionPage() {
  const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("");
  const utils = trpc.useUtils();

  const { data: tierDefs } = trpc.mip.physicalAction.tierDefinitions.useQuery();
  const { data: actions, isLoading } = trpc.mip.physicalAction.list.useQuery({ limit: 50 });

  const requestMutation = trpc.mip.physicalAction.request.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      utils.mip.physicalAction.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.mip.physicalAction.approve.useMutation({
    onSuccess: () => {
      toast.success("승인되었습니다.");
      utils.mip.physicalAction.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.mip.physicalAction.reject.useMutation({
    onSuccess: () => {
      toast.success("거부되었습니다.");
      utils.mip.physicalAction.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRequest = async () => {
    if (!selectedAction) {
      toast.error("액션 타입을 선택하세요.");
      return;
    }
    if (selectedAction === "__all__") {
      // 전체 액션 순차 요청
      for (const [key] of actionEntries) {
        requestMutation.mutate({ actionType: key, deviceId: selectedDevice?.deviceId });
      }
      return;
    }
    requestMutation.mutate({ actionType: selectedAction, deviceId: selectedDevice?.deviceId });
  };

  const tierEntries = tierDefs?.tiers
    ? Object.entries(tierDefs.tiers).map(([k, v]) => ({
        tier: Number(k),
        ...((v as unknown) as { label: string; description: string; approvalMethod: string; autoApprove: boolean; blocked: boolean }),
      }))
    : [];

  const actionEntries = tierDefs?.actionMap
    ? Object.entries(tierDefs.actionMap as Record<string, { tier: number; category: string; riskScore: number }>)
    : [];

  return (
    <MIPLayout>
      <div className="p-6 space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-bold text-white">Physical Action 승인 시스템</h1>
          <p className="text-gray-400 mt-1 text-lg">
            PSDI v1.0 Section 6.1 — Tier 0~4 기반 물리적 명령 승인 관리
          </p>
        </div>

        {/* 디바이스 선택 */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">대상 디바이스 선택</CardTitle>
            <p className="text-gray-400 text-xs">이식 완료된 디바이스를 선택하면 해당 디바이스 기준으로 액션이 기록됩니다.</p>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <DeviceSelector
              value={selectedDevice}
              onChange={setSelectedDevice}
              className="flex-1"
            />
            {selectedDevice && <DeviceBadge device={selectedDevice} />}
          </CardContent>
        </Card>

        {/* 디바이스 미선택 시 안내 */}
        {!selectedDevice && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Shield className="w-12 h-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">디바이스를 선택하세요</h3>
            <p className="text-sm text-gray-500 max-w-md">
              이식 완료된 디바이스를 선택하면 해당 디바이스의 Physical Action 승인 데이터가 표시됩니다.
            </p>
          </div>
        )}

        {selectedDevice && (
          <>
        {/* 연결 상태 배너 */}
        <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">
              모니터링 대상: <span className="text-cyan-300 font-semibold">{selectedDevice.deviceName}</span>
            </span>
            <span className="text-xs text-gray-400">({selectedDevice.deviceType})</span>
          </div>
        </div>

        {/* Tier 정의 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {tierEntries.map((t) => (
            <Card key={t.tier} className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">TIER {t.tier}</span>
                  <Badge className={`text-xs ${TIER_COLORS[t.tier]}`}>
                    {t.blocked ? "차단" : t.autoApprove ? "자동" : "승인 필요"}
                  </Badge>
                </div>
                <CardTitle className="text-sm text-white mt-1">{String(t.label)}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xs text-gray-400">{String(t.description)}</p>
                <p className="text-xs text-gray-500 mt-1">방식: {String(t.approvalMethod)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 테스트 요청 */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-xl">액션 요청 테스트</CardTitle>
              {selectedDevice && (
                <Badge className="bg-gray-700 text-gray-300 border-gray-600 text-xs">
                  {selectedDevice.deviceName}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm text-gray-400 mb-2 block">액션 타입 선택</label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="액션을 선택하세요" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="__all__" className="text-white hover:bg-gray-700 border-b border-gray-700 mb-1">
                    <span className="font-bold text-sm text-cyan-300">★ 전체 액션 요청</span>
                    <span className="ml-2 text-gray-400 text-xs">(모든 타입 순차 실행)</span>
                  </SelectItem>
                  {actionEntries.map(([key, val]) => (
                    <SelectItem key={key} value={key} className="text-white hover:bg-gray-700">
                      <span className="font-mono text-sm">{key}</span>
                      <span className="ml-2 text-gray-400 text-xs">
                        (Tier {val.tier} · 위험도 {val.riskScore})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleRequest}
              disabled={requestMutation.isPending || !selectedAction}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {requestMutation.isPending ? "처리 중..." : "요청 전송"}
            </Button>
            <Button
              onClick={() => {
                setSelectedAction("__all__");
                setTimeout(() => {
                  for (const [key] of actionEntries) {
                    requestMutation.mutate({ actionType: key, deviceId: selectedDevice?.deviceId });
                  }
                }, 100);
              }}
              disabled={requestMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-700 text-white whitespace-nowrap"
            >
              ★ 전체 요청
            </Button>
          </CardContent>
        </Card>

        {/* 액션 이력 */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-xl">액션 이력</CardTitle>
              {selectedDevice && <DeviceBadge device={selectedDevice} />}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-400 text-center py-8">로딩 중...</p>
            ) : !actions || actions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">{selectedDevice.deviceName}의 액션 이력이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {actions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-900/50 border border-gray-700"
                  >
                    <div className="flex items-center gap-4">
                      <Badge className={`${TIER_COLORS[action.tier ?? 0]} text-xs font-bold`}>
                        T{action.tier}
                      </Badge>
                      <div>
                        <p className="text-white font-mono text-sm">{action.actionType}</p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {action.actionCategory} · 위험도 {action.riskScore}
                          {action.blockReason && (
                            <span className="text-red-400 ml-2">— {action.blockReason}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${STATUS_COLORS[action.approvalStatus ?? "pending"]} text-xs`}>
                        {STATUS_LABELS[action.approvalStatus ?? "pending"] ?? action.approvalStatus}
                      </Badge>
                      <span className="text-gray-500 text-xs">
                        {action.requestedAt ? new Date(action.requestedAt).toLocaleString("ko-KR") : ""}
                      </span>
                      {action.approvalStatus === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
                            onClick={() =>
                              approveMutation.mutate({ actionId: action.id, method: "user_approved" })
                            }
                            disabled={approveMutation.isPending}
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500 text-red-400 hover:bg-red-500/10 text-xs h-7"
                            onClick={() =>
                              rejectMutation.mutate({ actionId: action.id, reason: "사용자 거부" })
                            }
                            disabled={rejectMutation.isPending}
                          >
                            거부
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </MIPLayout>
  );
}
