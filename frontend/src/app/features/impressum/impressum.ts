import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-impressum',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './impressum.html',
  styleUrl: '../../shared/legal-page/legal-page.css',
})
export class Impressum {}
