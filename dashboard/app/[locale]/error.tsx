"use client";

/**
 * Catches errors in [locale] routes and shows a fallback instead of 500.
 * Uses locale for DE/EN fallback text so the error page matches the selected language.
 * Location: app/[locale]/error.tsx
 */
import { useEffect } from "react";
import { useLocale } from "next-intl";

const FALLBACK_DE = {
  title: "Fehler",
  fallbackMessage: "Ein unerwarteter Fehler ist aufgetreten.",
  retry: "Erneut versuchen",
};
const FALLBACK_EN = {
  title: "Error",
  fallbackMessage: "An unexpected error occurred.",
  retry: "Retry",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return (error as Error).message;
  if (typeof error === "string") return error;
  return "";
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = getErrorMessage(error);
  const locale = useLocale();
  const fallback = locale === "de" ? FALLBACK_DE : FALLBACK_EN;
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 text-white bg-[#0f0f0f]">
      <h1 className="text-xl font-semibold mb-2">{fallback.title}</h1>
      <p className="text-neutral-400 text-sm mb-4 max-w-md text-center">{message || fallback.fallbackMessage}</p>
      <button type="button" onClick={reset} className="px-4 py-2 rounded bg-white/20 hover:bg-white/30 text-sm">
        {fallback.retry}
      </button>
    </div>
  );
}
