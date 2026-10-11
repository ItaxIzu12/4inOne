/** „vor 5 Minuten“, „vor 2 Stunden“, „vor 1 Tag“ — kurze relative Zeitangabe für Einladungen und Hinweise. */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return minutes === 1 ? 'vor 1 Minute' : `vor ${minutes} Minuten`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'vor 1 Stunde' : `vor ${hours} Stunden`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
}
