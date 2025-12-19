"use client";
/**
 * useJobUpdates - WebSocket hook for real-time job updates
 */
import { useEffect, useState, useCallback } from "react";

export interface JobUpdate {
  type: "JOB_UPDATE";
  jobId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error: string | null;
}

interface UseJobUpdatesReturn {
  updates: JobUpdate[];
  isConnected: boolean;
  clearUpdates: () => void;
}

export function useJobUpdates(tenantId: string): UseJobUpdatesReturn {
  const [updates, setUpdates] = useState<JobUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//localhost:3000/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "SUBSCRIBE", tenantId }));
      console.log("[WS] Connected and subscribed to", tenantId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "JOB_UPDATE") {
          setUpdates((prev) => [data, ...prev]);
        }
      } catch {
        console.error("[WS] Failed to parse message");
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("[WS] Disconnected");
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };

    return () => {
      ws.send(JSON.stringify({ type: "UNSUBSCRIBE", tenantId }));
      ws.close();
    };
  }, [tenantId]);

  const clearUpdates = useCallback(() => setUpdates([]), []);

  return { updates, isConnected, clearUpdates };
}
