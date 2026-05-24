"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../shared/events.js";

const storedNameKey = "valeverce.playerName";

export function useGameSocket() {
  const socketRef = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [connectionState, setConnectionState] = useState("connecting");
  const [lastError, setLastError] = useState("");

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || undefined, {
      transports: ["websocket", "polling"],
      reconnection: true
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("connected");
      const savedName = window.localStorage.getItem(storedNameKey);
      if (savedName) {
        socket.emit(CLIENT_EVENTS.SET_NAME, { name: savedName });
      }
    });

    socket.on("disconnect", () => setConnectionState("disconnected"));
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

  return useMemo(
    () => ({
      socket: socketRef.current,
      snapshot,
      selfId,
      connectionState,
      lastError,
      clearError: () => setLastError(""),
      emit,
      setName
    }),
    [snapshot, selfId, connectionState, lastError, emit, setName]
  );
}
