import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-datenschutz',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './datenschutz.html',
  styleUrl: '../../shared/legal-page/legal-page.css',
})
export class Datenschutz {}
