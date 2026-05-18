import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Cpu, Monitor, Bot } from "lucide-react";

const DEVICE_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  humanoid: { label: "휴머노이드", icon: Bot, color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  iot: { label: "IoT", icon: Monitor, color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  software: { label: "소프트웨어", icon: Cpu, color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
};

export interface SelectedDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  implantationId: string;
  packageId: string;
}

interface DeviceSelectorProps {
  value: SelectedDevice | null;
  onChange: (device: SelectedDevice | null) => void;
  /** 완료된 이식만 필터링 (기본: true) */
  completedOnly?: boolean;
  className?: string;
}

/**
 * 이식 완료 디바이스 선택 드롭다운 + 선택된 디바이스 명칭 배지
 * 
 * devices.listAll + implant.list를 조합하여
 * 이식 완료된 디바이스만 선택 가능하게 합니다.
 */
export default function DeviceSelector({ value, onChange, completedOnly = true, className }: DeviceSelectorProps) {
  const { data: devices } = trpc.mip.devices.listAll.useQuery();
  const { data: implantations } = trpc.mip.implant.list.useQuery();

  // 이식 완료된 디바이스만 필터링하고 implantationId/packageId 매핑
  const selectableDevices = useMemo(() => {
    if (!devices || !implantations) return [];

    const completedImplants = completedOnly
      ? implantations.filter((i) => i.status === "completed")
      : implantations;

    return completedImplants
      .map((impl) => {
        const device = devices.find((d) => d.id === impl.deviceId);
        if (!device) return null;
        return {
          deviceId: device.id,
          deviceName: device.deviceName,
          deviceType: device.deviceType,
          implantationId: impl.id,
          packageId: impl.packageId,
        } as SelectedDevice;
      })
      .filter(Boolean) as SelectedDevice[];
  }, [devices, implantations, completedOnly]);

  const handleChange = (deviceId: string) => {
    const selected = selectableDevices.find((d) => d.deviceId === deviceId) ?? null;
    onChange(selected);
  };

  return (
    <div className={className}>
      <Select value={value?.deviceId ?? ""} onValueChange={handleChange}>
        <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
          <SelectValue placeholder="디바이스를 선택하세요" />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-700">
          {selectableDevices.length === 0 ? (
            <SelectItem value="__none__" disabled>
              이식 완료된 디바이스가 없습니다
            </SelectItem>
          ) : (
            selectableDevices.map((d) => {
              const cfg = DEVICE_TYPE_CONFIG[d.deviceType] ?? DEVICE_TYPE_CONFIG.iot;
              return (
                <SelectItem key={d.deviceId} value={d.deviceId} className="text-white hover:bg-gray-700">
                  <span className="flex items-center gap-2">
                    <cfg.icon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium">{d.deviceName}</span>
                    <span className="text-xs text-gray-400">({cfg.label})</span>
                  </span>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * 선택된 디바이스 명칭 배지 (데이터 영역 상단에 표시)
 */
export function DeviceBadge({ device }: { device: SelectedDevice | null }) {
  if (!device) return null;
  const cfg = DEVICE_TYPE_CONFIG[device.deviceType] ?? DEVICE_TYPE_CONFIG.iot;
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.color} text-sm px-3 py-1 gap-1.5`}>
      <Icon className="w-3.5 h-3.5" />
      {device.deviceName}
      <span className="text-xs opacity-70 ml-1">({cfg.label})</span>
    </Badge>
  );
}
