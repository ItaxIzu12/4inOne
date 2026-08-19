import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { BackToTop } from './shared/back-to-top/back-to-top';
import { BottomNav } from './shared/bottom-nav/bottom-nav';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, BackToTop, BottomNav],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
