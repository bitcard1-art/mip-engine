/**
 * MIO Package 페이지
 * LORE로부터 수신된 MIO Package 목록, 상태, 내용 확인
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
import {
  Package, CheckCircle2, XCircle, Clock, AlertTriangle,
  RefreshCw, ChevronRight, Dna, Brain, Network, Shield,
  Calendar, Hash, Zap
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

function PackageDetailModal({
  pkg,
  onClose,
  onStartImplant,
}: {
  pkg: NonNullable<ReturnType<typeof trpc.mip.packages.listAll.useQuery>["data"]>[number];
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

export default function PackagesPage() {
  const [, setLocation] = useLocation();
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
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
        <div className="flex items-center justify-between">
          <div>
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
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            새로고침
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
                  LORE에서 MIO Package를 전송하면 여기에 표시됩니다.
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-xs text-muted-foreground max-w-md text-center">
                LORE 팀에 gdlee의 MIO Package 생성 및 전송을 요청하세요.
                Package가 수신되면 자동으로 검증이 진행됩니다.
              </div>
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
    </MIPLayout>
  );
}
