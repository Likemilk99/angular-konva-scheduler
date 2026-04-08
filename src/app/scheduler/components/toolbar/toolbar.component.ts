import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-scheduler-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolbarComponent {
  @Input() updatesPaused = false;
  @Input() timeZone = 'UTC';

  @Output() reload = new EventEmitter<void>();
  @Output() toggleUpdates = new EventEmitter<void>();
  @Output() openSettings = new EventEmitter<void>();
}
