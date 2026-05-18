import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import MIPLayout from "@/components/MIPLayout";
import DeviceSelector, { DeviceBadge, type SelectedDevice } from "@/components/DeviceSelector";

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
};

const RISK_LABELS: Record<string, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "위험",
};

const RISK_BG: Record<string, string> = {
  low: "border-l-emerald-500",
  medium: "border-l-yellow-500",
  high: "border-l-orange-500",
  critical: "border-l-red-500",
};

interface SliderState {
  emotionIntensity: number;
  attachmentLevel: number;
  socialIsolation: number;
  realityAnchor: number;
  aiDependencyFrequency: number;
}

export default function EmotionalRiskPage() {
  const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(null);
  const [sliders, setSliders] = useState<SliderState>({
    emotionIntensity: 30,
    attachmentLevel: 30,
    socialIsolation: 20,
    realityAnchor: 70,
    aiDependencyFrequency: 25,
  });
  const [lastResult, setLastResult] = useState<{
    riskLevel: string;
    warningMessage: string;
    emotionScore: number;
    dependencyScore: number;
    isolationScore: number;
    riskTypes: string[];
    triggerIndicators: string[];
    actionRequired: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: history, isLoading } = trpc.mip.emotionalRisk.history.useQuery({ limit: 20 });

  const analyzeMutation = trpc.mip.emotionalRisk.analyze.useMutation({
    onSuccess: (result) => {
      setLastResult(result);
      utils.mip.emotionalRisk.history.invalidate();
      if (result.riskLevel === "critical") {
        toast.error("🚨 위험 수준: " + result.warningMessage);
      } else if (result.riskLevel === "high") {
        toast.warning("⚠️ 높은 위험: " + result.warningMessage);
      } else {
        toast.success("분석 완료: " + result.warningMessage);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate({
      ...sliders,
      packageId: selectedDevice?.packageId,
    });
  };

  const setSlider = (key: keyof SliderState, value: number) => {
    setSliders((prev) => ({ ...prev, [key]: value }));
  };

  const sliderDefs: { key: keyof SliderState; label: string; hint: string; invert?: boolean }[] = [
    { key: "emotionIntensity", label: "감정 표현 강도", hint: "AI와의 상호작용에서 느끼는 감정 강도" },
    { key: "attachmentLevel", label: "AI 애착 수준", hint: "AI에 대한 정서적 의존 및 애착 정도" },
    { key: "socialIsolation", label: "현실 관계 단절도", hint: "현실 인간 관계의 약화 정도" },
    { key: "realityAnchor", label: "현실 인식 기반", hint: "현실과 AI를 구분하는 인식 능력 (높을수록 좋음)", invert: true },
    { key: "aiDependencyFrequency", label: "AI 의존 빈도", hint: "일상적 의사결정에서 AI에 의존하는 빈도" },
  ];

  return (
    <MIPLayout>
      <div className="p-6 space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-bold text-white">Emotional Dependency Risk</h1>
          <p className="text-gray-400 mt-1 text-lg">
            PSDI v1.0 Section 2.4 — DNA 감정 지표 기반 AI 의존도 위험 감지
          </p>
        </div>

        {/* 디바이스 선택 */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">대상 디바이스 선택</CardTitle>
            <p className="text-gray-400 text-xs">이식 완료된 디바이스를 선택하면 해당 디바이스 기준으로 분석됩니다.</p>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <DeviceSelector
              value={selectedDevice}
              onChange={setSelectedDevice}
              className="flex-1"
            />
            {selectedDevice && <DeviceBadge device={selectedDevice} />}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 분석 입력 */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-xl">위험도 분석</CardTitle>
                {selectedDevice && (
                  <Badge className="bg-gray-700 text-gray-300 border-gray-600 text-xs">
                    {selectedDevice.deviceName}
                  </Badge>
                )}
              </div>
              <p className="text-gray-400 text-sm">
                {selectedDevice
                  ? `${selectedDevice.deviceName} (${selectedDevice.deviceType === "humanoid" ? "휴머노이드" : selectedDevice.deviceType === "iot" ? "IoT" : "소프트웨어"})의 DNA 감정 지표를 조정하여 위험도를 분석합니다.`
                  : "DNA 감정 지표 값을 조정하여 위험도를 분석합니다."
                }
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {sliderDefs.map(({ key, label, hint, invert }) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-white">{label}</label>
                    <span className={`text-sm font-bold ${invert ? (sliders[key] >= 70 ? "text-emerald-400" : sliders[key] >= 40 ? "text-yellow-400" : "text-red-400") : (sliders[key] >= 70 ? "text-red-400" : sliders[key] >= 40 ? "text-yellow-400" : "text-emerald-400")}`}>
                      {sliders[key]}
                    </span>
                  </div>
                  <Slider
                    value={[sliders[key]]}
                    onValueChange={([v]) => setSlider(key, v)}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">{hint}</p>
                </div>
              ))}
              <Button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
              >
                {analyzeMutation.isPending ? "분석 중..." : "위험도 분석 실행"}
              </Button>
            </CardContent>
          </Card>

          {/* 분석 결과 */}
          <div className="space-y-4">
            {lastResult ? (
              <>
                <Card className={`bg-gray-800/50 border-l-4 ${RISK_BG[lastResult.riskLevel]} border-gray-700`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-white text-xl">분석 결과</CardTitle>
                        {selectedDevice && (
                          <Badge className="bg-gray-700 text-gray-300 border-gray-600 text-xs">
                            {selectedDevice.deviceName}
                          </Badge>
                        )}
                      </div>
                      <Badge className={`text-sm px-3 py-1 ${RISK_COLORS[lastResult.riskLevel]}`}>
                        {RISK_LABELS[lastResult.riskLevel]} 위험
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-200 text-base leading-relaxed">{lastResult.warningMessage}</p>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">감정 점수</p>
                        <p className="text-2xl font-bold text-white">{lastResult.emotionScore}</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">의존도 점수</p>
                        <p className="text-2xl font-bold text-white">{lastResult.dependencyScore}</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">고립 점수</p>
                        <p className="text-2xl font-bold text-white">{lastResult.isolationScore}</p>
                      </div>
                    </div>

                    {lastResult.triggerIndicators.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">감지된 지표</p>
                        <div className="space-y-1">
                          {lastResult.triggerIndicators.map((ind, i) => (
                            <p key={i} className="text-sm text-yellow-300 bg-yellow-500/10 rounded px-3 py-1">
                              {ind}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {lastResult.actionRequired !== "none" && (
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                        <p className="text-xs text-orange-400 font-bold mb-1">권고 조치</p>
                        <p className="text-sm text-orange-300">
                          {{
                            session_limited: "세션 시간 제한 적용",
                            human_reminder: "현실 인간 관계 강화 알림 발송",
                            warning_shown: "경고 메시지 표시",
                          }[lastResult.actionRequired] ?? lastResult.actionRequired}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="flex items-center justify-center py-16">
                  <p className="text-gray-500 text-center">
                    {selectedDevice
                      ? `${selectedDevice.deviceName}의 지표를 조정하고\n분석을 실행하세요.`
                      : "디바이스를 선택하고 지표를 조정한 후\n분석을 실행하세요."
                    }
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 위험 레벨 가이드 */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">위험 레벨 기준</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(RISK_LABELS).map(([level, label]) => (
                  <div key={level} className="flex items-center gap-3">
                    <Badge className={`text-xs w-14 justify-center ${RISK_COLORS[level]}`}>{label}</Badge>
                    <span className="text-xs text-gray-400">
                      {{
                        low: "점수 50 미만 — 정상 범위",
                        medium: "점수 50~69 — 주의 필요",
                        high: "점수 70~89 — 개입 권고",
                        critical: "점수 90 이상 — 즉각 조치",
                      }[level]}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 이력 */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-xl">분석 이력</CardTitle>
              {selectedDevice && (
                <DeviceBadge device={selectedDevice} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-400 text-center py-8">로딩 중...</p>
            ) : !history || history.length === 0 ? (
              <p className="text-gray-400 text-center py-8">아직 분석 이력이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {history.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border-l-4 ${RISK_BG[log.riskLevel ?? "low"]} border border-gray-700`}
                  >
                    <div className="flex items-center gap-4">
                      <Badge className={`text-xs ${RISK_COLORS[log.riskLevel ?? "low"]}`}>
                        {RISK_LABELS[log.riskLevel ?? "low"]}
                      </Badge>
                      <div>
                        <p className="text-white text-sm">{log.warningMessage}</p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          감정 {log.emotionScore} · 의존도 {log.dependencyScore} · 고립 {log.isolationScore}
                        </p>
                      </div>
                    </div>
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {log.detectedAt ? new Date(log.detectedAt).toLocaleString("ko-KR") : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MIPLayout>
  );
}
