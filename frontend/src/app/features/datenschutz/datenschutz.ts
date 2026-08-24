import { Component } from '@angular/core';
import { LegalPage } from '../../shared/legal-page/legal-page';

@Component({
  selector: 'app-datenschutz',
  standalone: true,
  imports: [LegalPage],
  templateUrl: './datenschutz.html',
})
export class Datenschutz {}
