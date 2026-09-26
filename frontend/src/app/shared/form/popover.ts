/**
 * Hilfen für aufklappende Panels auf Basis des nativen Popover-API: Das Panel liegt in der „Top Layer“
 * des Browsers, wird also weder von einem Dialog noch von einem Scroll-Bereich abgeschnitten. Dort, wo das
 * API fehlt (z. B. in Testumgebungen), bleibt der Inhalt einfach im Dokument; die Bedienung ändert sich nicht.
 */
/** Zeigt das Panel erst, wenn es platziert ist: bis dahin bleibt es unsichtbar und nicht anklickbar. */
export function showPanel(panel: HTMLElement): void {
  panel.style.visibility = 'hidden';
  if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
}

export function revealPanel(panel: HTMLElement): void {
  panel.style.visibility = '';
}

export function hidePanel(panel: HTMLElement): void {
  if (typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) panel.hidePopover();
}

/**
 * Setzt das Panel unter (oder, wenn dort mehr Platz ist, über) den Auslöser, innerhalb des sichtbaren Bereichs.
 * `shrink`: darf das Panel bei wenig Platz kleiner werden und intern scrollen (Listen: ja)? Kalender und
 * Uhrzeit nicht — sie behalten ihre Größe und rücken stattdessen in den sichtbaren Bereich.
 */
export function positionPanel(trigger: HTMLElement, panel: HTMLElement, minWidth = 0, shrink = true): void {
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  panel.style.minWidth = `${Math.max(rect.width, minWidth)}px`;
  panel.style.maxHeight = '';
  const height = panel.offsetHeight;
  const width = panel.offsetWidth;
  const below = window.innerHeight - rect.bottom - margin;
  const above = rect.top - margin;
  const openAbove = height > below && above > below;
  const room = Math.max(160, (openAbove ? above : below) - 4);
  panel.style.maxHeight = shrink ? `${room}px` : 'none';
  const shownHeight = shrink ? Math.min(height, room) : height;
  const wanted = openAbove ? rect.top - shownHeight - 4 : rect.bottom + 4;
  panel.style.top = `${Math.min(Math.max(margin, wanted), Math.max(margin, window.innerHeight - shownHeight - margin))}px`;
  panel.style.left = `${Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin))}px`;
}

/**
 * Schließt das Panel, wenn außerhalb gescrollt wird (Seite, Dialog, …). Sonst bliebe es an derselben
 * Stelle im Fenster stehen, während sich das Feld wegbewegt. Scrollen IM Panel zählt nicht; in den ersten
 * 250 ms wird ignoriert, damit das Öffnen selbst (Fokus, Einblenden) es nicht sofort wieder schließt.
 * Gibt eine Funktion zurück, die den Wächter wieder entfernt.
 */
export function closeOnOutsideScroll(panel: HTMLElement, close: () => void): () => void {
  const openedAt = performance.now();
  const handler = (event: Event) => {
    if (performance.now() - openedAt < 250) return;
    const target = event.target;
    if (target instanceof Node && panel.contains(target)) return;
    close();
  };
  document.addEventListener('scroll', handler, true);
  return () => document.removeEventListener('scroll', handler, true);
}
