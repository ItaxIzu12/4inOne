import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '../api.config';
import { accessLostInterceptor } from './access-lost.interceptor';
import { MembershipChanges } from './membership-changes';

describe('accessLostInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let changes: MembershipChanges;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([accessLostInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    changes = TestBed.inject(MembershipChanges);
  });

  function fail(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, status: number) {
    http.request(method, url).subscribe({ error: () => undefined });
    backend.expectOne(url).flush({ detail: 'x' }, { status, statusText: 'x' });
  }

  it('meldet 403/404 auf Änderungen in geteilten Bereichen', () => {
    fail('PATCH', `${API_BASE_URL}/reisen/packing-items/1/`, 404);
    fail('DELETE', `${API_BASE_URL}/haushalt/aufgaben/2/`, 403);
    fail('POST', `${API_BASE_URL}/household/members/3/`, 404);
    expect(changes.version()).toBe(3);
  });

  it('ignoriert Lesezugriffe, andere Fehler und private Bereiche', () => {
    fail('GET', `${API_BASE_URL}/reisen/trips/7/`, 404);
    fail('PATCH', `${API_BASE_URL}/reisen/tasks/1/`, 400);
    fail('PATCH', `${API_BASE_URL}/finanzen/private/transactions/1/`, 404);
    expect(changes.version()).toBe(0);
  });
});
