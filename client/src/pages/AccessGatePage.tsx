import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const ACCESS_CODE = "2148782859";
const VERIFIED_KEY = "mip-access-verified";
const MAX_ATTEMPTS = 5;

export function isAccessVerified(): boolean {
  return sessionStorage.getItem(VERIFIED_KEY) === "true";
}

export function clearAccessVerification(): void {
  sessionStorage.removeItem(VERIFIED_KEY);
}

export default function AccessGatePage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    if (isAccessVerified()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;

    if (code === ACCESS_CODE) {
      sessionStorage.setItem(VERIFIED_KEY, "true");
      navigate("/dashboard", { replace: true });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setCode("");
      if (newAttempts >= MAX_ATTEMPTS) {
        setLocked(true);
        setError("접근 시도 횟수를 초과했습니다. 페이지를 새로고침하세요.");
      } else {
        setError(`잘못된 접근 코드입니다. (${newAttempts}/${MAX_ATTEMPTS})`);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">접근 코드 입력</h1>
          <p className="text-sm text-muted-foreground">
            MIP 엔진에 접근하려면 인가된 접근 코드를 입력하세요.
          </p>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50 border border-border">
          <Shield className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.name || "인증된 사용자"}</p>
            <p className="text-xs text-muted-foreground">OAuth 인증 완료</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>

        {/* Code input form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="password"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              disabled={locked}
              placeholder="접근 코드를 입력하세요"
              className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground text-center text-lg tracking-widest font-mono placeholder:text-muted-foreground placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={locked || !code.trim()}
          >
            {locked ? "접근 잠김" : "진입"}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          WO-MIP-2026-001 · PSDI v2.0 보안 프로토콜
        </p>
      </div>
    </div>
  );
}
