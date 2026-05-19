import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Cpu, Plus, CheckCircle, XCircle, Clock, ShieldOff, RefreshCw, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const STATUS_CONFIG = {
  active: { label: "활성", color: "text-emerald-400", icon: CheckCircle },
  verified: { label: "검증됨", color: "text-blue-400", icon: CheckCircle },
  pending: { label: "대기", color: "text-yellow-400", icon: Clock },
  revoked: { label: "해지됨", color: "text-gray-500", icon: XCircle },
};

const DEVICE_TYPE_LABELS: Record<string, string> = {
  humanoid: "휴머노이드", iot: "IoT", software: "소프트웨어",
  sms: "SMS/MMS", kakaotalk: "카카오톡", whatsapp: "WhatsApp",
  line: "LINE", telegram: "Telegram", instagram: "Instagram DM", rcs: "RCS",
  youtube: "YouTube",
};

const CHANNEL_TYPES = [
  { value: "sms", label: "SMS/MMS", icon: "📱", placeholder: "전화번호 (예: 01012345678)" },
  { value: "kakaotalk", label: "카카오톡", icon: "💬", placeholder: "전화번호 (예: 01012345678)" },
  { value: "whatsapp", label: "WhatsApp", icon: "📞", placeholder: "전화번호 (예: +821012345678)" },
  { value: "line", label: "LINE", icon: "🟢", placeholder: "LINE ID" },
  { value: "telegram", label: "Telegram", icon: "✈️", placeholder: "Telegram ID (예: @username)" },
  { value: "instagram", label: "Instagram DM", icon: "📷", placeholder: "Instagram ID (예: @username)" },
  { value: "rcs", label: "RCS", icon: "💎", placeholder: "전화번호 (예: 01012345678)" },
  { value: "youtube", label: "YouTube", icon: "▶️", placeholder: "유튜브 채널 ID (예: UC...)" },
];

const isChannelType = (type: string) => CHANNEL_TYPES.some((c) => c.value === type);

