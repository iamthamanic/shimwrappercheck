"use client";

/**
 * Catches errors in the root layout and shows a fallback instead of 500.
 * Root boundary: no NextIntlProvider, so we use static messages (default locale).
 * No dynamic imports so this boundary never throws.
 * Location: app/global-error.tsx
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const title = "Error";
  const fallback = "An unexpected error occurred.";
  const retry = "Retry";
  const message = getErrorMessage(error);
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: "2rem", fontFamily: "system-ui", background: "#0f0f0f", color: "#fff" }}>
        <h1 style={{ fontSize: "1.25rem" }}>{title}</h1>
        <p style={{ color: "#999" }}>{message || fallback}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            background: "#333",
            color: "#fff",
            border: "1px solid #666",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {retry}
        </button>
      </body>
    </html>
  );
}
