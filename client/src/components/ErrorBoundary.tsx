import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * DOM 조작 관련 에러인지 판별 (React 19 + Sonner flushSync 충돌 등)
 * 이런 에러는 일시적이므로 자동 복구를 시도한다.
 */
function isDomManipulationError(error: Error): boolean {
  const msg = error.message || "";
  return (
    msg.includes("insertBefore") ||
    msg.includes("removeChild") ||
    msg.includes("appendChild") ||
    msg.includes("not a child of this node") ||
    (error.name === "NotFoundError" && msg.includes("Node"))
  );
}

const MAX_AUTO_RETRY = 2;

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // DOM 조작 에러는 자동 복구 시도 (최대 2회)
    if (isDomManipulationError(error) && this.state.retryCount < MAX_AUTO_RETRY) {
      setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
        }));
      }, 200);
    }
  }

  render() {
    if (this.state.hasError) {
      // DOM 조작 에러이고 아직 재시도 횟수가 남아있으면 로딩 표시
      if (isDomManipulationError(this.state.error!) && this.state.retryCount < MAX_AUTO_RETRY) {
        return null; // componentDidCatch에서 자동 복구 중
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">예상치 못한 오류가 발생했습니다.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              재로드 페이지
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
