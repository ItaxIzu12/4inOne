import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Copyright } from '../copyright/copyright';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, Copyright],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {}
