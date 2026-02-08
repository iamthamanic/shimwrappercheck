/**
 * In development: suppresses "message port closed" unhandled rejection from browser
 * extensions and logs a short hint so the console stays clear.
 * Location: /components/DevConsoleHint.tsx
 */
"use client";

import { useEffect } from "react";

const MESSAGE_PORT_CLOSED = "The message port closed before a response was received.";
const RUNTIME_LAST_ERROR = "runtime.lastError";

export default function DevConsoleHint() {
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return;

    const onRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? String(event.reason ?? "");
      if (msg.includes(MESSAGE_PORT_CLOSED) || msg.includes(RUNTIME_LAST_ERROR)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return null;
}
