import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DemoReisenApi } from './demo-reisen-api';
import { Reisen } from './reisen';
import { ReisenApi } from './reisen-api.service';

describe('Reisen (Demo)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reisen],
      providers: [provideRouter([]), { provide: ReisenApi, useClass: DemoReisenApi }],
    }).compileComponents();
  });

  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function openTab(fixture: ReturnType<typeof TestBed.createComponent<Reisen>>, label: string) {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = Array.from(compiled.querySelectorAll('.tabs button')).find((b) => text(b) === label) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
  }

  it('shows the demo trip on the Übersicht with real packing/task/budget numbers', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.highlight h2'))).toBe('Berlin Wochenende');
    expect(text(compiled.querySelector('.highlight-stats'))).toContain('1/3 gepackt');
    expect(text(compiled.querySelector('.highlight-stats'))).toContain('1 offene Aufgaben');
  });

  it('lets you check off a packing item and see the progress update', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Packliste');
    let compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.card-heading .small'))).toContain('33%');
    const ladekabelCheck = Array.from(compiled.querySelectorAll('.row')).find((row) => text(row).includes('Ladekabel'))!
      .querySelector('.completion') as HTMLButtonElement;
    ladekabelCheck.click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(text(compiled.querySelector('.card-heading .small'))).toContain('67%');
  });

  it('lets you add a new packing item', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Packliste');
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#packing-title') as HTMLInputElement).value = 'Sonnencreme';
    (compiled.querySelector('#packing-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('.add-form button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = Array.from(compiled.querySelectorAll('.list .row')).map(text);
    expect(rows.some((row) => row.includes('Sonnencreme'))).toBe(true);
  });

  it('lets you add a trip task and mark it done', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Aufgaben');
    let compiled = fixture.nativeElement as HTMLElement;

    expect(Array.from(compiled.querySelectorAll('.list .row')).map(text).some((row) => row.includes('Zugtickets buchen'))).toBe(true);

    const check = Array.from(compiled.querySelectorAll('.row')).find((row) => text(row).includes('Zugtickets buchen'))!
      .querySelector('.completion') as HTMLButtonElement;
    check.click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.row__title--done')?.textContent).toContain('Zugtickets buchen');
  });

  it('shows the budget progress and lets you add an expense', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Budget');
    let compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.budget-numbers'))).toContain('90,00 €');
    expect(text(compiled.querySelector('.budget-numbers'))).toContain('350,00 €');

    (compiled.querySelector('#expense-title') as HTMLInputElement).value = 'Museum';
    (compiled.querySelector('#expense-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    (compiled.querySelector('#expense-amount') as HTMLInputElement).value = '15';
    (compiled.querySelector('#expense-amount') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('.add-form button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(text(compiled.querySelector('.budget-numbers'))).toContain('105,00 €');
  });

  it('lets you create a new trip, which then appears in Meine Reisen', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('#trip-title') as HTMLInputElement).value = 'Wanderurlaub Alpen';
    (compiled.querySelector('#trip-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const rows = Array.from(compiled.querySelectorAll('.trip-row .row__title')).map(text);
    expect(rows).toContain('Wanderurlaub Alpen');
  });
});
