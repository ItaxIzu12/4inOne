import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/api.config';
import { SubmissionKey } from '../../shared/idempotency';
import { PrivateFinanceApi } from './private-finance-api.service';

describe('PrivateFinanceApi – idempotentes Anlegen', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));

  it('sends the same Idempotency-Key when the same transaction is submitted again, none when editing', () => {
    const api = TestBed.inject(PrivateFinanceApi);
    const http = TestBed.inject(HttpTestingController);
    const key = new SubmissionKey();
    const payload = { amount: '12.30', type: 'EXPENSE', date: '2026-10-13' };

    api.save('transactions', payload, undefined, key.for(payload)).subscribe();
    api.save('transactions', payload, undefined, key.for(payload)).subscribe(); // erneut nach Verbindungsfehler
    const [first, second] = http.match(`${API_BASE_URL}/finanzen/private/transactions/`);
    expect(first.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(second.request.headers.get('Idempotency-Key')).toBe(first.request.headers.get('Idempotency-Key'));

    api.save('transactions', payload, 7).subscribe();
    const edit = http.expectOne(`${API_BASE_URL}/finanzen/private/transactions/7/`);
    expect(edit.request.method).toBe('PATCH');
    expect(edit.request.headers.has('Idempotency-Key')).toBe(false);
  });
});
