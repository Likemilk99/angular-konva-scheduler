import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Driver, HOLD_ROW_ID } from '../../../models/timeline.models';

interface DriverPanelRow {
  id: string;
  name: string;
  meta: string;
  hold?: boolean;
}

@Component({
  selector: 'app-drivers-panel',
  templateUrl: './drivers-panel.component.html',
  styleUrls: ['./drivers-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DriversPanelComponent {
  @Input() drivers: Driver[] = [];
  @Input() rowHeight = 54;
  @Input() visibleStartIndex = 0;
  @Input() visibleEndIndex = 0;

  readonly holdRowId = HOLD_ROW_ID;

  get rows(): DriverPanelRow[] {
    return [
      { id: HOLD_ROW_ID, name: 'HOLD', meta: 'Unassigned tasks', hold: true },
      ...this.drivers.map((driver) => ({
        id: driver.id,
        name: driver.name,
        meta: `Score ${driver.score ?? 0} • Trips ${driver.activeTrips ?? 0}`
      }))
    ];
  }

  get topSpacerHeight(): number {
    return Math.max(0, this.visibleStartIndex * this.rowHeight);
  }

  get bottomSpacerHeight(): number {
    const hiddenRows = Math.max(0, this.rows.length - this.visibleEndIndex - 1);
    return hiddenRows * this.rowHeight;
  }

  get visibleRows(): DriverPanelRow[] {
    if (!this.rows.length || this.visibleEndIndex < this.visibleStartIndex) {
      return [];
    }
    return this.rows.slice(this.visibleStartIndex, this.visibleEndIndex + 1);
  }
}
