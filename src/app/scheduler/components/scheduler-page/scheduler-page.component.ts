import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map } from 'rxjs/operators';
import { SchedulerStateService } from '../../../services/scheduler-state.service';

@Component({
  selector: 'app-scheduler-page',
  templateUrl: './scheduler-page.component.html',
  styleUrls: ['./scheduler-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SchedulerPageComponent {
  readonly rowHeight = 54;
  readonly vm$ = this.state.state$.pipe(
    map((state) => ({
      loading: state.loading,
      updatesPaused: state.updatesPaused,
      drivers: state.drivers,
      shifts: state.shifts,
      events: state.events,
      timelineWindow: state.timelineWindow
    }))
  );

  constructor(private readonly state: SchedulerStateService) {}

  reload(): void {
    this.state.reloadData();
  }

  toggleUpdates(): void {
    this.state.toggleUpdatesPaused();
  }
}
