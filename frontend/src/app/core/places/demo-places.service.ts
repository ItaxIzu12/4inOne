import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { PlaceHit, PlaceKind, PlaceSuggestions } from './places.service';

// Orte aus den Demo-Daten (Termine, Reisen) — wie „eigene Orte“ im Backend.
const OWN = ['Praxis Dr. Weber', 'Sporthalle Nord', 'Café Rosa', 'Büro, Raum 3.2', 'Bürgeramt', 'Lindenstraße 4', 'Grundschule', 'Berlin', 'Düsseldorf'];
// Einige Beispielorte statt eines externen Dienstes: die öffentliche Demo sendet nichts nach außen.
const SAMPLE: PlaceHit[] = [
  { name: 'Alexanderplatz', detail: '10178 Berlin, Deutschland' },
  { name: 'Brandenburger Tor', detail: 'Pariser Platz, 10117 Berlin, Deutschland' },
  { name: 'Hauptbahnhof Berlin', detail: 'Europaplatz 1, 10557 Berlin, Deutschland' },
  { name: 'Königsallee', detail: '40212 Düsseldorf, Deutschland' },
  { name: 'Düsseldorf Flughafen', detail: 'Flughafenstraße 105, 40474 Düsseldorf, Deutschland' },
  { name: 'Marienplatz', detail: '80331 München, Deutschland' },
  { name: 'Kölner Dom', detail: 'Domkloster 4, 50667 Köln, Deutschland' },
  { name: 'Rom', detail: 'Latium, Italien' },
  { name: 'Lissabon', detail: 'Portugal' },
  { name: 'Zermatt', detail: 'Wallis, Schweiz' },
];

// Unterkünfte aus den Demo-Reisen und einige Beispiel-Unterkünfte
const OWN_LODGING = ['Hotel Central', 'Ferienwohnung Limone'];
const SAMPLE_LODGING: PlaceHit[] = [
  { name: 'Hotel Central', detail: 'Friedrichstraße 1, 10117 Berlin, Deutschland', area: 'Berlin Mitte' },
  { name: 'Hotel am Alexanderplatz', detail: 'Karl-Liebknecht-Straße 3, 10178 Berlin, Deutschland', area: 'Berlin Mitte' },
  { name: 'Pension Kreuzberg', detail: 'Großbeerenstraße 64, 10963 Berlin, Deutschland', area: 'Berlin Kreuzberg' },
  { name: 'Hotel Garda', detail: 'Via Lungolago 12, Limone sul Garda, Italien', area: 'Limone sul Garda' },
  { name: 'Ferienwohnung Seeblick', detail: 'Via Nanzello 4, Limone sul Garda, Italien', area: 'Limone sul Garda' },
  { name: 'Hotel Matterhorn', detail: 'Bahnhofstrasse 9, 3920 Zermatt, Schweiz', area: 'Zermatt' },
];

@Injectable()
export class DemoPlacesService {
  suggest(query: string, kind: PlaceKind = 'place', near = ''): Observable<PlaceSuggestions> {
    const needle = query.trim().toLocaleLowerCase('de');
    if (kind === 'lodging') {
      const place = near.trim().toLocaleLowerCase('de');
      const own = OWN_LODGING.filter((o) => !needle || o.toLocaleLowerCase('de').includes(needle));
      const places = needle.length >= 3
        ? SAMPLE_LODGING.filter((p) => p.name.toLocaleLowerCase('de').includes(needle) || p.detail.toLocaleLowerCase('de').includes(needle))
            .sort((a, b) => Number(b.detail.toLocaleLowerCase('de').includes(place)) - Number(a.detail.toLocaleLowerCase('de').includes(place)))
        : [];
      return of({ own, places, external_ok: true });
    }
    const own = OWN.filter((o) => !needle || o.toLocaleLowerCase('de').includes(needle)).slice(0, 6);
    const places = needle.length >= 3
      ? SAMPLE.filter((p) => `${p.name} ${p.detail}`.toLocaleLowerCase('de').includes(needle)).slice(0, 6)
      : [];
    return of({ own, places, external_ok: true });
  }
}
