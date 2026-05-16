/**
 * Lore·Soma 연동 상태 모니터링 패널
 * - DLQ 잔여 건수 (pending / abandoned)
 * - 최근 Webhook 이벤트 이력 (수신 성공/실패)
 * - 30초 자동 갱신
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function formatTs(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    received:  { label: "수신됨",   variant: "secondary" },
    processed: { label: "처리완료", variant: "default" },
    failed:    { label: "실패",     variant: "destructive" },
    pending:   { label: "대기중",   variant: "secondary" },
    resolved:  { label: "해소됨",   variant: "default" },
    abandoned: { label: "포기됨",   variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── DLQ 상태 카드 ───────────────────────────────────────────────────────────

function DlqCard({ label, pending, abandoned, color }: {
  label: string;
  pending: number;
  abandoned: number;
  color: "cyan" | "violet";
}) {
  const isHealthy = pending === 0 && abandoned === 0;
  const accentClass = color === "cyan" ? "text-cyan-400" : "text-violet-400";
  const borderClass = color === "cyan" ? "border-cyan-800/40" : "border-violet-800/40";
  const bgClass = color === "cyan" ? "bg-cyan-950/30" : "bg-violet-950/30";

  return (
    <div className={`rounded-xl border ${borderClass} ${bgClass} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${accentClass}`}>{label}</span>
        {isHealthy
          ? <span className="flex items-center gap-1 text-xs text-emerald-400"><Wifi size={13} /> 정상</span>
          : <span className="flex items-center gap-1 text-xs text-amber-400"><WifiOff size={13} /> 주의</span>
        }
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col items-center rounded-lg bg-black/20 py-2">
          <span className="text-2xl font-bold text-white">{pending}</span>
          <span className="text-[11px] text-slate-400 mt-0.5">DLQ 대기</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-black/20 py-2">
          <span className={`text-2xl font-bold ${abandoned > 0 ? "text-red-400" : "text-white"}`}>{abandoned}</span>
          <span className="text-[11px] text-slate-400 mt-0.5">포기됨</span>
        </div>
      </div>
    </div>
  );
}

// ─── 이벤트 테이블 ────────────────────────────────────────────────────────────

type EventRow = {
  id: string;
  eventType: string;
  status: string;
  createdAt: number | null;
  source: "soma" | "lore";
};

function EventTable({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
        <Clock size={32} className="opacity-40" />
        <p className="text-sm">수신된 이벤트가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-xs">
            <th className="text-left py-2 px-3 font-medium">소스</th>
            <th className="text-left py-2 px-3 font-medium">이벤트 타입</th>
            <th className="text-left py-2 px-3 font-medium">상태</th>
            <th className="text-left py-2 px-3 font-medium">수신 시각</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="py-2 px-3">
                <Badge variant="outline" className={e.source === "soma" ? "border-cyan-700 text-cyan-400" : "border-violet-700 text-violet-400"}>
                  {e.source === "soma" ? "Soma" : "Lore"}
                </Badge>
              </td>
              <td className="py-2 px-3 font-mono text-xs text-slate-300">{e.eventType}</td>
              <td className="py-2 px-3">{statusBadge(e.status)}</td>
              <td className="py-2 px-3 text-slate-400 text-xs">{formatTs(e.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 발신 이력 테이블 ───────────────────────────────────────────────────────────

type OutboundRow = {
  id: string | number;
  target: string;
  eventType: string;
  success: number;
  statusCode: number | null;
  attempts: number | null;
  sentAt: number;
  errorMessage: string | null;
  url?: string;
  resolvedAt?: number | null;
};

function OutboundTable({ events }: { events: OutboundRow[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
        <Clock size={32} className="opacity-40" />
        <p className="text-sm">발신 이력이 없습니다</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-xs">
            <th className="text-left py-2 px-3 font-medium">대상</th>
            <th className="text-left py-2 px-3 font-medium">이벤트 타입</th>
            <th className="text-left py-2 px-3 font-medium">결과</th>
            <th className="text-left py-2 px-3 font-medium">시도</th>
            <th className="text-left py-2 px-3 font-medium">전송 시각</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="py-2 px-3">
                <Badge variant="outline" className={e.target === "soma" ? "border-cyan-700 text-cyan-400" : "border-violet-700 text-violet-400"}>
                  {e.target === "soma" ? "Soma" : "Lore"}
                </Badge>
              </td>
              <td className="py-2 px-3 font-mono text-xs text-slate-300">{e.eventType}</td>
              <td className="py-2 px-3">
                {e.success === 1
                  ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 size={12} /> 성공{e.statusCode ? ` (${e.statusCode})` : ""}</span>
                  : <span className="flex items-center gap-1 text-red-400 text-xs"><AlertCircle size={12} /> 실패{e.statusCode ? ` (${e.statusCode})` : ""}</span>
                }
                {e.errorMessage && <p className="text-[10px] text-red-400/70 mt-0.5 truncate max-w-[160px]">{e.errorMessage}</p>}
              </td>
              <td className="py-2 px-3 text-slate-400 text-xs">{e.attempts ?? 1}회</td>
              <td className="py-2 px-3 text-slate-400 text-xs">{formatTs(e.sentAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── DLQ 상세 테이블 ─────────────────────────────────────────────────────────

type DlqRow = {
  id: string;
  eventType: string;
  attempts: number | null;
  lastAttemptAt: number | null;
  failedAt: number;
  status: string;
};

function DlqTable({ items, emptyLabel }: { items: DlqRow[]; emptyLabel: string }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
        <CheckCircle2 size={28} className="text-emerald-500 opacity-60" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 text-xs">
            <th className="text-left py-2 px-3 font-medium">이벤트 타입</th>
            <th className="text-left py-2 px-3 font-medium">시도 횟수</th>
            <th className="text-left py-2 px-3 font-medium">상태</th>
            <th className="text-left py-2 px-3 font-medium">최근 시도</th>
            <th className="text-left py-2 px-3 font-medium">최초 실패</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="py-2 px-3 font-mono text-xs text-slate-300">{item.eventType}</td>
              <td className="py-2 px-3">
                <span className={`font-bold ${(item.attempts ?? 0) >= 8 ? "text-red-400" : (item.attempts ?? 0) >= 5 ? "text-amber-400" : "text-slate-300"}`}>
                  {item.attempts ?? 0}
                </span>
                <span className="text-slate-500 text-xs"> / 10</span>
              </td>
              <td className="py-2 px-3">{statusBadge(item.status)}</td>
              <td className="py-2 px-3 text-slate-400 text-xs">{formatTs(item.lastAttemptAt)}</td>
              <td className="py-2 px-3 text-slate-400 text-xs">{formatTs(item.failedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 메인 패널 ───────────────────────────────────────────────────────────────

export default function IntegrationStatusPanel() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const utils = trpc.useUtils();

  const { data: status, isLoading: statusLoading } = trpc.mip.integration.status.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const { data: outboundEvents, isLoading: outboundLoading } = trpc.mip.integration.events.useQuery(
    { limit: 50 },
    { refetchInterval: 30_000 }
  );
  const { data: inboundEvents, isLoading: inboundLoading } = trpc.mip.integration.inboundEvents.useQuery(
    { limit: 50 },
    { refetchInterval: 30_000 }
  );
  const { data: somaDlq, isLoading: somaDlqLoading } = trpc.mip.integration.somaDlq.useQuery(
    { limit: 20 },
    { refetchInterval: 30_000 }
  );
  const { data: loreDlq, isLoading: loreDlqLoading } = trpc.mip.integration.loreDlq.useQuery(
    { limit: 20 },
    { refetchInterval: 30_000 }
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await Promise.all([
      utils.mip.integration.status.invalidate(),
      utils.mip.integration.events.invalidate(),
      utils.mip.integration.inboundEvents.invalidate(),
      utils.mip.integration.somaDlq.invalidate(),
      utils.mip.integration.loreDlq.invalidate(),
    ]);
    setTimeout(() => setIsRefreshing(false), 800);
  }, [isRefreshing, utils]);

  const totalAlerts = (status?.soma.dlqPending ?? 0) + (status?.lore.dlqPending ?? 0)
    + (status?.soma.dlqAbandoned ?? 0) + (status?.lore.dlqAbandoned ?? 0);

  return (
    <Card className="bg-slate-900/60 border-slate-700/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-slate-100">연동 상태 모니터링</span>
            {totalAlerts > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-normal">
                <AlertCircle size={13} />
                {totalAlerts}건 주의
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-7 px-2 text-slate-400 hover:text-white disabled:opacity-60"
          >
            <RefreshCw size={13} className={`mr-1 transition-transform duration-700 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="text-xs">{isRefreshing ? "갱신 중..." : "새로고침"}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* DLQ 상태 카드 */}
        {statusLoading ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <DlqCard
              label="Soma Gateway"
              pending={status?.soma.dlqPending ?? 0}
              abandoned={status?.soma.dlqAbandoned ?? 0}
              color="cyan"
            />
            <DlqCard
              label="Lore"
              pending={status?.lore.dlqPending ?? 0}
              abandoned={status?.lore.dlqAbandoned ?? 0}
              color="violet"
            />
          </div>
        )}

        {/* 탭: 이벤트 이력 / Soma DLQ / Lore DLQ */}
        <Tabs defaultValue="outbound">
          <TabsList className="bg-slate-800/60 border border-slate-700/50 h-8">
            <TabsTrigger value="outbound" className="text-xs h-6 px-3">발신 이력</TabsTrigger>
            <TabsTrigger value="inbound" className="text-xs h-6 px-3">수신 이력</TabsTrigger>
            <TabsTrigger value="soma-dlq" className="text-xs h-6 px-3">
              Soma DLQ
              {(status?.soma.dlqPending ?? 0) > 0 && (
                <span className="ml-1.5 bg-amber-500/20 text-amber-400 text-[10px] px-1.5 rounded-full">
                  {status?.soma.dlqPending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="lore-dlq" className="text-xs h-6 px-3">
              Lore DLQ
              {(status?.lore.dlqPending ?? 0) > 0 && (
                <span className="ml-1.5 bg-amber-500/20 text-amber-400 text-[10px] px-1.5 rounded-full">
                  {status?.lore.dlqPending}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="outbound" className="mt-3">
            {outboundLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <OutboundTable events={outboundEvents ?? []} />
            )}
          </TabsContent>
          <TabsContent value="inbound" className="mt-3">
            {inboundLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <EventTable events={(inboundEvents ?? []) as EventRow[]} />
            )}
          </TabsContent>

          <TabsContent value="soma-dlq" className="mt-3">
            {somaDlqLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <DlqTable items={(somaDlq ?? []) as DlqRow[]} emptyLabel="Soma DLQ 항목이 없습니다" />
            )}
          </TabsContent>

          <TabsContent value="lore-dlq" className="mt-3">
            {loreDlqLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <DlqTable items={(loreDlq ?? []) as DlqRow[]} emptyLabel="Lore DLQ 항목이 없습니다" />
            )}
          </TabsContent>
        </Tabs>

        {status && (
          <p className="text-[11px] text-slate-600 text-right">
            마지막 갱신: {formatTs(status.updatedAt)} · 30초 자동 갱신
          </p>
        )}
      </CardContent>
    </Card>
  );
}
