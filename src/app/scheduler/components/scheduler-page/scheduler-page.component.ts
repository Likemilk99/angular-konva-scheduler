import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { map, tap } from 'rxjs/operators';
import { Driver, SchedulerEvent, SchedulerSettings, Shift, TimelineWindow } from '../../../models/timeline.models';
import { SchedulerStateService } from '../../../services/scheduler-state.service';
import { EventDragResult } from '../../renderers/timeline-konva-renderer';
import { getTimelineZoomConfig } from '../../utils/timeline-zoom';

interface SchedulerPageVm {
  loading: boolean;
  updatesPaused: boolean;
  drivers: Driver[];
  shifts: Shift[];
  events: SchedulerEvent[];
  timelineWindow: TimelineWindow;
  settings: SchedulerSettings;
}

@Component({
  selector: 'app-scheduler-page',
  templateUrl: './scheduler-page.component.html',
  styleUrls: ['./scheduler-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SchedulerPageComponent implements AfterViewInit {
  @ViewChild('timelineScroll') timelineScroll?: ElementRef<HTMLDivElement>;

  readonly rowHeight = 54;
  private latestVm?: SchedulerPageVm;
  private pendingCenterTimeMs?: number;
  settingsOpen = false;

  readonly vm$ = this.state.state$.pipe(
    map((state) => ({
      loading: state.loading,
      updatesPaused: state.updatesPaused,
      drivers: state.drivers,
      shifts: state.shifts,
      events: state.events,
      timelineWindow: state.timelineWindow,
      settings: state.settings
    })),
    tap((vm) => {
      this.latestVm = vm;
      this.restoreCenterAfterSettings(vm);
    })
  );

  constructor(private readonly state: SchedulerStateService) {}

  ngAfterViewInit(): void {
    if (this.pendingCenterTimeMs && this.latestVm) {
      this.restoreCenterAfterSettings(this.latestVm);
    }
  }

  reload(): void {
    this.state.reloadData();
  }

  toggleUpdates(): void {
    this.state.toggleUpdatesPaused();
  }

  openSettings(): void {
    this.settingsOpen = true;
  }

  closeSettings(): void {
    this.settingsOpen = false;
  }

  applySettings(settings: SchedulerSettings): void {
    this.captureVisibleCenterTime();
    this.state.updateSettings(settings);
    this.settingsOpen = false;
  }

  private captureVisibleCenterTime(): void {
    const vm = this.latestVm;
    const container = this.timelineScroll?.nativeElement;
    if (!vm || !container) {
      return;
    }

    const startMs = new Date(vm.timelineWindow.startDateTime).getTime();
    const centerX = container.scrollLeft + container.clientWidth / 2;
    const pixelsPerMinute = getTimelineZoomConfig(vm.settings.zoomLevel).pixelsPerHour / 60;
    const centerMinutes = centerX / pixelsPerMinute;
    this.pendingCenterTimeMs = startMs + centerMinutes * 60000;
  }

  private restoreCenterAfterSettings(vm: SchedulerPageVm): void {
    if (!this.pendingCenterTimeMs) {
      return;
    }

    const container = this.timelineScroll?.nativeElement;
    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      const startMs = new Date(vm.timelineWindow.startDateTime).getTime();
      const endMs = new Date(vm.timelineWindow.endDateTime).getTime();
      const safeCenterTimeMs = Math.min(Math.max(this.pendingCenterTimeMs ?? startMs, startMs), endMs);
      const minutesFromStart = (safeCenterTimeMs - startMs) / 60000;
      const pixelsPerMinute = getTimelineZoomConfig(vm.settings.zoomLevel).pixelsPerHour / 60;
      const targetCenterX = minutesFromStart * pixelsPerMinute;
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      const targetScrollLeft = Math.min(Math.max(0, targetCenterX - container.clientWidth / 2), maxScrollLeft);
      container.scrollLeft = targetScrollLeft;
      this.pendingCenterTimeMs = undefined;
    });

  }

  handleEventDragged(drag: EventDragResult): void {
    switch (drag.mode) {
      case 'assignment':
        if (drag.rowId) {
          this.state.updateEventRow(drag.eventId, drag.rowId);
        }
        break;
      case 'time':
        if (drag.startDateTime && drag.endDateTime) {
          this.state.shiftEventTime(drag.eventId, drag.startDateTime, drag.endDateTime);
        }
        break;
    }
  }
}
