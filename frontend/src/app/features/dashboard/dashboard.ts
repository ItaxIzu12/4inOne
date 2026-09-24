import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { Modal } from '../../shared/modal/modal';
import { AuthService } from '../../core/auth/auth.service';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AppShell, AppIcon, Modal, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private auth = inject(AuthService);
  readonly name = computed(() => this.auth.currentUser()?.name || 'Sophie');
  readonly date = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  readonly detail = signal('');
  readonly packing = signal([false, false, false]);
  readonly items: {
    title: string;
    mobile: string;
    time: string;
    note: string;
    icon: IconName;
    tone: string;
  }[] = [
    {
      title: 'Yoga',
      mobile: 'Yoga',
      time: '08:00',
      note: 'Zeit für dich · 45 Minuten',
      icon: 'leaf',
      tone: 'finance',
    },
    {
      title: 'Arzttermin',
      mobile: 'Arzttermin',
      time: '10:30',
      note: 'Stadtpraxis',
      icon: 'calendar',
      tone: 'organisation',
    },
    {
      title: 'Waschmaschine starten',
      mobile: 'Wäsche waschen',
      time: '15:00',
      note: 'Haushalt',
      icon: 'household',
      tone: 'household',
    },
    {
      title: 'Familienessen',
      mobile: 'Familienessen',
      time: '19:00',
      note: 'Gemeinsam zu Hause',
      icon: 'people',
      tone: 'family',
    },
  ];
  readonly domains = computed(() => {
    const live = this.auth.isAuthenticated();
    return [
      {
        name: 'Finanzen',
        tone: 'finance',
        icon: 'finance' as IconName,
        path: live ? '/app/finanzen' : '/finanzen',
        summary: '2.340 € von 3.000 €',
      },
      {
        name: 'Haushalt',
        tone: 'household',
        icon: 'household' as IconName,
        path: live ? '/app/haushalt' : '/haushalt',
        summary: '2 offene Aufgaben',
      },
      {
        name: 'Organisation',
        tone: 'organisation',
        icon: 'calendar' as IconName,
        path: '/app/organisation',
        summary: '2 Termine heute',
      },
      {
        name: 'Reisen',
        tone: 'travel',
        icon: 'travel' as IconName,
        path: '/app/reisen',
        summary: 'Berlin Wochenende',
      },
    ];
  });
  togglePacking(index: number) {
    this.packing.update((values) => values.map((value, i) => (i === index ? !value : value)));
  }
}
