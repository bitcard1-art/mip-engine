import MIPLayout from "@/components/MIPLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const POLICY_COLORS: Record<string, string> = {
  p_harm: "text-red-400 bg-red-400/10 border-red-400/20",
  p_child: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  p_unsafe: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  p_emotion: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  p_learning: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

export default function PoliciesPage() {
  const [evalInput, setEvalInput] = useState("");
  const [evalResult, setEvalResult] = useState<any>(null);

  const { data: standardPolicies } = trpc.mip.policies.getStandard.useQuery();
  const { data: userPolicies } = trpc.mip.policies.list.useQuery();

  const evalMutation = trpc.mip.policies.evaluate.useMutation({
    onSuccess: (data) => {
      setEvalResult(data);
      toast[data.blocked ? "error" : "success"](data.blocked ? "정책 위반 감지됨" : "정책 통과");
    },
    onError: (e) => toast.error(`평가 실패: ${e.message}`),
  });

  return (
    <MIPLayout title="경계 정책">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Ethical Boundary Engine</h2>
        <p className="text-sm text-muted-foreground">5개 표준 정책 관리 및 실시간 위반 평가</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Standard Policies */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">표준 정책 (Standard Policies)</h3>
          <div className="space-y-3">
            {standardPolicies?.map((policy) => (
              <Card key={policy.key} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${POLICY_COLORS[policy.key] || "text-muted-foreground bg-muted/10 border-muted/20"}`}>
                      {policy.key}
                    </div>
                    <span className="text-xs text-muted-foreground">레벨: {policy.level}</span>
                  </div>
                  <p className="text-xs text-foreground font-medium mb-1">{policy.type}</p>
                  <p className="text-xs text-muted-foreground">표준: {policy.standard}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {policy.triggers?.slice(0, 5).map((kw: string) => (
                      <span key={kw} className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{kw}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Policy Evaluator */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                정책 위반 평가기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="평가할 입력 텍스트를 입력하세요..."
                value={evalInput}
                onChange={(e) => setEvalInput(e.target.value)}
                className="bg-input border-border text-foreground text-xs min-h-[100px]"
              />
              <Button
                className="w-full"
                onClick={() => evalMutation.mutate({ input: evalInput })}
                disabled={!evalInput || evalMutation.isPending}
              >
                {evalMutation.isPending ? "평가 중..." : "정책 평가 실행"}
              </Button>

              {evalResult && (
                <div className={`p-3 rounded-lg border ${evalResult.blocked ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {evalResult.blocked
                      ? <XCircle className="w-4 h-4 text-red-400" />
                      : <CheckCircle className="w-4 h-4 text-emerald-400" />
                    }
                    <span className={`text-sm font-medium ${evalResult.blocked ? "text-red-400" : "text-emerald-400"}`}>
                      {evalResult.blocked ? "정책 위반 — 차단됨" : "정책 통과"}
                    </span>
                  </div>

                  {evalResult.violations.length > 0 && (
                    <div className="space-y-1">
                      {evalResult.violations.map((v: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
                          <span className="text-yellow-400 font-medium">{v.policyType}</span>
                          <span className="text-muted-foreground">"{v.trigger}"</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">합성 정송 레벨: {evalResult.composite?.compositeLevel || "-"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Policies */}
          {userPolicies && userPolicies.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">사용자 정의 정책</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {userPolicies.map((policy) => (
                  <div key={policy.id} className="p-2 rounded-md bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-foreground">{policy.policyType}</span>
                      <span className={`text-xs ${policy.isActive ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {policy.isActive ? "활성" : "비활성"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{policy.policyType}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MIPLayout>
  );
}
