"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../shared/events.js";
import { ProfileStore } from "./profile/ProfileStore.js";

const storedNameKey = "valeverce.playerName";
const pingIntervalMs = 2500;

export function useGameSocket() {
  const socketRef = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [connectionState, setConnectionState] = useState("connecting");
  const [lastError, setLastError] = useState("");
  const [pingMs, setPingMs] = useState(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || undefined, {
      transports: ["websocket", "polling"],
      reconnection: true
    });
    socketRef.current = socket;

    let pingInterval = null;

    const stopPing = () => {
      if (pingInterval) {
        window.clearInterval(pingInterval);
      }
      pingInterval = null;
    };

    const measurePing = () => {
      if (!socket.connected) {
        return;
      }

      const startedAt = performance.now();
      socket.emit(CLIENT_EVENTS.LATENCY_PROBE, { sentAt: Date.now() }, () => {
        setPingMs(Math.max(0, Math.round(performance.now() - startedAt)));
      });
    };

    const startPing = () => {
      stopPing();
      measurePing();
      pingInterval = window.setInterval(measurePing, pingIntervalMs);
    };

    socket.on("connect", () => {
      setConnectionState("connected");
      const savedProfile = ProfileStore.read();
      const savedName = window.localStorage.getItem(storedNameKey);
      if (savedProfile) {
        socket.emit(CLIENT_EVENTS.UPSERT_PROFILE, { profile: savedProfile });
      } else if (savedName) {
        socket.emit(CLIENT_EVENTS.SET_NAME, { name: savedName });
      }
      startPing();
    });

    socket.on("disconnect", () => {
      stopPing();
      setConnectionState("disconnected");
      setPingMs(null);
    });
    socket.on("reconnect_attempt", () => setConnectionState("reconnecting"));

    socket.on(SERVER_EVENTS.HELLO, (message) => {
      setSelfId(message.selfId);
    });

    socket.on(SERVER_EVENTS.STATE, (message) => {
      setSnapshot(message);
      setSelfId(message.selfId);
    });

    socket.on(SERVER_EVENTS.ERROR, (message) => {
      setLastError(message.message ?? "Errore socket");
    });

    return () => {
      stopPing();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emit = useCallback((type, payload = {}) => {
    socketRef.current?.emit(type, payload);
  }, []);

  const setName = useCallback(
    (name) => {
      const nextName = String(name ?? "").slice(0, 18);
      window.localStorage.setItem(storedNameKey, nextName);
      emit(CLIENT_EVENTS.SET_NAME, { name: nextName });
    },
    [emit]
  );

  const upsertProfile = useCallback(
    (profile) => {
      const nextProfile = ProfileStore.save(profile);
      emit(CLIENT_EVENTS.UPSERT_PROFILE, { profile: nextProfile });
      return nextProfile;
    },
    [emit]
  );

  return useMemo(
    () => ({
      socket: socketRef.current,
      snapshot,
      selfId,
      connectionState,
      pingMs,
      lastError,
      clearError: () => setLastError(""),
      emit,
      setName,
      upsertProfile
    }),
    [snapshot, selfId, connectionState, pingMs, lastError, emit, setName, upsertProfile]
  );
}
