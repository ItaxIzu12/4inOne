/**
 * Markenidentität Lumiknot (Rebranding 28.11.2026; docs/BRAND_CONFIGURATION.md). Die EINE Stelle für Produktname, Claim,
 * Beschreibung, Bereichs-Registry, Logo-Farben und -Dateien, SEO-/PWA-Angaben und Beschriftungen. Manifest,
 * index.html und das Backend (backend/config/brand.py) werden von `npm run check:brand` dagegen geprüft.
 *
 * Farben: Die reinen Markenfarben (Logo, Teilen-Bild, Icons) stehen hier. Die Oberfläche nutzt die semantischen
 * Tokens in styles.css (`--logo-*` = dieselben Werte, `--*-accent`/`--*-fill` = kontrastgeprüfte Varianten);
 * `npm run check:brand` prüft, dass `--logo-*` und diese Datei übereinstimmen.
 *
 * Keine Importe: scripts/brand-assets.mts liest die Datei direkt mit Node (Icons, Teilen-Bild).
 */
export type BrandSection = 'finance' | 'household' | 'organization' | 'travel';
/** Stabile technische IDs aller Bereiche inklusive der Startseite. Nie lokalisiert, nie umbenannt (Speicher, Tests,
 *  CSS-Tokens hängen daran). Markennamen wie „Home“/„Planner“ sind Anzeige, keine IDs (docs/NAMING_CONVENTIONS.md). */
export type BrandContext = 'global' | BrandSection;
/** Symbole der Bereiche – Teilmenge von `IconName` (shared/ui/icons/app-icon.ts); der Typprüfer meldet Abweichungen. */
export type BrandIcon = 'home' | 'finance' | 'household' | 'calendar' | 'travel';

export interface BrandAreaInfo {
  /** Stabile technische ID (= Schlüssel in `BRAND.areas`). */
  readonly id: BrandContext;
  /** Name in der (deutschen) App. */
  readonly label: string;
  /** Name der Marke für Marketing und Markenunterlagen. */
  readonly brandName: string;
  /** Ein Satz, wofür der Bereich da ist (Navigation, Onboarding, Landing). */
  readonly description: string;
  /** Pfadsegment ohne Schrägstrich (`''` = Startseite); unter `/demo` gleich. Stabil: Links und Lesezeichen. */
  readonly route: string;
  /** Reine Markenfarbe (Logo-Element, Icons, Teilen-Bild – nicht für Text). */
  readonly logoColor: string;
  readonly icon: BrandIcon;
  /** Präfix der Design-Tokens in styles.css: `--<theme>-accent`, `-fill`, `-soft`, `--logo-<theme>`. */
  readonly theme: BrandContext;
  /** Kontext für `<app-brand [context]>`: welches Logo-Element hervorgehoben wird. */
  readonly logoContext: BrandContext;
}

/** Ein Fachbereich (alles außer der Startseite). */
export type BrandSectionInfo = BrandAreaInfo & { readonly id: BrandSection };

export interface BrandConfig {
  readonly name: string;
  /** Technische Kurzform für neue Bezeichner (Downloads, neue Variablen `LUMIKNOT_…`). docs/NAMING_CONVENTIONS.md */
  readonly slug: string;
  /** Deutscher Leitsatz in der App. */
  readonly tagline: string;
  /** Internationaler Claim. */
  readonly claim: string;
  readonly description: string;
  /** Bereichs-Registry: Startseite und die vier Fachbereiche. Reihenfolge = Reihenfolge in der Navigation. */
  readonly areas: Readonly<{ global: BrandAreaInfo } & { [K in BrandSection]: BrandSectionInfo & { readonly id: K } }>;
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
  readonly seo: {
    readonly ogImage: string;
    /** `<meta name="theme-color">`: Browserleiste über der hellen Seite. */
    readonly themeColor: string;
    /** Manifest `background_color` (Startbildschirm der installierten App). */
    readonly backgroundColor: string;
  };
  /** Installierte App (manifest.webmanifest). */
  readonly pwa: { readonly themeColor: string };
  readonly a11y: { readonly homeLink: string; readonly logo: string };
}

export const BRAND: BrandConfig = {
  name: 'Lumiknot',
  slug: 'lumiknot',
  tagline: 'Dein Alltag. Alles verbunden.',
  claim: 'Life, connected.',
  description:
    'Finanzen, Haushalt, Termine und Reisen an einem Ort. Was zusammengehört, verknüpfst du – und entscheidest selbst, was du teilst.',
  areas: {
    global: {
      id: 'global',
      label: 'Startseite',
      brandName: 'Lumiknot',
      description: 'Was heute ansteht, aus allen Bereichen.',
      route: '',
      logoColor: '#101820',
      icon: 'home',
      theme: 'global',
      logoContext: 'global',
    },
    finance: {
      id: 'finance',
      label: 'Finanzen',
      brandName: 'Lumiknot Finance',
      description: 'Budget, Ausgaben und Sparziele.',
      route: 'finanzen',
      logoColor: '#13A274',
      icon: 'finance',
      theme: 'finance',
      logoContext: 'finance',
    },
    household: {
      id: 'household',
      label: 'Haushalt',
      brandName: 'Lumiknot Home',
      description: 'Aufgaben, Einkauf, Geräte und Verträge.',
      route: 'haushalt',
      logoColor: '#F59A42',
      icon: 'household',
      theme: 'household',
      logoContext: 'household',
    },
    organization: {
      id: 'organization',
      label: 'Organisation',
      brandName: 'Lumiknot Planner',
      description: 'Termine, Aufgaben und gemeinsame Kalender.',
      route: 'organisation',
      logoColor: '#7864E7',
      icon: 'calendar',
      theme: 'organization',
      logoContext: 'organization',
    },
    travel: {
      id: 'travel',
      label: 'Reisen',
      brandName: 'Lumiknot Travel',
      description: 'Reisen planen, packen und abrechnen.',
      route: 'reisen',
      logoColor: '#2197BE',
      icon: 'travel',
      theme: 'travel',
      logoContext: 'travel',
    },
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
  seo: { ogImage: 'og-image.png', themeColor: '#F7F6F2', backgroundColor: '#F7F6F2' },
  pwa: { themeColor: '#101820' },
  a11y: { homeLink: 'Lumiknot – Startseite', logo: 'Lumiknot' },
};

/** Die vier Fachbereiche in Navigationsreihenfolge (ohne Startseite). */
export const BRAND_SECTIONS: readonly BrandSectionInfo[] = [
  BRAND.areas.finance,
  BRAND.areas.household,
  BRAND.areas.organization,
  BRAND.areas.travel,
];

/** Bereich zu einer URL (`/finanzen/…`, `/demo/reisen?…`); alles andere ist `global`. */
export function brandAreaForUrl(url: string): BrandContext {
  const segment = url.replace(/^\/demo(?=\/|$|\?)/, '').split(/[/?#]/)[1] ?? '';
  return BRAND_SECTIONS.find((area) => area.route === segment)?.id ?? 'global';
}

/** Titel der Startseite und Fallback, wenn eine Route keinen eigenen Titel hat. */
export const BRAND_DEFAULT_TITLE = `${BRAND.name} — ${BRAND.tagline}`;

/** Seitentitel im Format „Seite | Lumiknot“. */
export function brandTitle(page: string): string {
  return `${page} | ${BRAND.name}`;
}
