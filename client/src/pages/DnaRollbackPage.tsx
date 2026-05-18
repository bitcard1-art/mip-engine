import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import MIPLayout from "@/components/MIPLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DnaRollbackPage() {
  const [packageId, setPackageId] = useState("");
  const [searchId, setSearchId] = useState("");
  const [rollbackTarget, setRollbackTarget] = useState<{ id: string; versionTag: string } | null>(null);

  const utils = trpc.useUtils();

  const { data: history, isLoading, refetch } = trpc.mip.dnaRollback.history.useQuery(
    { packageId: searchId },
    { enabled: !!searchId }
  );

  const { data: packages } = trpc.mip.packages.listAll.useQuery();

  const rollbackMutation = trpc.mip.dnaRollback.rollback.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      utils.mip.dnaRollback.history.invalidate();
      setRollbackTarget(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setRollbackTarget(null);
    },
  });

  const snapshotMutation = trpc.mip.dnaRollback.snapshot.useMutation({
    onSuccess: () => {
      toast.success("DNA 스냅샷이 생성되었습니다.");
      utils.mip.dnaRollback.history.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSearch = () => {
    if (!packageId.trim()) {
      toast.error("Package ID를 입력하세요.");
      return;
    }
    setSearchId(packageId.trim());
  };

  const handleCreateSnapshot = () => {
    if (!searchId) {
      toast.error("먼저 Package를 검색하세요.");
      return;
    }
    snapshotMutation.mutate({
      packageId: searchId,
      dnaData: { timestamp: Date.now(), note: "수동 스냅샷" },
      didSignature: `manual-${Date.now()}`,
      changeReason: "수동 스냅샷 생성",
      isRollbackPoint: true,
    });
  };

  const handleRollback = (versionId: string, versionTag: string) => {
    setRollbackTarget({ id: versionId, versionTag });
  };

  const confirmRollback = () => {
    if (!rollbackTarget || !searchId) return;
    rollbackMutation.mutate({
      packageId: searchId,
      targetVersionId: rollbackTarget.id,
    });
  };

  return (
    <MIPLayout>
      <div className="p-6 space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-bold text-white">DNA Rollback 관리</h1>
          <p className="text-gray-400 mt-1 text-lg">
            PSDI v1.0 Section 4.2 — MIO Package DNA 버전 이력 및 롤백 관리
          </p>
        </div>

        {/* Package 선택 */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-xl">Package 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 등록된 Package 목록 */}
            {packages && packages.length > 0 && (
              <div>
                <p className="text-sm text-gray-400 mb-2">등록된 Package</p>
                <div className="flex flex-wrap gap-2">
                  {packages.map((pkg) => (
                    <Button
                      key={pkg.id}
                      variant="outline"
                      size="sm"
                      className={`border-gray-600 text-sm ${searchId === pkg.id ? "bg-blue-600 border-blue-500 text-white" : "text-gray-300 hover:bg-gray-700"}`}
                      onClick={() => {
                        setPackageId(pkg.id);
                        setSearchId(pkg.id);
                      }}
                    >
                      <span className="font-mono text-xs">{pkg.id.slice(0, 8)}…</span>
                      <span className="ml-1 text-gray-400">{pkg.status}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* 직접 입력 */}
            <div className="flex gap-3">
              <Input
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                placeholder="Package ID 직접 입력"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-500 font-mono"
              />
              <Button
                onClick={handleSearch}
                className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
              >
                버전 이력 조회
              </Button>
              {searchId && (
                <Button
                  onClick={handleCreateSnapshot}
                  disabled={snapshotMutation.isPending}
                  variant="outline"
                  className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 whitespace-nowrap"
                >
                  {snapshotMutation.isPending ? "생성 중..." : "스냅샷 생성"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 버전 이력 */}
        {searchId && (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white text-xl">버전 이력</CardTitle>
                <p className="text-gray-400 text-sm mt-1 font-mono">{searchId}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="text-gray-400 hover:text-white"
              >
                새로고침
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-gray-400 text-center py-8">로딩 중...</p>
              ) : !history || history.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">이 Package의 버전 이력이 없습니다.</p>
                  <p className="text-gray-500 text-sm mt-1">스냅샷 생성 버튼으로 첫 버전을 기록하세요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((ver, idx) => (
                    <div
                      key={ver.id}
                      className={`p-4 rounded-lg border ${idx === 0 ? "bg-blue-900/20 border-blue-500/30" : "bg-gray-900/50 border-gray-700"}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-xs text-gray-400">버전</p>
                            <p className="text-2xl font-bold text-white">v{ver.versionNumber}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-sm">{ver.versionTag}</span>
                              {idx === 0 && (
                                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                                  최신
                                </Badge>
                              )}
                              {ver.isRollbackPoint === 1 && (
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                                  롤백 포인트
                                </Badge>
                              )}
                              {ver.rolledBackAt && (
                                <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                                  롤백됨
                                </Badge>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm mt-0.5">{ver.changeReason}</p>
                            <p className="text-gray-500 text-xs mt-0.5">
                              변경자: {ver.changedBy} ·{" "}
                              {ver.snapshotAt ? new Date(ver.snapshotAt).toLocaleString("ko-KR") : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <p className="text-xs text-gray-500">DNA Hash</p>
                            <p className="text-xs font-mono text-gray-400">{ver.dnaHash.slice(0, 16)}…</p>
                          </div>
                          {idx !== 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-orange-500 text-orange-400 hover:bg-orange-500/10 text-xs"
                              onClick={() => handleRollback(ver.id, ver.versionTag ?? `v${ver.versionNumber}`)}
                            >
                              이 버전으로 롤백
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 롤백 확인 다이얼로그 */}
        <AlertDialog open={!!rollbackTarget} onOpenChange={(open) => !open && setRollbackTarget(null)}>
          <AlertDialogContent className="bg-gray-800 border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white text-xl">DNA 롤백 확인</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-300 text-base">
                <strong className="text-orange-400">{rollbackTarget?.versionTag}</strong>으로 DNA를 롤백합니다.
                <br />
                현재 DNA 상태가 해당 버전으로 복원되며, 이 작업은 새 버전으로 기록됩니다.
                <br />
                <span className="text-yellow-400 mt-2 block">⚠️ 이 작업은 되돌릴 수 없습니다.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRollback}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={rollbackMutation.isPending}
              >
                {rollbackMutation.isPending ? "롤백 중..." : "롤백 실행"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 안내 */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-base">DNA Rollback 사용 안내</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-300">
            <p>
              <strong className="text-white">스냅샷</strong>은 현재 DNA 상태를 특정 시점에 저장합니다.
              중요한 변경 전에 반드시 스냅샷을 생성하세요.
            </p>
            <p>
              <strong className="text-white">롤백 포인트</strong>로 표시된 버전은 중요한 안정 상태를 나타냅니다.
              문제 발생 시 가장 가까운 롤백 포인트로 복원하는 것을 권장합니다.
            </p>
            <p>
              <strong className="text-white">롤백 실행</strong> 시 현재 DNA가 선택한 버전으로 복원되며,
              롤백 자체도 새 버전으로 기록되어 감사 추적이 유지됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </MIPLayout>
  );
}
