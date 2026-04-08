import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: '<app-scheduler-page></app-scheduler-page>',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {}