export default function DevicesPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ deviceName: "", deviceType: "" as string, did: "" });
  const [channelType, setChannelType] = useState("none"); // "none" = 일반 소프트웨어
  const [accountId, setAccountId] = useState("");
  const utils = trpc.useUtils();
  const { user } = useAuth();

  const { data: devices, isLoading } = trpc.mip.devices.list.useQuery();

  // YouTube OAuth 콜백 처리 (URL 파라미터)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ytAuth = params.get("youtube_auth");
    if (ytAuth === "success") {
      const channel = params.get("channel");
      const title = params.get("title");
      toast.success(`YouTube 인증 완료! 채널: ${title || channel || "연결됨"}`);
      utils.mip.devices.list.invalidate();
      // URL 정리
      window.history.replaceState({}, "", window.location.pathname);
    } else if (ytAuth === "denied") {
      toast.error("YouTube 인증이 거부되었습니다.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (ytAuth === "error") {
      const msg = params.get("message");
      toast.error(`YouTube 인증 실패: ${msg || "알 수 없는 오류"}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const registerMutation = trpc.mip.devices.register.useMutation({
    onSuccess: (data) => {
      toast.success(`디바이스 등록 완료: ${data.deviceId}`);
      utils.mip.devices.list.invalidate();
      setOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(`등록 실패: ${e.message}`),
  });

  const verifyMutation = trpc.mip.devices.verify.useMutation({
    onSuccess: (r) => {
      toast[r.trusted ? "success" : "error"](r.trusted ? "신뢰 검증 성공" : `검증 실패: ${r.reason}`);
      utils.mip.devices.list.invalidate();
    },
  });

  const revokeMutation = trpc.mip.devices.revoke.useMutation({
    onSuccess: () => { toast.success("디바이스 해지 완료"); utils.mip.devices.list.invalidate(); },
  });

  function resetForm() {
    setForm({ deviceName: "", deviceType: "", did: "" });
    setChannelType("none");
    setAccountId("");
  }

  function handleRegister() {
    if (form.deviceType === "software" && channelType !== "none") {
      // 채널 타입: accountId로 DID 자동 생성
      const did = `did:channel:${channelType}:${accountId}`;
      registerMutation.mutate({
        deviceName: form.deviceName,
        deviceType: channelType,
        did,
      } as any);
    } else {
      registerMutation.mutate(form as any);
    }
  }

  async function handleYouTubeAuth(channelId: string) {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    try {
      const origin = window.location.origin;
      const res = await fetch(`/api/youtube/auth?channelId=${channelId}&userId=${user.id}&origin=${encodeURIComponent(origin)}`);
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error("인증 URL 생성 실패");
      }
    } catch (err) {
      toast.error("YouTube 인증 요청 실패");
    }
  }

  const isChannel = form.deviceType === "software" && channelType !== "none";
  const selectedChannel = CHANNEL_TYPES.find((c) => c.value === channelType);
  const canSubmit = form.deviceName && form.deviceType && (isChannel ? accountId : form.did);

  return (
    <MIPLayout title="디바이스 관리">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">등록된 디바이스</h2>
          <p className="text-sm text-muted-foreground">DID 기반 신뢰 검증 및 Runtime 연결 관리</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />디바이스 등록</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">새 디바이스 등록</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">디바이스 이름</label>
                <Input
                  placeholder="예: 휴머노이드-알파-01"
                  value={form.deviceName}
                  onChange={(e) => setForm({ ...form, deviceName: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">디바이스 유형</label>
                <Select value={form.deviceType} onValueChange={(v) => { setForm({ ...form, deviceType: v }); setChannelType("none"); setAccountId(""); }}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="(예: 휴머노이드, IoT, 소프트웨어)" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border" container={null}>
                    <SelectItem value="humanoid">🤖 휴머노이드</SelectItem>
                    <SelectItem value="iot">📡 IoT</SelectItem>
                    <SelectItem value="software">💻 소프트웨어</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 소프트웨어 선택 시 채널 하위 드롭다운 */}
              {form.deviceType === "software" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">채널 연결 (선택)</label>
                  <Select value={channelType} onValueChange={(v) => { setChannelType(v); setAccountId(""); }}>
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="채널 선택..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border" container={null}>
                      <SelectItem value="none">— 일반 소프트웨어 (채널 없음)</SelectItem>
                      {CHANNEL_TYPES.map((ch) => (
                        <SelectItem key={ch.value} value={ch.value}>
                          {ch.icon} {ch.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 채널 선택 시: 전화번호/계정 ID 입력 */}
              {isChannel && selectedChannel && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {selectedChannel.label} 계정 정보
                  </label>
                  <Input
                    placeholder={selectedChannel.placeholder}
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="bg-input border-border text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    DID가 자동 생성됩니다 (did:channel:{channelType}:계정)
                  </p>
                </div>
              )}

              {/* 일반 디바이스: DID 입력 */}
              {!isChannel && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">DID (Decentralized Identifier)</label>
                  <Input
                    placeholder="did:soma:..."
                    value={form.did}
                    onChange={(e) => setForm({ ...form, did: e.target.value })}
                    className="bg-input border-border text-foreground font-mono text-xs"
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleRegister}
                disabled={!canSubmit || registerMutation.isPending}
              >
                {registerMutation.isPending ? "등록 중..." : "등록"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : !devices || devices.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Cpu className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">등록된 디바이스가 없습니다</p>
            <p className="text-muted-foreground text-xs mt-1">위 버튼을 클릭하여 디바이스를 등록하세요</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map((device) => {
            const cfg = STATUS_CONFIG[device.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isDeviceChannel = isChannelType(device.deviceType);
            return (
              <Card key={device.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDeviceChannel ? "bg-blue-500/10" : "bg-primary/10"}`}>
                        {isDeviceChannel ? <MessageSquare className="w-4 h-4 text-blue-400" /> : <Cpu className="w-4 h-4 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{device.deviceName}</p>
                        <p className="text-xs text-muted-foreground">{DEVICE_TYPE_LABELS[device.deviceType] || device.deviceType}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs">{cfg.label}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">신뢰 레벨</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((l) => (
                          <div key={l} className={`w-2 h-2 rounded-full ${l <= (device.trustLevel || 0) ? "bg-primary" : "bg-border"}`} />
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {device.did.length > 40 ? `${device.did.substring(0, 40)}...` : device.did}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      등록: {new Date(device.createdAt).toLocaleDateString("ko-KR")}
                    </div>
                    {/* YouTube OAuth 상태 표시 */}
                    {device.deviceType === "youtube" && (device as any).youtubeAuth && (
                      <div className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle className="w-3 h-3" />
                        <span>YouTube 인증됨: {(device as any).youtubeAuth.channelTitle || (device as any).youtubeAuth.channelId}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {/* YouTube 인증 버튼 */}
                    {device.deviceType === "youtube" && (device as any).channelId && !(device as any).youtubeAuth && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-7 text-red-500 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => handleYouTubeAuth((device as any).channelId)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />YouTube 인증
                      </Button>
                    )}
                    {device.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-7"
                        onClick={() => verifyMutation.mutate({ deviceId: device.id })}
                        disabled={verifyMutation.isPending}
                      >
                        신뢰 검증
                      </Button>
                    )}
                    {device.status !== "revoked" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-7 text-red-400 border-red-400/30 hover:bg-red-400/10"
                        onClick={() => revokeMutation.mutate({ deviceId: device.id })}
                        disabled={revokeMutation.isPending}
                      >
                        <ShieldOff className="w-3 h-3 mr-1" />해지
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </MIPLayout>
  );
}
