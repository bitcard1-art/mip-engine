import { useState } from "react";
import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Activity, Shield, Cpu, MessageSquare, Zap, TrendingUp } from "lucide-react";

const DEVICE_TYPE_LABELS: Record<string, string> = {
  humanoid: "휴머노이드",
  iot: "IoT",
  ai_agent: "AI Agent",
  software: "소프트웨어",
  sms: "SMS",
  kakaotalk: "카카오톡",
  whatsapp: "WhatsApp",
  telegram: "텔레그램",
  youtube: "유튜브",
  line: "LINE",
  instagram: "인스타그램",
  rcs: "RCS",
};

const SERVICE_COLORS: Record<string, string> = {
  hangyeol: "#06b6d4",
  soma: "#8b5cf6",
  lore: "#f59e0b",
  total: "#10b981",
};

const DEVICE_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e", "#3b82f6"];

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color ?? "bg-primary/10"}`}>
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SdkMonitorPage() {
  const [days, setDays] = useState(7);

  const { data: dailyStats, isLoading: loadingDaily } = trpc.mip.sdkMonitor.dailyStats.useQuery({ days });
  const { data: implantStats, isLoading: loadingImplant } = trpc.mip.sdkMonitor.implantStats.useQuery();
  const { data: blockStats, isLoading: loadingBlock } = trpc.mip.sdkMonitor.blockStats.useQuery({ days });
  const { data: messageStats, isLoading: loadingMsg } = trpc.mip.sdkMonitor.messageStats.useQuery({ days });
  const { data: activeSessions, isLoading: loadingSession } = trpc.mip.sdkMonitor.activeSessions.useQuery();
  const { data: recentEvents, isLoading: loadingEvents } = trpc.mip.sdkMonitor.recentEvents.useQuery({ limit: 20 });

  const totalApiCalls = dailyStats?.reduce((s, d) => s + d.total, 0) ?? 0;
  const totalBlocks = blockStats?.reduce((s, b) => s + b.count, 0) ?? 0;

  return (
    <MIPLayout title="SDK 연계 현황">
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">SDK 연계 현황</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">
              Persona Runtime SDK와 MIP 엔진 간 실시간 연계 모니터링
            </p>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-24 sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">오늘</SelectItem>
              <SelectItem value="7">7일</SelectItem>
              <SelectItem value="14">14일</SelectItem>
              <SelectItem value="30">30일</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <StatCard
            icon={Activity}
            label={`API 호출 (${days}일)`}
            value={totalApiCalls.toLocaleString()}
            sub="감사 체인 기준"
            color="bg-cyan-500/10"
          />
          <StatCard
            icon={Cpu}
            label="활성 Runtime 세션"
            value={activeSessions?.length ?? 0}
            sub="현재 실행 중"
            color="bg-violet-500/10"
          />
          <StatCard
            icon={Shield}
            label={`정책 차단 (${days}일)`}
            value={totalBlocks.toLocaleString()}
            sub="격리 위반 감지"
            color="bg-amber-500/10"
          />
          <StatCard
            icon={MessageSquare}
            label={`메시지 검사 (${days}일)`}
            value={messageStats?.total?.toLocaleString() ?? 0}
            sub={`차단 ${messageStats?.blocked ?? 0}건`}
            color="bg-emerald-500/10"
          />
        </div>

        <Tabs defaultValue="api" className="space-y-4">
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <TabsList className="w-max min-w-full sm:w-full">
              <TabsTrigger value="api" className="text-xs sm:text-sm px-2 sm:px-3">API 추이</TabsTrigger>
              <TabsTrigger value="implant" className="text-xs sm:text-sm px-2 sm:px-3">이식 현황</TabsTrigger>
              <TabsTrigger value="safety" className="text-xs sm:text-sm px-2 sm:px-3">안전 게이트</TabsTrigger>
              <TabsTrigger value="sessions" className="text-xs sm:text-sm px-2 sm:px-3">활성 세션</TabsTrigger>
              <TabsTrigger value="events" className="text-xs sm:text-sm px-2 sm:px-3">이벤트</TabsTrigger>
            </TabsList>
          </div>

          {/* API 호출 추이 */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  서비스별 일별 API 호출 수
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDaily ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">로딩 중...</div>
                ) : !dailyStats?.length ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                    아직 연계 데이터가 없습니다
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dailyStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend />
                      <Bar dataKey="hangyeol" name="한결" fill={SERVICE_COLORS.hangyeol} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="soma" name="SOMA" fill={SERVICE_COLORS.soma} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="lore" name="LORE" fill={SERVICE_COLORS.lore} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 이식 현황 */}
          <TabsContent value="implant">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-violet-400" />
                    이식 상태별 현황
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingImplant ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">로딩 중...</div>
                  ) : (
                    <div className="space-y-3">
                      {[
                        { label: "완료", key: "completed", color: "bg-emerald-500" },
                        { label: "진행 중", key: "inProgress", color: "bg-cyan-500" },
                        { label: "실패", key: "failed", color: "bg-red-500" },
                      ].map(({ label, key, color }) => {
                        const val = (implantStats as any)?.[key] ?? 0;
                        const total = implantStats?.total || 1;
                        const pct = Math.round((val / total) * 100);
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="font-medium">{val}건 ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground pt-2">전체 {implantStats?.total ?? 0}건</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">디바이스 타입별 이식</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingImplant ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">로딩 중...</div>
                  ) : !implantStats?.byDeviceType?.length ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">데이터 없음</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={implantStats.byDeviceType.map(d => ({
                            name: DEVICE_TYPE_LABELS[d.deviceType] ?? d.deviceType,
                            value: d.count,
                          }))}
                          cx="50%" cy="50%" outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name} ${value}`}
                          labelLine={false}
                        >
                          {implantStats.byDeviceType.map((_, i) => (
                            <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 안전 게이트 */}
          <TabsContent value="safety">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    격리 위반 유형별 차단 ({days}일)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingBlock ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">로딩 중...</div>
                  ) : !blockStats?.length ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                      차단 이벤트 없음 ✓
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {blockStats.map((b, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <span className="text-sm font-mono text-amber-400">{b.type}</span>
                          <Badge variant="destructive">{b.count}건</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    메시지 검사 결과 ({days}일)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingMsg ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">로딩 중...</div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      {[
                        { label: "안전", key: "safe", color: "bg-emerald-500", textColor: "text-emerald-400" },
                        { label: "의심", key: "suspicious", color: "bg-amber-500", textColor: "text-amber-400" },
                        { label: "차단", key: "blocked", color: "bg-red-500", textColor: "text-red-400" },
                      ].map(({ label, key, color, textColor }) => {
                        const val = (messageStats as any)?.[key] ?? 0;
                        const total = messageStats?.total || 1;
                        const pct = Math.round((val / total) * 100);
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className={textColor}>{label}</span>
                              <span className="font-medium">{val}건</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground">전체 {messageStats?.total ?? 0}건 검사</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 활성 세션 */}
          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  활성 Runtime 세션
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSession ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">로딩 중...</div>
                ) : !activeSessions?.length ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">현재 활성 세션 없음</div>
                ) : (
                  <div className="space-y-2">
                    {activeSessions.map((s) => (
                      <div key={s.id} className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.deviceName}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{s.deviceId.slice(0, 16)}...</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {DEVICE_TYPE_LABELS[s.deviceType ?? ""] ?? s.deviceType}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-mono">{s.protocol}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.startedAt ?? 0).toLocaleString("ko-KR")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 최근 이벤트 */}
          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" />
                  최근 감사 이벤트 (실시간 연계 로그)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingEvents ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">로딩 중...</div>
                ) : !recentEvents?.length ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">이벤트 없음</div>
                ) : (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {recentEvents.map((e, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                        <span className="text-xs text-muted-foreground font-mono w-36 shrink-0 pt-0.5">
                          {new Date(e.timestamp).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-mono text-cyan-400">{e.action}</span>
                          {e.actorId && (
                            <span className="text-xs text-muted-foreground ml-2">· {e.actorId.slice(0, 20)}</span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{e.entityType}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MIPLayout>
  );
}
