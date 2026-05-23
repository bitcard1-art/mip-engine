/**
 * Mock MIO 패키지 생성 다이얼로그
 * LORE 없이 테스트용 Mock 패키지를 직접 생성
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw, Heart, Eye, Users, Palette, Scale, BookOpen, Link2, Beaker
} from "lucide-react";
import { toast } from "sonner";

const PERSONA_DEFS = [
  { id: "emotional",   label: "감정 자아",   icon: Heart,    color: "text-rose-400",    desc: "감정 표현 및 정서 패턴" },
  { id: "cognitive",   label: "인지 자아",   icon: Eye,      color: "text-blue-400",    desc: "사고 방식 및 판단 패턴" },
  { id: "social",      label: "사회적 자아", icon: Users,    color: "text-green-400",   desc: "사회적 상호작용 패턴" },
  { id: "creative",    label: "창의적 자아", icon: Palette,  color: "text-purple-400",  desc: "창작 및 표현 스타일" },
  { id: "moral",       label: "도덕적 자아", icon: Scale,    color: "text-amber-400",   desc: "가치관 및 윤리 판단" },
  { id: "habitual",    label: "습관적 자아", icon: RefreshCw, color: "text-cyan-400",   desc: "일상 루틴 및 행동 습관" },
  { id: "linguistic",  label: "언어적 자아", icon: BookOpen, color: "text-orange-400",  desc: "언어 사용 및 소통 스타일" },
  { id: "relational",  label: "관계적 자아", icon: Link2,    color: "text-pink-400",    desc: "관계 형성 및 유지 패턴" },
] as const;

type PersonaId = typeof PERSONA_DEFS[number]["id"];

export default function MockPackageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaId[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [purpose, setPurpose] = useState<"humanoid_implant" | "software_runtime" | "iot_device">("software_runtime");
  const utils = trpc.useUtils();

  const mockMutation = trpc.mip.packages.generateMock.useMutation({
    onSuccess: (data) => {
      onClose();
      setSelectedPersonas([]);
      setSelectAll(false);
      utils.mip.packages.listAll.invalidate();
      utils.mip.packages.list.invalidate();
      requestAnimationFrame(() => {
        setTimeout(() => {
          toast.success(data.message, {
            description: `Package ID: ${data.packageId}`,
          });
        }, 300);
      });
    },
    onError: (err) => {
      onClose();
      requestAnimationFrame(() => {
        setTimeout(() => {
          toast.error("Mock 패키지 생성 실패", { description: err.message });
        }, 300);
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedPersonas(PERSONA_DEFS.map(p => p.id));
    } else {
      setSelectedPersonas([]);
    }
  };

  const handleTogglePersona = (id: PersonaId) => {
    setSelectedPersonas(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      setSelectAll(next.length === PERSONA_DEFS.length);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedPersonas.length === 0) {
      toast.error("최소 1개 자아를 선택해주세요.");
      return;
    }
    mockMutation.mutate({
      personas: selectedPersonas,
      purpose,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Beaker className="w-5 h-5 text-amber-400" />
            Mock MIO 패키지 생성
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* 안내 */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-300">
              LORE 없이 테스트용 Mock 패키지를 생성합니다. 생성된 패키지는 즉시 'validated' 상태로 이식에 사용할 수 있습니다.
            </p>
          </div>

          {/* 전체 선택 */}
          <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mock-select-all"
                checked={selectAll}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
              />
              <label htmlFor="mock-select-all" className="text-sm font-medium cursor-pointer">
                전체 선택 (8자아 모두)
              </label>
            </div>
            <Badge variant="outline" className="text-xs">
              {selectedPersonas.length}/8 선택
            </Badge>
          </div>

          {/* 8자아 체크박스 그리드 */}
          <div className="grid grid-cols-2 gap-2">
            {PERSONA_DEFS.map(persona => {
              const Icon = persona.icon;
              const isSelected = selectedPersonas.includes(persona.id);
              return (
                <div
                  key={persona.id}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/10 border-primary/40"
                      : "bg-muted/20 border-border/50 hover:border-border"
                  }`}
                  onClick={() => handleTogglePersona(persona.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleTogglePersona(persona.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${persona.color}`} />
                      <span className="text-sm font-medium">{persona.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{persona.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 용도 선택 */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">용도</label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v as typeof purpose)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="software_runtime">소프트웨어 (챗봇)</SelectItem>
                <SelectItem value="iot_device">IoT 디바이스</SelectItem>
                <SelectItem value="humanoid_implant">휴머노이드</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 생성 버튼 */}
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={handleSubmit}
            disabled={selectedPersonas.length === 0 || mockMutation.isPending}
          >
            {mockMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Beaker className="w-4 h-4" />
            )}
            {mockMutation.isPending
              ? "생성 중..."
              : `Mock 패키지 생성 (${selectedPersonas.length}개 자아)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
