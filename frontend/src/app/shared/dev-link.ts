/** Lokaler Bestätigungslink (nur Entwicklung): als Pfad innerhalb dieser App, nie als fremde Adresse. */
export function devLinkPath(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    return url.pathname === '/email-bestaetigen' ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}
