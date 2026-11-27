/**
 * Markenidentität Veyora (Rebranding Phase 1, 28.11.2026; docs/BRAND.md). Die EINE Stelle für Produktname, Leitsatz,
 * Beschreibung und Seitentitel im Frontend. Farben stehen bewusst NICHT hier, sondern als Tokens in styles.css und
 * shared/styles (docs/DESIGN_SYSTEM.md) – sonst gäbe es zwei Quellen für dieselben Werte.
 *
 * Fließtexte (Landing, Rechtsseiten, Hinweise) nennen „Veyora“ direkt; `npm run check:brand` verhindert, dass der
 * alte Name dort wieder auftaucht.
 */
export type BrandSection = 'finance' | 'household' | 'organization' | 'travel';

export interface BrandConfig {
  /** Sichtbarer Produktname. */
  readonly name: string;
  /** Technische Kurzform für neue Bezeichner (Dateinamen von Downloads u. Ä.). Bestehende technische Namen bleiben,
   *  siehe docs/REBRANDING_MIGRATION.md. */
  readonly slug: string;
  /** Deutscher Leitsatz in der App. */
  readonly tagline: string;
  /** Internationaler Claim der Marke (Marketing, Markenunterlagen). */
  readonly claim: string;
  /** Standard-Beschreibung für Suchmaschinen und Teilen-Vorschau. */
  readonly description: string;
  /** Sichtbare Namen der vier Bereiche in der (deutschen) App. */
  readonly sections: Readonly<Record<BrandSection, string>>;
  /** Barrierefreie Beschriftungen rund um die Marke. */
  readonly a11y: { readonly homeLink: string; readonly logo: string };
}

export const BRAND: BrandConfig = {
  name: 'Veyora',
  slug: 'veyora',
  tagline: 'Dein Alltag. Alles verbunden.',
  claim: 'Life, connected.',
  description:
    'Finanzen, Haushalt, Termine und Reisen an einem Ort. Was zusammengehört, verknüpfst du – und entscheidest selbst, was du teilst.',
  sections: { finance: 'Finanzen', household: 'Haushalt', organization: 'Organisation', travel: 'Reisen' },
  a11y: { homeLink: 'Veyora – Startseite', logo: 'Veyora' },
};

/** Titel der Startseite und Fallback, wenn eine Route keinen eigenen Titel hat. */
export const BRAND_DEFAULT_TITLE = `${BRAND.name} — ${BRAND.tagline}`;

/** Seitentitel im Format „Seite | Veyora“. */
export function brandTitle(page: string): string {
  return `${page} | ${BRAND.name}`;
}
