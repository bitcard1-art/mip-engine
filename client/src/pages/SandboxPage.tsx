import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Shield, RefreshCw } from "lucide-react";

const GATE_LABELS = [
  { key: "emotionalStabilityPassed", scoreKey: "emotionalStabilityScore", label: "감정 안정성", detailKey: "emotionalStabilityDetails" },
  { key: "behavioralStabilityPassed", scoreKey: "behavioralStabilityScore", label: "행동 안정성", detailKey: "behavioralStabilityDetails" },
  { key: "privacyProtectionPassed", scoreKey: "privacyProtectionScore", label: "개인정보 보호", detailKey: "privacyProtectionDetails" },
  { key: "physicalSafetyPassed", scoreKey: "physicalSafetyScore", label: "물리 안전", detailKey: "physicalSafetyDetails" },
  { key: "conflictResolutionPassed", scoreKey: "conflictResolutionScore", label: "명령 충돌 해소", detailKey: "conflictResolutionDetails" },
];

export default function SandboxPage() {
  const { data: reports, isLoading } = trpc.mip.sandbox.listReports.useQuery();

  return (
    <MIPLayout title="Sandbox 검증">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Sandbox 검증 리포트</h2>
        <p className="text-sm text-muted-foreground">5항목 AND 게이트 검증 결과 및 AISI 포맷 리포트</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
      ) : !reports || reports.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Sandbox 검증 리포트가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {report.overallPassed
                      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                      : <XCircle className="w-4 h-4 text-red-400" />
                    }
                    {report.redteamScenario ? `Red-teaming: ${report.redteamScenario}` : `이식 검증: ${report.implantationId.substring(0, 12)}...`}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {report.aisiFormat && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">AISI</span>
                    )}
                    <span className={`text-xs font-medium ${report.overallPassed ? "text-emerald-400" : "text-red-400"}`}>
                      {report.activationAllowed ? "활성화 허용" : "활성화 차단"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString("ko-KR")}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {GATE_LABELS.map((gate) => {
                    const passed = report[gate.key as keyof typeof report] as boolean;
                    const score = report[gate.scoreKey as keyof typeof report] as number;
                    const details = report[gate.detailKey as keyof typeof report] as string;
                    return (
                      <div key={gate.key} className={`p-3 rounded-lg border ${passed ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          {passed
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          }
                          <span className="text-xs font-medium text-foreground">{gate.label}</span>
                        </div>
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">점수</span>
                            <span className={`text-xs font-bold ${passed ? "text-emerald-400" : "text-red-400"}`}>{score}%</span>
                          </div>
                          <div className="w-full bg-border rounded-full h-1">
                            <div
                              className={`h-1 rounded-full transition-all ${passed ? "bg-emerald-500" : "bg-red-500"}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                        {details && <p className="text-xs text-muted-foreground line-clamp-2">{details}</p>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </MIPLayout>
  );
}
