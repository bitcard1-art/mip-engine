import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Plus, CheckCircle, XCircle, Clock, RefreshCw,
  Shield, ShieldOff, Eye, Unplug, Settings, BarChart3
} from "lucide-react";
import { toast } from "sonner";

// ─── 상태 설정 ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: "활성", color: "text-emerald-400", icon: CheckCircle },
  pending_verification: { label: "인증 대기", color: "text-yellow-400", icon: Clock },
  disconnected: { label: "해제됨", color: "text-gray-500", icon: XCircle },
  suspended: { label: "정지됨", color: "text-red-400", icon: ShieldOff },
};

const PROTECTION_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  full: { label: "전체 보호", color: "text-emerald-400", icon: Shield },
  monitor_only: { label: "모니터링만", color: "text-yellow-400", icon: Eye },
  disabled: { label: "비활성", color: "text-gray-500", icon: ShieldOff },
};

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  sms: "SMS/MMS",
  kakaotalk: "카카오톡",
  whatsapp: "WhatsApp",
  line: "LINE",
  telegram: "Telegram",
  instagram: "Instagram DM",
  rcs: "RCS",
};

const CHANNEL_TYPE_EMOJI: Record<string, string> = {
  sms: "📱",
  kakaotalk: "💬",
  whatsapp: "📞",
  line: "🟢",
  telegram: "✈️",
  instagram: "📷",
  rcs: "💎",
};

