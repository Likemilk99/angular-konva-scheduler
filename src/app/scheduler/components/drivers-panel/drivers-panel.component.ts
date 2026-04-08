import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Driver, HOLD_ROW_ID } from '../../../models/timeline.models';

@Component({
  selector: 'app-drivers-panel',
  templateUrl: './drivers-panel.component.html',
  styleUrls: ['./drivers-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DriversPanelComponent {
  @Input() drivers: Driver[] = [];
  @Input() rowHeight = 54;
  readonly holdRowId = HOLD_ROW_ID;
}
