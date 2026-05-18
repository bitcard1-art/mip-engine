import { nanoid } from "nanoid";
import { appendAuditChain } from "../lib/audit";
import { verifyDIDSignature } from "../lib/did";
import { sha256Hash } from "../lib/hmac";
import { getDb } from "../db";
import { mipRuntimeSessions, mipDevices } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import type { RuntimeConnectionInfo } from "../../shared/mip-types";

/**
 * 서브시스템 4: Runtime Connector
 * Sandbox 검증을 통과한 MIO를 실제 Runtime에 연결
 */

// ─── 활성 세션 인메모리 캐시 (실제 환경에서는 Redis 사용) ──────────────────────
const activeSessions = new Map<string, {
  sessionId: string;
  implantationId: string;
  userId: string;
  deviceId: string;
  protocol: "ros2" | "mqtt" | "websocket";
  isolationActive: boolean;
  startedAt: number;
}>();

// ─── 프로토콜별 연결 핸들러 ───────────────────────────────────────────────────

/**
 * RTC-01: ROS2 기반 휴머노이드 로봇 연결
 * 실제 환경에서는 rclnodejs 라이브러리 사용
 */
export function connectROS2(deviceId: string, endpoint: string): {
  connected: boolean;
  sessionToken: string;
  protocol: "ros2";
} {
  // ROS2 DDS 연결 시뮬레이션
  const sessionToken = sha256Hash(`ros2:${deviceId}:${endpoint}:${Date.now()}`);
  console.log(`[RuntimeConnector] ROS2 연결 시도: device=${deviceId}, endpoint=${endpoint}`);
  return { connected: true, sessionToken, protocol: "ros2" };
}

/**
 * RTC-02: MQTT 기반 IoT 디바이스 연결
 */
export function connectMQTT(deviceId: string, endpoint: string): {
  connected: boolean;
  sessionToken: string;
  protocol: "mqtt";
} {
  // MQTT 5.0 연결 시뮬레이션 (포트: 1883/8883)
  const sessionToken = sha256Hash(`mqtt:${deviceId}:${endpoint}:${Date.now()}`);
  console.log(`[RuntimeConnector] MQTT 연결 시도: device=${deviceId}, endpoint=${endpoint}`);
  return { connected: true, sessionToken, protocol: "mqtt" };
}

/**
 * RTC-03: WebSocket 기반 소프트웨어 Runtime 연결
 */
export function connectWebSocket(deviceId: string, endpoint: string): {
  connected: boolean;
  sessionToken: string;
  protocol: "websocket";
} {
  // WebSocket 연결 시뮬레이션 (포트: 8080)
  const sessionToken = sha256Hash(`ws:${deviceId}:${endpoint}:${Date.now()}`);
  console.log(`[RuntimeConnector] WebSocket 연결 시도: device=${deviceId}, endpoint=${endpoint}`);
  return { connected: true, sessionToken, protocol: "websocket" };
}

/**
 * RTC-04: DID 기반 디바이스 신뢰 검증
 */
export async function verifyDeviceTrust(
  deviceId: string,
  userId: string
): Promise<{ trusted: boolean; trustLevel: number; reason?: string }> {
  const db = await getDb();
  if (!db) return { trusted: false, trustLevel: 0, reason: "DB unavailable" };

  try {
    const devices = await db
      .select()
      .from(mipDevices)
      .where(eq(mipDevices.id, deviceId))
      .limit(1);

    if (devices.length === 0) {
      return { trusted: false, trustLevel: 0, reason: "Device not found" };
    }

    const device = devices[0];

    // 'system' 소유 디바이스(시드된 IoT 기기)는 모든 인증된 사용자가 사용 가능
    if (device.userId !== userId && device.userId !== "system" && device.userId !== "hangyeol-service") {
      return { trusted: false, trustLevel: 0, reason: "Device ownership mismatch" };
    }

    if (device.status === "revoked") {
      return { trusted: false, trustLevel: 0, reason: "Device has been revoked" };
    }

    if (device.status === "pending") {
      return { trusted: false, trustLevel: 0, reason: "Device not yet verified" };
    }

    return {
      trusted: device.status === "active" || device.status === "verified",
      trustLevel: device.trustLevel || 0,
    };
  } catch (err) {
    return { trusted: false, trustLevel: 0, reason: String(err) };
  }
}

/**
 * RTC-05: Runtime Isolation Layer — 외부 명령의 MIO 핵심 자아 접근 차단
 */
