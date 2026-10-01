import { InjectionToken } from '@angular/core';
/** Route-scoped demo identity; authentication does not select the data source. */
export const DEMO_MODE = new InjectionToken<boolean>('DEMO_MODE', {
  providedIn: 'root',
  factory: () => false,
});
