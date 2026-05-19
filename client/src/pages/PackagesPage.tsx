/**
 * MIO Package 페이지
 * LORE로부터 수신된 MIO Package 목록, 상태, 내용 확인
 * + LORE에 새 패키지 요청 기능 (8자아 선택/전체선택)
 */
import { useState } from "react";
import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, CheckCircle2, XCircle, Clock, AlertTriangle,
  RefreshCw, ChevronRight, Dna, Brain, Network, Shield,
  Calendar, Hash, Zap, Send, Sparkles, Heart, Eye,
  Users, Palette, Scale, BookOpen, Link2
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type PackageStatus = "received" | "validated" | "invalid" | "expired";

const STATUS_CONFIG: Record<PackageStatus, { label: string; color: string; icon: React.ElementType }> = {
  received:  { label: "수신됨",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30",    icon: Clock },
  validated: { label: "검증 완료", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  invalid:   { label: "검증 실패", color: "bg-red-500/20 text-red-400 border-red-500/30",       icon: XCircle },
  expired:   { label: "만료됨",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertTriangle },
};

// 8자아 정의
const PERSONA_DEFS = [
  { id: "emotional",   label: "감정 자아",   icon: Heart,    color: "text-rose-400",    desc: "감정 표현 및 정서 패턴" },
  { id: "cognitive",   label: "인지 자아",   icon: Eye,      color: "text-blue-400",    desc: "사고 방식 및 판단 패턴" },
  { id: "social",      label: "사회적 자아", icon: Users,    color: "text-green-400",   desc: "사회적 상호작용 패턴" },
  { id: "creative",    label: "창의적 자아", icon: Palette,  color: "text-purple-400",  desc: "창작 및 표현 스타일" },
  { id: "moral",       label: "도덕적 자아", icon: Scale,    color: "text-amber-400",   desc: "가치관 및 윤리 판단" },
  { id: "habitual",    label: "습관적 자아", icon: RefreshCw, color: "text-cyan-400",   desc: "일상 루틴 및 행동 습관" },
  { id: "linguistic",  label: "언어적 자아", icon: BookOpen, color: "text-orange-400",  desc: "언어 사용 및 소통 스타일" },
  { id: "relational",  label: "관계적 자아", icon: Link2,    color: "text-pink-400",    desc: "관계 형성 및 유지 패턴" },
] as const;

type PersonaId = typeof PERSONA_DEFS[number]["id"];

function StatusBadge({ status }: { status: PackageStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.received;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function formatTtl(ttl: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = ttl - now;
  if (diff <= 0) return "만료됨";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}일 ${hours}시간 남음`;
  return `${hours}시간 남음`;
}

// ─── 패키지 요청 다이얼로그 ─────────────────────────────────────────────────
function RequestPackageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaId[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [urgency, setUrgency] = useState<"low" | "medium" | "high">("medium");
  const [purpose, setPurpose] = useState<"humanoid_implant" | "software_runtime" | "iot_device">("software_runtime");

  const requestMutation = trpc.mip.packages.requestFromLore.useMutation({
    onSuccess: (data) => {
      // Dialog를 먼저 닫고 상태 초기화 — DOM 정리가 완료된 후 toast 표시
      onClose();
      setSelectedPersonas([]);
      setSelectAll(false);
      setTimeout(() => {
        toast.success(data.message, {
          description: `요청 ID: ${data.requestId} | 예상 소요: ${Math.round(data.estimatedCompletionMs / 1000)}초`,
        });
      }, 150);
    },
    onError: (err) => {
      // Dialog가 열려 있는 상태에서 에러 toast를 표시하면 Portal 충돌 가능
      // Dialog를 먼저 닫고 toast 표시
      onClose();
      setTimeout(() => {
        toast.error("패키지 요청 실패", { description: err.message });
      }, 150);
    },
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedPersonas(PERSONA_DEFS.map(p => p.id));
    } else {
      setSelectedPersonas([]);
    }
  };

  const handleTogglePersona = (id: PersonaId) => {
    setSelectedPersonas(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      setSelectAll(next.length === PERSONA_DEFS.length);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedPersonas.length === 0) {
      toast.error("최소 1개 자아를 선택해주세요.");
      return;
    }
    requestMutation.mutate({
      personas: selectedPersonas,
      selectAll,
      urgency,
      purpose,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            LORE에 MIO 패키지 요청
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* 전체 선택 */}
          <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                전체 선택 (8자아 모두)
              </label>
            </div>
            <Badge variant="outline" className="text-xs">
              {selectedPersonas.length}/8 선택
            </Badge>
          </div>

          {/* 8자아 체크박스 그리드 */}
          <div className="grid grid-cols-2 gap-2">
            {PERSONA_DEFS.map(persona => {
              const Icon = persona.icon;
              const isSelected = selectedPersonas.includes(persona.id);
              return (
                <div
                  key={persona.id}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/10 border-primary/40"
                      : "bg-muted/20 border-border/50 hover:border-border"
                  }`}
                  onClick={() => handleTogglePersona(persona.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleTogglePersona(persona.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${persona.color}`} />
                      <span className="text-sm font-medium">{persona.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{persona.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 옵션 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">용도</label>
              <Select value={purpose} onValueChange={(v) => setPurpose(v as typeof purpose)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="software_runtime">소프트웨어 (챗봇)</SelectItem>
                  <SelectItem value="iot_device">IoT 디바이스</SelectItem>
                  <SelectItem value="humanoid_implant">휴머노이드</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">긴급도</label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as typeof urgency)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">낮음</SelectItem>
                  <SelectItem value="medium">보통</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 요청 버튼 */}
          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={selectedPersonas.length === 0 || requestMutation.isPending}
          >
            {requestMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {requestMutation.isPending
              ? "요청 중..."
              : `${selectedPersonas.length}개 자아 패키지 요청`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 패키지 상세 모달 ───────────────────────────────────────────────────────
function PackageDetailModal({
  pkg,
  onClose,
  onStartImplant,
}: {
  pkg: {
    id: string;
    userId: string;
    packageVersion: string;
    didSignature: string;
    hmacWatermark: string;
    ttl: number;
    status: string;
    validationErrors: string | null;
    dnaHash: string | null;
    patternHash: string | null;
    contextJson: string | null;
    sourceSystem: string;
    receivedAt: number;
    validatedAt: number | null;
  };
  onClose: () => void;
  onStartImplant: (packageId: string) => void;
}) {
  let context: Record<string, unknown> | null = null;
  try {
    const parsed = pkg.contextJson ? JSON.parse(pkg.contextJson) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      context = parsed as Record<string, unknown>;
    }
  } catch {}

  const ttlSec = pkg.ttl > 1e12 ? Math.floor(pkg.ttl / 1000) : pkg.ttl;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5 text-primary" />
            MIO Package 상세
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Package ID</p>
              <p className="text-sm font-mono break-all">{pkg.id}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> 상태</p>
              <StatusBadge status={pkg.status as PackageStatus} />
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> 수신 시각</p>
              <p className="text-sm">{formatTs(pkg.receivedAt)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> TTL (만료)</p>
              <p className="text-sm">{formatTtl(ttlSec)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">버전</p>
              <p className="text-sm font-mono">{pkg.packageVersion}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">출처</p>
              <p className="text-sm uppercase font-medium text-primary">{pkg.sourceSystem}</p>
            </div>
          </div>

          {/* DNA 해시 */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Dna className="w-3.5 h-3.5 text-cyan-400" /> DNA 해시</p>
            <p className="text-xs font-mono break-all text-cyan-300">{pkg.dnaHash || "—"}</p>
          </div>

          {/* Pattern 해시 */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-purple-400" /> Pattern 해시</p>
            <p className="text-xs font-mono break-all text-purple-300">{pkg.patternHash || "—"}</p>
          </div>

          {/* Context */}
          {context && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Network className="w-3.5 h-3.5 text-orange-400" /> Runtime Context</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">목적</span><p className="font-medium">{String(context.purpose || "—")}</p></div>
                <div><span className="text-muted-foreground text-xs">디바이스 ID</span><p className="font-mono text-xs break-all">{String(context.deviceId || "—")}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground text-xs">환경</span><p>{String(context.environment || "—")}</p></div>
                {Array.isArray(context.constraints) && context.constraints.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">제약 조건</span>
                    <ul className="mt-1 space-y-0.5">
                      {(context.constraints as string[]).map((c, i) => (
                        <li key={i} className="text-xs flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DID 서명 */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400" /> DID 서명</p>
            <p className="text-xs font-mono break-all text-emerald-300 line-clamp-3">{pkg.didSignature}</p>
          </div>

          {/* 검증 오류 */}
          {pkg.validationErrors && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
              <p className="text-xs text-red-400 font-medium flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> 검증 오류</p>
              <p className="text-xs text-red-300">{pkg.validationErrors}</p>
            </div>
          )}

          {/* 이식 시작 버튼 */}
          {pkg.status === "validated" && (
            <Button
              className="w-full"
              onClick={() => { onStartImplant(pkg.id); onClose(); }}
            >
              <Zap className="w-4 h-4 mr-2" />
              이 Package로 이식 시작
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────────
export default function PackagesPage() {
  const [, setLocation] = useLocation();
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const { data: packages, isLoading, refetch, isFetching } = trpc.mip.packages.listAll.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const selectedPackage = packages?.find(p => p.id === selectedPkg);

  const handleStartImplant = (packageId: string) => {
    setLocation(`/implantations?packageId=${packageId}`);
    toast.success("이식 프로세스 페이지로 이동합니다.");
  };

  return (
    <MIPLayout title="MIO Package">
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground">MIO Package</h1>
              <p className="text-sm text-muted-foreground mt-1">
                LORE로부터 수신된 사용자의 디지털 자아 패키지 목록입니다.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">새로고침</span>
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => setShowRequestDialog(true)}
            className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto"
          >
            <Sparkles className="w-4 h-4" />
            LORE에 패키지 요청
          </Button>
        </div>

        {/* 통계 카드 */}
        {packages && packages.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["received", "validated", "invalid", "expired"] as PackageStatus[]).map(s => {
              const count = packages.filter(p => p.status === s).length;
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              return (
                <Card key={s} className="bg-card/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{cfg.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Package 목록 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">패키지 목록 로딩 중...</p>
            </div>
          </div>
        ) : !packages || packages.length === 0 ? (
          <Card className="bg-card/50">
            <CardContent className="py-16 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">수신된 Package가 없습니다</p>
                <p className="text-sm text-muted-foreground mt-1">
                  LORE에 패키지를 요청하거나, LORE에서 직접 전송하면 여기에 표시됩니다.
                </p>
              </div>
              <Button
                onClick={() => setShowRequestDialog(true)}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                LORE에 패키지 요청하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {packages.map(pkg => {
              const ttlSec = pkg.ttl > 1e12 ? Math.floor(pkg.ttl / 1000) : pkg.ttl;
              return (
                <Card
                  key={pkg.id}
                  className="bg-card/50 hover:bg-card/80 transition-colors cursor-pointer group"
                  onClick={() => setSelectedPkg(pkg.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* 아이콘 */}
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-primary" />
                      </div>

                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-mono text-foreground truncate">{pkg.id}</p>
                          <StatusBadge status={pkg.status as PackageStatus} />
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatTs(pkg.receivedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTtl(ttlSec)}
                          </span>
                          <span className="uppercase font-medium text-primary/70">{pkg.sourceSystem}</span>
                          <span>v{pkg.packageVersion}</span>
                        </div>
                      </div>

                      {/* 이식 버튼 (validated만) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {pkg.status === "validated" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={e => { e.stopPropagation(); handleStartImplant(pkg.id); }}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            이식 시작
                          </Button>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedPackage && (
        <PackageDetailModal
          pkg={selectedPackage}
          onClose={() => setSelectedPkg(null)}
          onStartImplant={handleStartImplant}
        />
      )}

      {/* 패키지 요청 다이얼로그 */}
      <RequestPackageDialog
        open={showRequestDialog}
        onClose={() => setShowRequestDialog(false)}
      />
    </MIPLayout>
  );
}
