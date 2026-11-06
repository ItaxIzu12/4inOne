import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export interface PlaceHit {
  name: string;
  /** Straße, PLZ Ort, Land — leer, wenn der Name schon alles sagt. */
  detail: string;
  /** Lage, z. B. „Berlin Mitte“ (Stadtteil bzw. Ort). */
  area?: string;
}
/** `lodging`: nur Unterkünfte (Hotels, Pensionen, Ferienwohnungen …). */
export type PlaceKind = 'place' | 'lodging';
export interface PlaceSuggestions {
  /** Orte, die ich selbst schon eingetragen habe (verlassen 4inOne nicht). */
  own: string[];
  /** Treffer aus OpenStreetMap (Photon), über unseren Server — erst ab 3 Zeichen. */
  places: PlaceHit[];
  external_ok: boolean;
}

/** Ortsvorschläge (backend core/places.py). Nach außen geht nur der Suchtext, über den Server. */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly http = inject(HttpClient);

  /** `near`: z. B. das Reiseziel — richtet die Suche dorthin aus. */
  suggest(query: string, kind: PlaceKind = 'place', near = ''): Observable<PlaceSuggestions> {
    const params: Record<string, string> = { q: query };
    if (kind !== 'place') params['kind'] = kind;
    if (near.trim()) params['near'] = near.trim();
    return this.http.get<PlaceSuggestions>(`${API_BASE_URL}/places/`, { params });
  }
}
