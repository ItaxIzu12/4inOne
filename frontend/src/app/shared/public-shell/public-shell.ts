import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Brand } from '../brand/brand';

/**
 * Rahmen der öffentlichen Unterseiten (Rechtsseiten, Kontakt, Danke, 404) im Stil der Startseite: schlichte Kopfzeile
 * mit Marke und Anmelden/Konto erstellen, darunter der Inhalt, unten die Pflicht-Links in ausreichender Tippgröße.
 * Bewusst ohne App-Navigation: Besucher ohne Konto landeten darüber sonst nur auf der Anmeldung.
 */
@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterLink, Brand],
  templateUrl: './public-shell.html',
  styleUrl: './public-shell.scss',
})
export class PublicShell {
  readonly year = new Date().getFullYear();
}
