import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { BRAND, BRAND_DEFAULT_TITLE } from '../brand/brand.config';

export const DEFAULT_TITLE = BRAND_DEFAULT_TITLE;
export const DEFAULT_DESCRIPTION = BRAND.description;

/**
 * Setzt bei jeder Navigation Seitentitel und Meta-Beschreibung aus den Routendaten (`title`, `data.description`).
 * Seiten ohne eigene Angaben bekommen die Standardwerte, damit nie ein veralteter Titel stehen bleibt.
 */
@Injectable()
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.title.setTitle(this.buildTitle(snapshot) ?? DEFAULT_TITLE);
    let route: ActivatedRouteSnapshot = snapshot.root;
    let description: string | undefined;
    for (;;) {
      description = (route.data['description'] as string | undefined) ?? description;
      if (!route.firstChild) break;
      route = route.firstChild;
    }
    this.meta.updateTag({ name: 'description', content: description ?? DEFAULT_DESCRIPTION });
  }
}
