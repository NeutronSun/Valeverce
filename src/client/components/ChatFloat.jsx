"use client";

import { useEffect, useRef, useState } from "react";
import { CLIENT_EVENTS } from "../../shared/events.js";

export function ChatFloat({ lobby, emit }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [position, setPosition] = useState({ x: 18, y: 96 });
  const inputRef = useRef(null);
  const hideTimerRef = useRef(null);
  const lastSeenMessageIdRef = useRef(null);
  const latestMessage = lobby?.chat?.at(-1);
  const latestMessageId = latestMessage?.id;

  useEffect(() => {
    lastSeenMessageIdRef.current = latestMessageId ?? null;
    setVisible(false);
  }, [lobby?.id]);

  useEffect(() => {
    if (!latestMessageId) {
      return undefined;
    }

    if (!lastSeenMessageIdRef.current) {
      lastSeenMessageIdRef.current = latestMessageId;
      return undefined;
    }

    if (lastSeenMessageIdRef.current === latestMessageId) {
      return undefined;
    }

    lastSeenMessageIdRef.current = latestMessageId;
    if (latestMessage?.kind !== "user") {
      return undefined;
    }

    setVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        setVisible(false);
      }
    }, 10000);
    return () => clearTimeout(hideTimerRef.current);
  }, [latestMessageId, latestMessage?.kind]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key.toLowerCase() === "t" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        setVisible(true);
        clearTimeout(hideTimerRef.current);
        requestAnimationFrame(() => inputRef.current?.focus());
      }

      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        event.preventDefault();
        inputRef.current?.blur();
        setVisible(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!lobby) {
    return null;
  }

  function submit(event) {
    event.preventDefault();
    const clean = text.trim();
    if (!clean) {
      return;
    }
    emit(CLIENT_EVENTS.SEND_CHAT, { text: clean });
    setText("");
  }

  function scheduleHideAfterBlur() {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 10000);
  }

  function startDrag(event) {
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = position;

    function move(moveEvent) {
      setPosition({
        x: Math.max(0, startPosition.x + moveEvent.clientX - startX),
        y: Math.max(0, startPosition.y + moveEvent.clientY - startY)
      });
    }

    function stop() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  return (
    <section
      className={`chat-float${visible ? " is-visible" : " is-hidden"}`}
      style={{ left: position.x, top: position.y }}
    >
      <div className="chat-head" onMouseDown={startDrag}>
        <span>chat</span>
        <button type="button" className="chat-close" onClick={() => setVisible(false)} aria-label="Nascondi chat">
          x
        </button>
      </div>
      <div className="chat-log">
        {lobby.chat.map((message) => (
          <div key={message.id} className={`chat-message ${message.kind === "system" ? "is-system" : ""}`}>
            <strong>{message.kind === "system" ? "sys" : message.name}</strong>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          ref={inputRef}
          value={text}
          maxLength={240}
          placeholder="Scrivi..."
          onBlur={scheduleHideAfterBlur}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit">Invia</button>
      </form>
    </section>
  );
}