export default function ChannelsPage() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [form, setForm] = useState({
    channelType: "whatsapp" as string,
    accountId: "",
    displayName: "",
    protectionLevel: "full" as string,
  });
  const [settingsForm, setSettingsForm] = useState({
    protectionLevel: "full" as string,
    displayName: "",
  });

  const utils = trpc.useUtils();

  const { data: channels, isLoading, error: listError, refetch: refetchList } = trpc.mip.channels.list.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.mip.channels.stats.useQuery();
  const { data: channelTypes } = trpc.mip.channels.types.useQuery();

  const registerMutation = trpc.mip.channels.register.useMutation({
    onSuccess: (data) => {
      toast.success(`채널 등록 완료: ${CHANNEL_TYPE_LABELS[data.channelType] || data.channelType}`);
      utils.mip.channels.list.invalidate();
      utils.mip.channels.stats.invalidate();
      setOpen(false);
      setForm({ channelType: "whatsapp", accountId: "", displayName: "", protectionLevel: "full" });
    },
    onError: (e) => toast.error(`등록 실패: ${e.message}`),
  });

  const disconnectMutation = trpc.mip.channels.disconnect.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("채널 해제 완료");
        utils.mip.channels.list.invalidate();
        utils.mip.channels.stats.invalidate();
      } else {
        toast.error(result.error || "해제 실패");
      }
    },
    onError: (e) => toast.error(`해제 실패: ${e.message}`),
  });

  const updateSettingsMutation = trpc.mip.channels.updateSettings.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("설정 변경 완료");
        utils.mip.channels.list.invalidate();
        setSettingsOpen(false);
      } else {
        toast.error(result.error || "설정 변경 실패");
      }
    },
    onError: (e) => toast.error(`설정 변경 실패: ${e.message}`),
  });

  const openSettings = (channel: { id: string; protectionLevel: string; displayName: string | null }) => {
    setSelectedChannel(channel.id);
    setSettingsForm({
      protectionLevel: channel.protectionLevel,
      displayName: channel.displayName || "",
    });
    setSettingsOpen(true);
  };

  return (
    <MIPLayout title="채널 관리">
      {/* 통계 카드 */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="p-4"><div className="h-12 bg-muted/30 rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">전체 채널</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.totalChannels}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-muted-foreground">활성 채널</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.activeChannels}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">총 검사</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.totalChecked.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldOff className="w-4 h-4 text-red-400" />
                <span className="text-xs text-muted-foreground">차단됨</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.totalBlocked.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 헤더 + 등록 버튼 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">등록된 채널</h2>
          <p className="text-sm text-muted-foreground">SNS/메신저 채널별 메시지 보호 관리</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />채널 등록</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">새 채널 등록</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">채널 타입</label>
                <Select value={form.channelType} onValueChange={(v) => setForm({ ...form, channelType: v })}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="sms">📱 SMS/MMS</SelectItem>
                    <SelectItem value="kakaotalk">💬 카카오톡</SelectItem>
                    <SelectItem value="whatsapp">📞 WhatsApp</SelectItem>
                    <SelectItem value="line">🟢 LINE</SelectItem>
                    <SelectItem value="telegram">✈️ Telegram</SelectItem>
                    <SelectItem value="instagram">📷 Instagram DM</SelectItem>
                    <SelectItem value="rcs">💎 RCS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">계정 ID / 전화번호</label>
                <Input
                  placeholder="예: +82-10-1234-5678 또는 @username"
                  value={form.accountId}
                  onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">표시 이름 (선택)</label>
                <Input
                  placeholder="예: 내 개인 WhatsApp"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">보호 수준</label>
                <Select value={form.protectionLevel} onValueChange={(v) => setForm({ ...form, protectionLevel: v })}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="full">🛡️ 전체 보호 (차단 + 경고)</SelectItem>
                    <SelectItem value="monitor_only">👁️ 모니터링만 (경고만)</SelectItem>
                    <SelectItem value="disabled">⏸️ 비활성 (검사 안 함)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {channelTypes && (
                <div className="p-3 rounded-md bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">연결 방식</p>
                  <p className="text-xs text-foreground">
                    {channelTypes[form.channelType as keyof typeof channelTypes]?.authMethod || "정보 없음"}
                  </p>
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => registerMutation.mutate({
                  channelType: form.channelType as any,
                  accountId: form.accountId,
                  displayName: form.displayName || undefined,
                  protectionLevel: form.protectionLevel as any,
                })}
                disabled={!form.accountId || registerMutation.isPending}
              >
                {registerMutation.isPending ? "등록 중..." : "채널 등록"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 채널 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : listError ? (
        <Card className="bg-card border-border border-red-500/30">
          <CardContent className="py-12 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 text-sm mb-2">채널 목록을 불러올 수 없습니다</p>
            <p className="text-muted-foreground text-xs mb-4">{listError.message}</p>
            <Button variant="outline" size="sm" onClick={() => refetchList()}>
              <RefreshCw className="w-3 h-3 mr-1" />다시 시도
            </Button>
          </CardContent>
        </Card>
      ) : !channels || channels.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">등록된 채널이 없습니다</p>
            <p className="text-muted-foreground text-xs mt-1">위 버튼을 클릭하여 SNS/메신저 채널을 등록하세요</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {channels.map((channel) => {
            const statusCfg = STATUS_CONFIG[channel.status] || STATUS_CONFIG.active;
            const protCfg = PROTECTION_CONFIG[channel.protectionLevel] || PROTECTION_CONFIG.full;
            const StatusIcon = statusCfg.icon;
            const ProtIcon = protCfg.icon;

            return (
              <Card key={channel.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  {/* 헤더: 채널 타입 + 상태 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                        {CHANNEL_TYPE_EMOJI[channel.channelType] || "📨"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {channel.displayName || CHANNEL_TYPE_LABELS[channel.channelType]}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{channel.accountId}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 ${statusCfg.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span className="text-xs">{statusCfg.label}</span>
                    </div>
                  </div>

                  {/* 정보 행 */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">채널 타입</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {CHANNEL_TYPE_LABELS[channel.channelType]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">보호 수준</span>
                      <div className={`flex items-center gap-1 ${protCfg.color}`}>
                        <ProtIcon className="w-3 h-3" />
                        <span>{protCfg.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">검사 / 차단</span>
                      <span className="text-foreground">
                        {channel.totalChecked.toLocaleString()} / <span className="text-red-400">{channel.totalBlocked.toLocaleString()}</span>
                      </span>
                    </div>
                    {channel.lastMessageAt && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">마지막 검사</span>
                        <span className="text-foreground">
                          {new Date(channel.lastMessageAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2">
                    {channel.status === "active" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1 text-xs"
                          onClick={() => openSettings(channel)}
                        >
                          <Settings className="w-3 h-3" />설정
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1 text-xs text-red-400 hover:text-red-300 hover:border-red-400/50"
                          onClick={() => {
                            if (confirm("정말 이 채널을 해제하시겠습니까?")) {
                              disconnectMutation.mutate({ channelId: channel.id });
                            }
                          }}
                          disabled={disconnectMutation.isPending}
                        >
                          <Unplug className="w-3 h-3" />해제
                        </Button>
                      </>
                    )}
                    {channel.status === "disconnected" && (
                      <Badge variant="outline" className="text-xs text-gray-500">해제됨</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 설정 변경 다이얼로그 */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">채널 설정 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">보호 수준</label>
              <Select value={settingsForm.protectionLevel} onValueChange={(v) => setSettingsForm({ ...settingsForm, protectionLevel: v })}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="full">🛡️ 전체 보호 (차단 + 경고)</SelectItem>
                  <SelectItem value="monitor_only">👁️ 모니터링만 (경고만)</SelectItem>
                  <SelectItem value="disabled">⏸️ 비활성 (검사 안 함)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">표시 이름</label>
              <Input
                placeholder="표시 이름"
                value={settingsForm.displayName}
                onChange={(e) => setSettingsForm({ ...settingsForm, displayName: e.target.value })}
                className="bg-input border-border text-foreground"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (selectedChannel) {
                  updateSettingsMutation.mutate({
                    channelId: selectedChannel,
                    protectionLevel: settingsForm.protectionLevel as any,
                    displayName: settingsForm.displayName || undefined,
                  });
                }
              }}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? "변경 중..." : "설정 저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MIPLayout>
  );
}