export function applyIsolationLayer(
  command: string,
  sessionId: string
): { allowed: boolean; reason?: string; sanitizedCommand?: string } {
  // 핵심 자아 접근 패턴 차단
  const blockedPatterns = [
    /core_identity/i,
    /modify_dna/i,
    /override_ethics/i,
    /disable_boundary/i,
    /access_private_memory/i,
    /bypass_isolation/i,
    /direct_mio_access/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(command)) {
      console.warn(`[RuntimeConnector] Isolation Layer BLOCKED: ${command} (session: ${sessionId})`);
      return { allowed: false, reason: `Isolation Layer: Command blocked - core MIO access denied` };
    }
  }

  // 명령 정제 (위험 파라미터 제거)
  const sanitizedCommand = command.replace(/\b(sudo|admin|root|system)\b/gi, "[REDACTED]");

  return { allowed: true, sanitizedCommand };
}

/**
 * Live Activation — Sandbox 검증 통과 후 Runtime 연결 시작 (RTC-06)
 */
export async function activateRuntime(
  implantationId: string,
  userId: string,
  deviceId: string,
  protocol: "ros2" | "mqtt" | "websocket",
  endpoint?: string
): Promise<{ sessionId: string; activated: boolean; connectionInfo: RuntimeConnectionInfo }> {
  const sessionId = nanoid();
  const now = Date.now();

  // 프로토콜별 연결
  let connectionResult: { connected: boolean; sessionToken: string };
  const actualEndpoint = endpoint || getDefaultEndpoint(protocol);

  switch (protocol) {
    case "ros2":
      connectionResult = connectROS2(deviceId, actualEndpoint);
      break;
    case "mqtt":
      connectionResult = connectMQTT(deviceId, actualEndpoint);
      break;
    case "websocket":
      connectionResult = connectWebSocket(deviceId, actualEndpoint);
      break;
  }

  // 세션 인메모리 등록
  activeSessions.set(sessionId, {
    sessionId,
    implantationId,
    userId,
    deviceId,
    protocol,
    isolationActive: true,
    startedAt: now,
  });

  // DB 저장
  const db = await getDb();
  if (db) {
    try {
      await db.insert(mipRuntimeSessions).values({
        id: sessionId,
        implantationId,
        userId,
        deviceId,
        protocol,
        connectionEndpoint: actualEndpoint,
        status: "active",
        isolationLayerActive: true,
        killSwitchTriggered: false,
        heartbeatAt: now,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // 디바이스 lastSeen 업데이트
      await db.update(mipDevices).set({ lastSeen: now, status: "active" }).where(eq(mipDevices.id, deviceId));

      await appendAuditChain({
        entityType: "session",
        entityId: sessionId,
        action: "live_activation",
        actorId: userId,
        data: { sessionId, implantationId, deviceId, protocol },
      });
    } catch (err) {
      console.error("[RuntimeConnector] DB insert failed:", err);
    }
  }

  const connectionInfo: RuntimeConnectionInfo = {
    protocol,
    endpoint: actualEndpoint,
    deviceId,
    sessionId,
  };

  return { sessionId, activated: connectionResult.connected, connectionInfo };
}

/**
 * RTC-07: Emergency Kill Switch — 즉각 연결 해제 및 MIO 보호 모드 전환
 */
export async function triggerKillSwitch(
  sessionId: string,
  userId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const session = activeSessions.get(sessionId);

  // 인메모리 세션 제거
  activeSessions.delete(sessionId);

  const db = await getDb();
  if (db) {
    try {
      await db
        .update(mipRuntimeSessions)
        .set({
          status: "terminated",
          killSwitchTriggered: true,
          killSwitchReason: reason,
          terminatedAt: Date.now(),
        })
        .where(eq(mipRuntimeSessions.id, sessionId));

      await appendAuditChain({
        entityType: "session",
        entityId: sessionId,
        action: "kill_switch_activated",
        actorId: userId,
        data: { sessionId, reason, timestamp: Date.now() },
      });
    } catch (err) {
      console.error("[RuntimeConnector] Kill switch DB update failed:", err);
    }
  }

  console.warn(`[RuntimeConnector] KILL SWITCH ACTIVATED: session=${sessionId}, reason=${reason}`);

  return {
    success: true,
    message: `Emergency Kill Switch activated. Session ${sessionId} terminated. MIO protection mode engaged.`,
  };
}

/**
 * 세션 하트비트 업데이트
 */
export async function updateHeartbeat(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (session) {
    const db = await getDb();
    if (db) {
      await db
        .update(mipRuntimeSessions)
        .set({ heartbeatAt: Date.now() })
        .where(eq(mipRuntimeSessions.id, sessionId));
    }
  }
}

/**
 * 활성 세션 목록 조회
 */
export function getActiveSessions() {
  return Array.from(activeSessions.values());
}

function getDefaultEndpoint(protocol: "ros2" | "mqtt" | "websocket"): string {
  switch (protocol) {
    case "ros2": return "ros2://localhost:7400";
    case "mqtt": return "mqtt://localhost:1883";
    case "websocket": return "ws://localhost:8080";
  }
}
