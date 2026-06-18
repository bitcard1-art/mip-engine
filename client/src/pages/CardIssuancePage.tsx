import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Plus,
  Key,
  Shield,
  Eye,
} from "lucide-react";

export default function CardIssuancePage() {
  return (
    <DashboardLayout>
      <CardIssuanceContent />
    </DashboardLayout>
  );
}

function CardIssuanceContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("requests");
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // 직접 발급 폼
  const [directForm, setDirectForm] = useState({
    subjectDid: "",
    displayName: "",
    title: "",
    organization: "",
    bio: "",
    capabilities: "mip:read",
    expiresInDays: 365,
  });

  // Queries
  const requestsQuery = trpc.adminCards.listRequests.useQuery({ status: "all", limit: 50 });
  const issuedCardsQuery = trpc.adminCards.listIssuedCards.useQuery({ limit: 50 });
  const publicKeyQuery = trpc.adminCards.getPublicKey.useQuery();
  const cardDetailQuery = trpc.adminCards.getIssuedCard.useQuery(
    { id: selectedCardId! },
    { enabled: !!selectedCardId }
  );

  // Mutations
  const approveMutation = trpc.adminCards.approve.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      requestsQuery.refetch();
      issuedCardsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.adminCards.reject.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      requestsQuery.refetch();
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const issueDirectlyMutation = trpc.adminCards.issueDirectly.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIssueDialogOpen(false);
      requestsQuery.refetch();
      issuedCardsQuery.refetch();
      setDirectForm({ subjectDid: "", displayName: "", title: "", organization: "", bio: "", capabilities: "mip:read", expiresInDays: 365 });
    },
    onError: (err) => toast.error(err.message),
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">접근 권한 없음</h2>
            <p className="text-muted-foreground">이 페이지는 관리자(이영도)만 접근할 수 있습니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = requestsQuery.data?.filter(r => r.status === "pending").length ?? 0;
  const issuedCount = issuedCardsQuery.data?.length ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            페르소나 카드 발급
          </h1>
          <p className="text-muted-foreground mt-1">
            Ed25519 서명 기반 페르소나 카드 발급 및 관리
          </p>
        </div>
        <Button onClick={() => setIssueDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          직접 발급
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">대기 중 요청</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{issuedCount}</p>
                <p className="text-sm text-muted-foreground">발급 완료</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Key className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-mono truncate max-w-[200px]">
                  {publicKeyQuery.data?.issuerDid ?? "..."}
                </p>
                <p className="text-sm text-muted-foreground">발급자 DID</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requests" className="gap-2">
            발급 요청 {pendingCount > 0 && <Badge variant="destructive" className="text-xs px-1.5">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="issued">발급 이력</TabsTrigger>
          <TabsTrigger value="publickey">공개키</TabsTrigger>
        </TabsList>

        {/* 발급 요청 탭 */}
        <TabsContent value="requests" className="space-y-3 mt-4">
          {requestsQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : !requestsQuery.data?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                발급 요청이 없습니다. 외부 서비스에서 POST /api/hangyeol/card/request로 요청하거나, "직접 발급" 버튼을 사용하세요.
              </CardContent>
            </Card>
          ) : (
            requestsQuery.data.map(req => (
              <Card key={req.id} className={req.status === "pending" ? "border-yellow-500/30" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {req.displayName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{req.displayName}</span>
                          <StatusBadge status={req.status} />
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{req.subjectDid}</p>
                        {req.title && <p className="text-xs text-muted-foreground mt-0.5">{req.title} · {req.organization}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => { setSelectedRequestId(req.id); setRejectDialogOpen(true); }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            거부
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate({ requestId: req.id, expiresInDays: req.expiresInDays ?? 365 })}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            승인
                          </Button>
                        </>
                      )}
                      {req.status === "approved" && req.issuedCardId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedCardId(req.issuedCardId!); setDetailDialogOpen(true); }}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          카드 보기
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {(() => {
                      try { return JSON.parse(req.capabilities) as string[]; } catch { return []; }
                    })().map((cap: string) => (
                      <Badge key={cap} variant="secondary" className="text-xs">{cap}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    요청: {req.requesterService} · {new Date(Number(req.createdAt)).toLocaleString("ko-KR")}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* 발급 이력 탭 */}
        <TabsContent value="issued" className="space-y-3 mt-4">
          {issuedCardsQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : !issuedCardsQuery.data?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                발급된 카드가 없습니다.
              </CardContent>
            </Card>
          ) : (
            issuedCardsQuery.data.map(card => (
              <Card key={card.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <span className="font-medium">{card.displayName}</span>
                        <p className="text-xs text-muted-foreground font-mono">{card.subjectDid}</p>
                        <p className="text-xs text-muted-foreground">
                          발급: {new Date(Number(card.issuedAt)).toLocaleDateString("ko-KR")} · 
                          만료: {new Date(Number(card.expiresAt)).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelectedCardId(card.id); setDetailDialogOpen(true); }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      JSON 복사
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* 공개키 탭 */}
        <TabsContent value="publickey" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                MIP 발급자 공개키
              </CardTitle>
              <CardDescription>
                외부 서비스(panc 등)에서 카드 서명을 검증할 때 사용하는 공개키입니다.
                ISSUER_PUBLIC_KEY_PEM 환경변수에 주입하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {publicKeyQuery.data ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Issuer DID</label>
                    <pre className="mt-1 p-3 bg-muted rounded-lg text-sm font-mono">{publicKeyQuery.data.issuerDid}</pre>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Public Key (PEM)</label>
                    <pre className="mt-1 p-3 bg-muted rounded-lg text-sm font-mono whitespace-pre-wrap break-all">
                      {publicKeyQuery.data.publicKeyPem}
                    </pre>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(publicKeyQuery.data!.publicKeyPem);
                      toast.success("공개키가 클립보드에 복사되었습니다.");
                    }}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    공개키 복사
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">로딩 중...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 직접 발급 다이얼로그 */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>페르소나 카드 직접 발급</DialogTitle>
            <DialogDescription>
              대상 페르소나 정보를 입력하고 Ed25519 서명 카드를 발급합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Subject DID *</label>
              <Input
                placeholder="did:persona:0OC8fQ2nuF"
                value={directForm.subjectDid}
                onChange={e => setDirectForm(f => ({ ...f, subjectDid: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">이름 *</label>
              <Input
                placeholder="이은실"
                value={directForm.displayName}
                onChange={e => setDirectForm(f => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">직함</label>
                <Input
                  placeholder="AI Researcher"
                  value={directForm.title}
                  onChange={e => setDirectForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">소속</label>
                <Input
                  placeholder="SOMA Labs"
                  value={directForm.organization}
                  onChange={e => setDirectForm(f => ({ ...f, organization: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">소개</label>
              <Textarea
                placeholder="페르소나 설명..."
                value={directForm.bio}
                onChange={e => setDirectForm(f => ({ ...f, bio: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Capabilities (쉼표 구분)</label>
              <Input
                placeholder="mip:read, mip:decision-core:execute"
                value={directForm.capabilities}
                onChange={e => setDirectForm(f => ({ ...f, capabilities: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">유효기간 (일)</label>
              <Input
                type="number"
                value={directForm.expiresInDays}
                onChange={e => setDirectForm(f => ({ ...f, expiresInDays: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>취소</Button>
            <Button
              onClick={() => {
                const caps = directForm.capabilities.split(",").map(s => s.trim()).filter(Boolean);
                issueDirectlyMutation.mutate({
                  subjectDid: directForm.subjectDid,
                  displayName: directForm.displayName,
                  title: directForm.title || undefined,
                  organization: directForm.organization || undefined,
                  bio: directForm.bio || undefined,
                  capabilities: caps,
                  expiresInDays: directForm.expiresInDays,
                });
              }}
              disabled={!directForm.subjectDid || !directForm.displayName || issueDirectlyMutation.isPending}
            >
              {issueDirectlyMutation.isPending ? "서명 중..." : "서명 발급"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거부 다이얼로그 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>카드 발급 거부</DialogTitle>
            <DialogDescription>거부 사유를 입력하세요.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="거부 사유..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedRequestId && rejectReason) {
                  rejectMutation.mutate({ requestId: selectedRequestId, reason: rejectReason });
                }
              }}
              disabled={!rejectReason || rejectMutation.isPending}
            >
              거부
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 카드 상세 다이얼로그 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>발급된 카드 상세</DialogTitle>
            <DialogDescription>서명된 카드 JSON을 복사하여 대상 서비스에 전달하세요.</DialogDescription>
          </DialogHeader>
          {cardDetailQuery.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">대상:</span> {cardDetailQuery.data.displayName}</div>
                <div><span className="text-muted-foreground">DID:</span> <code className="text-xs">{cardDetailQuery.data.subjectDid}</code></div>
                <div><span className="text-muted-foreground">발급일:</span> {new Date(Number(cardDetailQuery.data.issuedAt)).toLocaleDateString("ko-KR")}</div>
                <div><span className="text-muted-foreground">만료일:</span> {new Date(Number(cardDetailQuery.data.expiresAt)).toLocaleDateString("ko-KR")}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">ISSUER_SIGNED_CARD (환경변수 값)</label>
                <pre className="mt-1 p-3 bg-muted rounded-lg text-xs font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                  {cardDetailQuery.data.signedCardJson}
                </pre>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(cardDetailQuery.data!.signedCardJson);
                  toast.success("서명된 카드 JSON이 클립보드에 복사되었습니다.");
                }}
              >
                <Copy className="h-4 w-4" />
                카드 JSON 복사
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-center">로딩 중...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">대기</Badge>;
    case "approved":
      return <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">승인</Badge>;
    case "rejected":
      return <Badge variant="outline" className="text-destructive border-destructive/30">거부</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
