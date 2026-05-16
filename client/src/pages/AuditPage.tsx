import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle, XCircle, RefreshCw } from "lucide-react";

export default function AuditPage() {
  const { data: auditLogs, isLoading } = trpc.mip.audit.list.useQuery({ limit: 50 });
  const { data: verifyResult } = trpc.mip.audit.verify.useQuery();

  return (
    <MIPLayout title="감사 체인">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">감사 체인 (Audit Chain)</h2>
        <p className="text-sm text-muted-foreground">불변 감사 로그 및 체인 무결성 검증</p>
      </div>

      {/* Chain Integrity */}
      <Card className={`mb-6 border-2 ${verifyResult?.valid ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {verifyResult?.valid
              ? <CheckCircle className="w-6 h-6 text-emerald-400" />
              : <XCircle className="w-6 h-6 text-red-400" />
            }
            <div>
              <p className={`text-sm font-semibold ${verifyResult?.valid ? "text-emerald-400" : "text-red-400"}`}>
                {verifyResult?.valid ? "체인 무결성 검증 통과" : "체인 무결성 오류 감지"}
              </p>
              <p className="text-xs text-muted-foreground">
                총 {verifyResult?.totalEntries || 0}개 항목 · {verifyResult?.valid ? "변조 없음" : `오류 감지 (시퀀스: ${verifyResult?.brokenAt ?? "알 수 없음"})`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            감사 로그
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin text-primary mx-auto" /></div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">감사 로그가 없습니다</div>
          ) : (
            <div className="divide-y divide-border">
              {auditLogs.map((log) => (
                <div key={log.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-primary">#{log.sequenceNumber}</span>
                    <span className="text-xs font-medium text-foreground">{log.action}</span>
                    <span className="text-xs text-muted-foreground">{log.entityType}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(log.timestamp).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono truncate">{log.entityId}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-xs font-mono text-muted-foreground truncate">{log.chainHash.substring(0, 16)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </MIPLayout>
  );
}
