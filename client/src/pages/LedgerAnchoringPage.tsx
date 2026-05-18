import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Link2, CheckCircle, XCircle, Clock, RefreshCw, Shield,
  Database, AlertTriangle, Zap, ExternalLink, Copy,
} from "lucide-react";
import MIPLayout from "@/components/MIPLayout";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type AnchorStatus = "pending" | "anchored" | "verified" | "failed" | "simulation";
type EntityType = "implantation" | "device" | "package" | "sandbox_report" | "safety_log" | "policy" | "session";

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AnchorStatus }) {
  const map: Record<AnchorStatus, { cls: string; label: string }> = {
    pending:    { cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", label: "대기 중" },
    anchored:   { cls: "bg-blue-500/20 text-blue-300 border-blue-500/30",   label: "앵커됨" },
    verified:   { cls: "bg-green-500/20 text-green-300 border-green-500/30", label: "검증됨" },
    failed:     { cls: "bg-red-500/20 text-red-300 border-red-500/30",       label: "실패" },
    simulation: { cls: "bg-purple-500/20 text-purple-300 border-purple-500/30", label: "시뮬레이션" },
  };
  const s = map[status] ?? map.pending;
  return <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${s.cls}`}>{s.label}</span>;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} 복사됨`));
}

// ─── 대시보드 탭 ──────────────────────────────────────────────────────────────

