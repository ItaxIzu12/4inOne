import { Component } from '@angular/core';
import { LegalPage } from '../../shared/legal-page/legal-page';

@Component({
  selector: 'app-nutzungsbedingungen',
  standalone: true,
  imports: [LegalPage],
  templateUrl: './nutzungsbedingungen.html',
})
export class Nutzungsbedingungen {}
