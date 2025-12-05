import {Routes} from '@angular/router';

export const homeRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('../../features/timer-display/timer-display').then(m => m.TimerDisplay)
      }
    ],
  }
];
