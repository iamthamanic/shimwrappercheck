/**
 * Process-local rate limit for POST /api/run-checks. Reduces DoS from repeated heavy runs.
 * For multi-instance or strict guarantees, use an injectable store or platform rate limiting (e.g. Vercel).
 */
import type { NextRequest } from "next/server";

const RUN_CHECKS_COOLDOWN_SEC = 15; // Mindestabstand zwischen zwei Run-Checks-Aufrufen pro Client definieren; ohne kann dieselbe IP den Endpunkt sofort wieder fluten.
const rateLimitMap = new Map<string, number>(); // Letzten Aufrufzeitpunkt pro Client-IP im Prozessspeicher merken; ohne gibt es keine Grundlage fuer die Cooldown-Pruefung.

/**
 * getClientIp: Extrahiert die bestmoegliche Client-IP aus den Request-Headern.
 * Zweck: Rate Limiting braucht einen stabilen Client-Schluessel, auch wenn der Request hinter Proxy/Vercel kommt.
 * Problem: Ohne diese Aufloesung wuerde das Limit entweder gar nicht greifen oder alle Requests unter demselben Default landen.
 * Eingabe: `request` als Next.js-Request. Ausgabe: IP-String oder `"unknown"` als Fallback.
 */
export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"; // Erst Proxy-IP, dann Real-IP, dann Fallback waehlen; ohne ist die Herkunft des Requests schlechter bestimmbar.
}

/**
 * isRunChecksRateLimited: Prueft und aktualisiert das Cooldown-Limit fuer einen Client.
 * Zweck: Teure Run-Checks-Aufrufe sollen nicht in kurzer Folge denselben Prozess ueberlasten.
 * Problem: Ohne diese Funktion kann derselbe Client wiederholt CPU- und I/O-intensive Checks anstossen.
 * Eingabe: `ip` als identifizierender Client-Schluessel. Ausgabe: `true`, wenn der Aufruf blockiert werden soll.
 */
export function isRunChecksRateLimited(ip: string): boolean {
  const now = Date.now() / 1000; // Aktuelle Zeit in Sekunden berechnen; ohne ist der Vergleich gegen den letzten Aufruf nicht moeglich.
  const last = rateLimitMap.get(ip); // Zuletzt gespeicherten Zeitpunkt fuer diese IP lesen; ohne kann kein Cooldown geprueft werden.
  if (last != null && now - last < RUN_CHECKS_COOLDOWN_SEC) return true; // Zu schnelle Wiederholung direkt blockieren; ohne kann dieselbe IP den Endpunkt spamartig aufrufen.
  rateLimitMap.set(ip, now); // Aktuellen Aufrufzeitpunkt als neue Referenz speichern; ohne greift das Limit fuer den naechsten Request nicht.
  if (rateLimitMap.size > 1000) {
    const oldest = Math.min(...rateLimitMap.values()); // Aeltesten gespeicherten Zeitstempel bestimmen; ohne kann die Map nicht kontrolliert geschrumpft werden.
    for (const [k, v] of rateLimitMap.entries()) if (v === oldest) rateLimitMap.delete(k); // Aelteste Eintraege wieder entfernen; ohne waechst die In-Memory-Map langfristig ungebremst.
  }
  return false; // Nicht-limitierte Requests explizit freigeben; ohne muessten Aufrufer auf implizites `undefined` reagieren.
}
