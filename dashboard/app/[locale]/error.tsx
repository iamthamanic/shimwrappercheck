"use client";

/**
 * Catches errors in [locale] routes and shows a fallback instead of 500.
 * Uses static text so it never throws (e.g. if NextIntlProvider is missing or messages failed).
 * Location: app/[locale]/error.tsx
 */
import { useEffect } from "react";

const FALLBACK = {
  title: "Fehler",
  fallbackMessage: "Ein unerwarteter Fehler ist aufgetreten.",
  retry: "Erneut versuchen",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return (error as Error).message;
  if (typeof error === "string") return error;
  return "";
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = getErrorMessage(error);
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 text-white bg-[#0f0f0f]">
      <h1 className="text-xl font-semibold mb-2">{FALLBACK.title}</h1>
      <p className="text-neutral-400 text-sm mb-4 max-w-md text-center">{message || FALLBACK.fallbackMessage}</p>
      <button type="button" onClick={reset} className="px-4 py-2 rounded bg-white/20 hover:bg-white/30 text-sm">
        {FALLBACK.retry}
      </button>
    </div>
  );
}
