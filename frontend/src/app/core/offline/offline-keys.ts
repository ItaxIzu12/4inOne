/**
 * Offline-Einkaufsliste (22.11.2026): Schlüssel im Browser-Speicher dieses Geräts. Die Liste liegt dort nur, damit
 * sie im Laden ohne Netz lesbar und abhakbar bleibt; beim Abmelden (auch wenn die Sitzung abläuft) wird alles gelöscht
 * (AuthService.forceLogout → clearOfflineData).
 */
export const OFFLINE_SNAPSHOT_KEY = '4io-offline-einkauf';
export const OFFLINE_QUEUE_KEY = '4io-offline-einkauf-warteschlange';

export function clearOfflineData(): void {
  try {
    localStorage.removeItem(OFFLINE_SNAPSHOT_KEY);
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    /* Speicher gesperrt (privates Fenster) – dann gab es auch nichts zu löschen */
  }
}

/** Kam eine Anfrage wegen fehlenden Netzes nicht an (statt einer Antwort des Servers)? */
export function isNetworkError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false);
}