function DashboardTab() {
  const { data, isLoading, refetch } = trpc.mip.ledgerAnchoring.dashboard.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center h-48 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" />로딩 중...</div>;
  }

  const stats = data?.stats;
  const recentAnchors = data?.recentAnchors ?? [];

  return (
    <div className="space-y-6">
      {/* 모드 배너 */}
      <div className={`p-3 rounded-lg border flex items-center gap-3 ${stats?.simulationMode ? "bg-purple-900/20 border-purple-700/40" : "bg-green-900/20 border-green-700/40"}`}>
        <Shield className={`w-5 h-5 ${stats?.simulationMode ? "text-purple-400" : "text-green-400"}`} />
        <div>
          <p className={`text-sm font-medium ${stats?.simulationMode ? "text-purple-300" : "text-green-300"}`}>
            {stats?.simulationMode ? "시뮬레이션 모드 (LEDGER_ENDPOINT 미설정)" : "외부 원장 연동 활성"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {stats?.simulationMode
              ? "내부 SHA-256 결정론적 txId 생성 — LEDGER_ENDPOINT 환경변수 설정 시 Hyperledger Fabric REST API 연동"
              : `엔드포인트: ${stats?.ledgerEndpoint}`}
          </p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "전체 앵커", value: stats?.total ?? 0, icon: <Link2 className="w-4 h-4 text-blue-400" />, desc: "§14.6 누적 앵커" },
          { label: "검증 완료", value: (stats?.byStatus.verified ?? 0) + (stats?.byStatus.simulation ?? 0), icon: <CheckCircle className="w-4 h-4 text-green-400" />, desc: "verified + simulation" },
          { label: "검증률", value: `${stats?.verificationRate ?? 0}%`, icon: <Shield className="w-4 h-4 text-purple-400" />, desc: "Trust Chain 신뢰도" },
          { label: "실패/대기", value: (stats?.byStatus.failed ?? 0) + (stats?.byStatus.pending ?? 0), icon: <AlertTriangle className="w-4 h-4 text-red-400" />, desc: "DLQ 재시도 대상" },
        ].map((c) => (
          <Card key={c.label} className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">{c.icon}<span className="text-xs text-slate-400">{c.label}</span></div>
              <div className="text-2xl font-bold text-white">{c.value}</div>
              <div className="text-xs text-slate-500 mt-1">{c.desc}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 상태별 분포 */}
      {stats && stats.total > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-400">앵커 상태 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(["verified", "simulation", "anchored", "pending", "failed"] as AnchorStatus[]).map((s) => {
                const count = stats.byStatus[s] ?? 0;
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const barColor = { verified: "bg-green-500", simulation: "bg-purple-500", anchored: "bg-blue-500", pending: "bg-yellow-500", failed: "bg-red-500" }[s];
                return (
                  <div key={s} className="flex items-center gap-3">
                    <StatusBadge status={s} />
                    <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 최근 앵커 목록 */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              최근 앵커 레코드
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400 h-7">
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentAnchors.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Link2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              앵커 레코드 없음 — 이식 프로세스 실행 시 자동 생성됩니다.
            </div>
          ) : (
            <div className="space-y-2">
              {recentAnchors.map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.status as AnchorStatus} />
                      <span className="text-xs text-slate-400">{a.entityType} / {a.action}</span>
                    </div>
                    <span className="text-xs text-slate-600">{new Date(a.anchoredAt).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">txId:</span>
                      <span className="font-mono text-slate-300 truncate">{a.txId.slice(0, 24)}...</span>
                      <button onClick={() => copyToClipboard(a.txId, "txId")} className="text-slate-600 hover:text-slate-400">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">chainHash:</span>
                      <span className="font-mono text-slate-300 truncate">{a.chainHash.slice(0, 16)}...</span>
                    </div>
                  </div>
                  {a.blockNumber && (
                    <div className="text-xs text-slate-500 mt-1">Block #{a.blockNumber}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 수동 앵커링 탭 ───────────────────────────────────────────────────────────

function ManualAnchorTab() {
  const [entityType, setEntityType] = useState<EntityType>("implantation");
  const [entityId, setEntityId] = useState("");
  const [action, setAction] = useState("manual_anchor");
  const [implantationId, setImplantationId] = useState("");
  const [lastResult, setLastResult] = useState<{
    anchorId: string;
    chainHash: string;
    txId: string;
    blockNumber: number | null;
    status: AnchorStatus;
    ledgerEndpoint: string;
    verificationProof: string;
  } | null>(null);

  const anchorMutation = trpc.mip.ledgerAnchoring.anchor.useMutation({
    onSuccess: (data) => {
      setLastResult(data as typeof lastResult);
      toast.success("§14.6 앵커링 완료", { description: `txId: ${data.txId.slice(0, 20)}...` });
    },
    onError: (err) => toast.error("앵커링 실패", { description: err.message }),
  });

  const verifyMutation = trpc.mip.ledgerAnchoring.verify.useMutation({
    onSuccess: (data) => {
      if (data.valid) {
        toast.success("검증 통과", { description: data.details });
      } else {
        toast.error("검증 실패", { description: data.details });
      }
    },
    onError: (err) => toast.error("검증 실패", { description: err.message }),
  });

  const ENTITY_LABELS: Record<EntityType, string> = {
    implantation: "이식 프로세스",
    device: "디바이스",
    package: "MIO Package",
    sandbox_report: "Sandbox 리포트",
    safety_log: "Safety 로그",
    policy: "경계 정책",
    session: "Runtime 세션",
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            §14.6 수동 앵커링 테스트
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            감사 항목을 내부 해시 체인에 추가하고 외부 원장(또는 시뮬레이션)에 앵커링합니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">엔티티 유형</label>
              <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
                <SelectTrigger className="bg-slate-900 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(Object.keys(ENTITY_LABELS) as EntityType[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-slate-200">{ENTITY_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">액션</label>
              <Input
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="manual_anchor"
                className="bg-slate-900 border-slate-600 text-slate-200 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">엔티티 ID</label>
              <Input
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="entity-id"
                className="bg-slate-900 border-slate-600 text-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">이식 ID (선택)</label>
              <Input
                value={implantationId}
                onChange={(e) => setImplantationId(e.target.value)}
                placeholder="implantation-id"
                className="bg-slate-900 border-slate-600 text-slate-200 text-sm"
              />
            </div>
          </div>
          <Button
            onClick={() => anchorMutation.mutate({
              entityType,
              entityId: entityId || "test-entity",
              action,
              implantationId: implantationId || undefined,
              data: { testAnchor: true, timestamp: Date.now() },
            })}
            disabled={anchorMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {anchorMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />앵커링 중...</>
            ) : (
              <><Link2 className="w-4 h-4 mr-2" />원장에 앵커링</>
            )}
          </Button>
        </CardContent>
      </Card>

      {lastResult && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              앵커링 결과
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={lastResult.status} />
              {lastResult.blockNumber && (
                <span className="text-xs text-slate-400">Block #{lastResult.blockNumber}</span>
              )}
            </div>
            {[
              { label: "Anchor ID", value: lastResult.anchorId },
              { label: "Chain Hash", value: lastResult.chainHash },
              { label: "Tx ID", value: lastResult.txId },
              { label: "Verification Proof", value: lastResult.verificationProof },
              { label: "Ledger Endpoint", value: lastResult.ledgerEndpoint },
            ].map(({ label, value }) => (
              <div key={label}>
                <span className="text-xs text-slate-500">{label}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded flex-1 truncate">{value}</code>
                  <button onClick={() => copyToClipboard(value, label)} className="text-slate-600 hover:text-slate-400 shrink-0">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => verifyMutation.mutate({ anchorId: lastResult.anchorId })}
              disabled={verifyMutation.isPending}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              {verifyMutation.isPending ? (
                <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />검증 중...</>
              ) : (
                <><Shield className="w-3 h-3 mr-1" />Trust Chain 검증</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── DLQ 탭 ───────────────────────────────────────────────────────────────────

function DlqTab() {
  const { data: dlqList, isLoading, refetch } = trpc.mip.ledgerAnchoring.dlqList.useQuery({ limit: 20 });
  const retryMutation = trpc.mip.ledgerAnchoring.retryDlq.useMutation({
    onSuccess: (data) => {
      toast.success(`DLQ 재시도 완료: ${data.succeeded}성공 / ${data.failed}실패`);
      refetch();
    },
    onError: (err) => toast.error("재시도 실패", { description: err.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">외부 원장 제출 실패 항목 — 지수 백오프 재시도 (최대 5회)</p>
        <Button
          size="sm"
          onClick={() => retryMutation.mutate()}
          disabled={retryMutation.isPending}
          className="bg-orange-600 hover:bg-orange-700 h-7 text-xs"
        >
          {retryMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "DLQ 재시도"}
        </Button>
      </div>
      {isLoading ? (
        <div className="text-center py-8 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : !dlqList || dlqList.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
          DLQ 항목 없음 — 모든 앵커링 성공
        </div>
      ) : (
        <div className="space-y-2">
          {dlqList.map((item) => (
            <Card key={item.id} className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      item.status === "exhausted"
                        ? "bg-red-500/20 text-red-300 border-red-500/30"
                        : item.status === "completed"
                        ? "bg-green-500/20 text-green-300 border-green-500/30"
                        : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                    }`}>{item.status}</span>
                    <span className="text-xs text-slate-400">재시도 {item.retryCount}/{item.maxRetries}</span>
                  </div>
                  <span className="text-xs text-slate-600">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-xs font-mono text-slate-500 truncate">
                  anchor: {item.anchorId}
                </div>
                {item.lastError && (
                  <div className="text-xs text-red-400 mt-1 truncate">오류: {item.lastError}</div>
                )}
                {item.status === "pending" && (
                  <div className="text-xs text-slate-500 mt-1">
                    다음 재시도: {new Date(item.nextRetryAt).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function LedgerAnchoringPage() {
  return (
    <MIPLayout title="§14.6 Ledger Anchoring">
      <div className="p-6 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Link2 className="w-6 h-6 text-blue-400" />
              §14.6 Distributed Ledger Anchoring
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              PSDI v2.0 §14.6 — 감사 체인 외부 원장 연동 · Trust Chain 검증 · DLQ 재시도
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-300">
              <Database className="w-3 h-3 mr-1" />
              내부 해시 체인
            </Badge>
            <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-300">
              <ExternalLink className="w-3 h-3 mr-1" />
              외부 원장 연동
            </Badge>
          </div>
        </div>

        {/* §14.6 개요 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Link2 className="w-4 h-4 text-blue-400" />, title: "앵커링 흐름", desc: "내부 chainHash → 외부 원장 txId 매핑 → 검증 증명 생성" },
            { icon: <Shield className="w-4 h-4 text-green-400" />, title: "Trust Chain 검증", desc: "SHA-256 결정론적 증명 + 외부 원장 대조 검증" },
            { icon: <RefreshCw className="w-4 h-4 text-orange-400" />, title: "DLQ 재시도", desc: "실패 시 지수 백오프 자동 재시도 (최대 5회)" },
          ].map((item) => (
            <Card key={item.title} className="bg-slate-800/30 border-slate-700/50 border">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2 mb-1">{item.icon}<span className="text-xs font-medium text-slate-300">{item.title}</span></div>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 탭 */}
        <Tabs defaultValue="dashboard">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="dashboard" className="text-xs data-[state=active]:bg-slate-700">대시보드</TabsTrigger>
            <TabsTrigger value="anchor" className="text-xs data-[state=active]:bg-slate-700">수동 앵커링</TabsTrigger>
            <TabsTrigger value="dlq" className="text-xs data-[state=active]:bg-slate-700">DLQ 관리</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
          <TabsContent value="anchor" className="mt-4"><ManualAnchorTab /></TabsContent>
          <TabsContent value="dlq" className="mt-4"><DlqTab /></TabsContent>
        </Tabs>
      </div>
    </MIPLayout>
  );
}
