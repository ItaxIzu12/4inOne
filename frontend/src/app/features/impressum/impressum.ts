import { Component } from '@angular/core';
import { LegalPage } from '../../shared/legal-page/legal-page';

@Component({
  selector: 'app-impressum',
  standalone: true,
  imports: [LegalPage],
  templateUrl: './impressum.html',
})
export class Impressum {}
