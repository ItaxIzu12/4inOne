/**
 * Markenidentität Lumiknot (Rebranding 28.11.2026; docs/BRAND_GUIDELINES.md). Die EINE Stelle für Produktname, Claim,
 * Beschreibung, Bereiche, Logo-Farben und -Dateien, SEO-Angaben und Beschriftungen im Frontend.
 *
 * Farben: Die reinen Markenfarben (Logo, Teilen-Bild, Icons) stehen hier. Die Oberfläche nutzt die semantischen
 * Tokens in styles.css (`--logo-*` = dieselben Werte, `--*-accent`/`--*-fill` = kontrastgeprüfte Varianten);
 * `npm run check:brand` prüft, dass `--logo-*` und diese Datei übereinstimmen.
 *
 * Keine Importe: scripts/brand-assets.mts liest die Datei direkt mit Node (Icons, Teilen-Bild).
 */
export type BrandSection = 'finance' | 'household' | 'organization' | 'travel';
export type BrandContext = 'global' | BrandSection;

export interface BrandSectionInfo {
  /** Name in der (deutschen) App. */
  readonly label: string;
  /** Name der Marke für Marketing und Markenunterlagen. */
  readonly brandName: string;
  /** Reine Markenfarbe (Logo-Element, nicht für Text). */
  readonly logoColor: string;
}

export interface BrandConfig {
  readonly name: string;
  /** Technische Kurzform für neue Bezeichner (Downloads, neue Variablen `LUMIKNOT_…`). docs/NAMING_CONVENTIONS.md */
  readonly slug: string;
  /** Deutscher Leitsatz in der App. */
  readonly tagline: string;
  /** Internationaler Claim. */
  readonly claim: string;
  readonly description: string;
  readonly sections: Readonly<Record<BrandSection, BrandSectionInfo>>;
  /** Neutrale Markenfarben. */
  readonly neutrals: { readonly midnight: string; readonly graphite: string; readonly ivory: string; readonly white: string };
  readonly fonts: { readonly brand: string; readonly ui: string };
  readonly logo: {
    readonly symbol: string;
    readonly symbolMonoDark: string;
    readonly symbolMonoLight: string;
    readonly lockupHorizontal: string;
    readonly lockupVertical: string;
    readonly wordmark: string;
    readonly favicon: string;
    readonly appIcon: string;
    readonly maskableIcon: string;
  };
  readonly seo: { readonly ogImage: string; readonly themeColor: string; readonly backgroundColor: string };
  readonly a11y: { readonly homeLink: string; readonly logo: string };
}

export const BRAND: BrandConfig = {
  name: 'Lumiknot',
  slug: 'lumiknot',
  tagline: 'Dein Alltag. Alles verbunden.',
  claim: 'Life, connected.',
  description:
    'Finanzen, Haushalt, Termine und Reisen an einem Ort. Was zusammengehört, verknüpfst du – und entscheidest selbst, was du teilst.',
  sections: {
    finance: { label: 'Finanzen', brandName: 'Lumiknot Finance', logoColor: '#13A274' },
    household: { label: 'Haushalt', brandName: 'Lumiknot Home', logoColor: '#F59A42' },
    organization: { label: 'Organisation', brandName: 'Lumiknot Planner', logoColor: '#7864E7' },
    travel: { label: 'Reisen', brandName: 'Lumiknot Travel', logoColor: '#2197BE' },
  },
  neutrals: { midnight: '#101820', graphite: '#29323B', ivory: '#F7F6F2', white: '#FFFFFF' },
  fonts: { brand: 'Manrope', ui: 'Inter' },
  logo: {
    symbol: 'brand/lumiknot-symbol.svg',
    symbolMonoDark: 'brand/lumiknot-symbol-mono-dark.svg',
    symbolMonoLight: 'brand/lumiknot-symbol-mono-light.svg',
    lockupHorizontal: 'brand/lumiknot-lockup-horizontal.svg',
    lockupVertical: 'brand/lumiknot-lockup-vertical.svg',
    wordmark: 'brand/lumiknot-wordmark.svg',
    favicon: 'favicon.svg',
    appIcon: 'icon-512.png',
    maskableIcon: 'icon-maskable-512.png',
  },
  seo: { ogImage: 'og-image.png', themeColor: '#101820', backgroundColor: '#F7F6F2' },
  a11y: { homeLink: 'Lumiknot – Startseite', logo: 'Lumiknot' },
};

/** Titel der Startseite und Fallback, wenn eine Route keinen eigenen Titel hat. */
export const BRAND_DEFAULT_TITLE = `${BRAND.name} — ${BRAND.tagline}`;

/** Seitentitel im Format „Seite | Lumiknot“. */
export function brandTitle(page: string): string {
  return `${page} | ${BRAND.name}`;
}
