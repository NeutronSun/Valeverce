"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CLIENT_EVENTS } from "../../../shared/events.js";
import styles from "./ChatFloat.module.css";

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function positionStyle(position) {
  return /** @type {import("react").CSSProperties} */ (
    /** @type {unknown} */ ({
      "--chat-x": `${position.x}px`,
      "--chat-y": `${position.y}px`
    })
  );
}

export function ChatFloat({ lobby, emit }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [position, setPosition] = useState({ x: 18, y: 96 });
  const inputRef = useRef(null);
  const logRef = useRef(null);
  const hideTimerRef = useRef(null);
  const lastSeenMessageIdRef = useRef(null);
  const latestMessage = lobby?.chat?.at(-1);
  const latestMessageId = latestMessage?.id;
  const chatLength = lobby?.chat?.length ?? 0;
  const selfId = lobby?.self?.id;

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

  useLayoutEffect(() => {
    if (!visible || !logRef.current) {
      return;
    }

    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [chatLength, visible]);

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
    requestAnimationFrame(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });
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
    <section className={classNames(styles.root, visible && styles.visible)} style={positionStyle(position)}>
      <div className={styles.head} onMouseDown={startDrag}>
        <span>chat</span>
        <button type="button" className={styles.close} onClick={() => setVisible(false)} aria-label="Nascondi chat">
          x
        </button>
      </div>
      <div className={styles.log} ref={logRef}>
        {lobby.chat.map((message) => {
          const authorLabel = message.kind === "system" ? "SYS" : message.name;
          const messageClass = classNames(
            styles.message,
            message.kind === "system" && styles.system,
            message.kind === "user" && message.playerId === selfId && styles.self,
            message.kind === "user" && message.playerId !== selfId && styles.enemy
          );

          return (
            <div key={message.id} className={messageClass}>
              <span className={styles.author}>[{authorLabel}]:</span>
              <span className={styles.text}>{message.text}</span>
            </div>
          );
        })}
      </div>
      <form className={styles.form} onSubmit={submit}>
        <input
          className={styles.input}
          ref={inputRef}
          value={text}
          maxLength={240}
          placeholder="Scrivi..."
          onBlur={scheduleHideAfterBlur}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className={styles.submit}>Invia</button>
      </form>
    </section>
  );
}
