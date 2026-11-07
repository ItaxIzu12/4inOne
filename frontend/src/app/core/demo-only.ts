import { environment } from '../../environments/environment';

/** true nur im Build für GitHub Pages (environment.pages.ts): die App zeigt ausschließlich die Demo. */
export const DEMO_ONLY = environment.demoOnly;
