import { TestBed } from '@angular/core/testing';
import { Trip } from '../data/travel-api.service';
import { TripPass } from './trip-pass';

const trip = (extra: Partial<Trip> = {}): Trip => ({
  id: 1, title: 'Lissabon', destination: 'Lissabon, Portugal', departure: '', start_date: '2099-03-14', end_date: '2099-03-16', notes: '',
  status: 'PLANNED', travel_type: '', transport_type: '', baggage: [], climate: '', budget_amount: null, currency: 'EUR', accommodation: '',
  accommodation_area: '', transport_note: '', created_at: '', updated_at: '2026-01-01', packing_total: 0, packing_packed: 0,
  tasks_open: 3, tasks_total: 4, events_count: 0, budget_spent: '0.00', participants: [], my_role: 'OWNER', ...extra,
});

describe('TripPass – dringend (R1)', () => {
  function chips(inputs: Record<string, unknown>) {
    const f = TestBed.createComponent(TripPass);
    f.componentRef.setInput('trip', trip());
    f.componentRef.setInput('mode', 'detail');
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return Array.from(f.nativeElement.querySelectorAll('.pass__chip') as NodeListOf<HTMLElement>).map((c) => ({
      text: c.textContent!.trim(),
      strong: c.classList.contains('is-strong'),
    }));
  }

  it('hebt dringende Aufgaben als eigene, betonte Marke vor den offenen hervor', () => {
    expect(chips({ tasksUrgent: 2 }).slice(0, 2)).toEqual([
      { text: '2 Aufgaben dringend', strong: true },
      { text: '3 Aufgaben offen', strong: false },
    ]);
    expect(chips({ tasksUrgent: 1 })[0].text).toBe('1 Aufgabe dringend');
  });

  it('zeigt ohne dringende Aufgaben keine Marke', () => {
    expect(chips({ tasksUrgent: 0 }).map((c) => c.text)).toEqual(['3 Aufgaben offen']);
  });
});
