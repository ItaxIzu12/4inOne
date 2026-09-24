import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { OnboardingApiService } from './onboarding-api.service';
export const onboardingGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(OnboardingApiService)
    .getProfile()
    .pipe(
      map((status) => (status.needs_onboarding ? router.parseUrl('/app/onboarding') : true)),
      // The onboarding page offers retry; failures are never interpreted as an empty account.
      catchError(() => of(router.parseUrl('/app/onboarding'))),
    );
};
