import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { map, tap } from 'rxjs/operators';
import { Driver, SchedulerEvent, Shift, TimelineWindow, ZoomLevel } from '../../../models/timeline.models';
import { SchedulerStateService } from '../../../services/scheduler-state.service';
import { EventDragResult } from '../../renderers/timeline-konva-renderer';
import { getTimelineZoomConfig, getZoomInLevel, getZoomOutLevel } from '../../utils/timeline-zoom';

interface SchedulerPageVm {
  loading: boolean;
  updatesPaused: boolean;
  drivers: Driver[];
  shifts: Shift[];
  events: SchedulerEvent[];
  timelineWindow: TimelineWindow;
  zoomLevel: ZoomLevel;
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

  readonly vm$ = this.state.state$.pipe(
    map((state) => ({
      loading: state.loading,
      updatesPaused: state.updatesPaused,
      drivers: state.drivers,
      shifts: state.shifts,
      events: state.events,
      timelineWindow: state.timelineWindow,
      zoomLevel: state.zoomLevel
    })),
    tap((vm) => {
      this.latestVm = vm;
      this.restoreCenterAfterZoom(vm);
    })
  );

  constructor(private readonly state: SchedulerStateService) {}

  ngAfterViewInit(): void {
    if (this.pendingCenterTimeMs && this.latestVm) {
      this.restoreCenterAfterZoom(this.latestVm);
    }
  }

  reload(): void {
    this.state.reloadData();
  }

  toggleUpdates(): void {
    this.state.toggleUpdatesPaused();
  }

  zoomIn(): void {
    if (!this.latestVm || !getZoomInLevel(this.latestVm.zoomLevel)) {
      return;
    }
    this.captureVisibleCenterTime();
    this.state.zoomIn();
  }

  zoomOut(): void {
    if (!this.latestVm || !getZoomOutLevel(this.latestVm.zoomLevel)) {
      return;
    }
    this.captureVisibleCenterTime();
    this.state.zoomOut();
  }

  private captureVisibleCenterTime(): void {
    const vm = this.latestVm;
    const container = this.timelineScroll?.nativeElement;
    if (!vm || !container) {
      return;
    }

    const startMs = new Date(vm.timelineWindow.startDateTime).getTime();
    const centerX = container.scrollLeft + container.clientWidth / 2;
    const pixelsPerMinute = getTimelineZoomConfig(vm.zoomLevel).pixelsPerHour / 60;
    const centerMinutes = centerX / pixelsPerMinute;
    this.pendingCenterTimeMs = startMs + centerMinutes * 60000;
  }

  private restoreCenterAfterZoom(vm: SchedulerPageVm): void {
    if (!this.pendingCenterTimeMs) {
      return;
    }

    const container = this.timelineScroll?.nativeElement;
    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const startMs = new Date(vm.timelineWindow.startDateTime).getTime();
        const endMs = new Date(vm.timelineWindow.endDateTime).getTime();
        const safeCenterTimeMs = Math.min(Math.max(this.pendingCenterTimeMs ?? startMs, startMs), endMs);
        const minutesFromStart = (safeCenterTimeMs - startMs) / 60000;
        const pixelsPerMinute = getTimelineZoomConfig(vm.zoomLevel).pixelsPerHour / 60;
        const targetCenterX = minutesFromStart * pixelsPerMinute;
        const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
        const targetScrollLeft = Math.min(Math.max(0, targetCenterX - container.clientWidth / 2), maxScrollLeft);
        container.scrollLeft = targetScrollLeft;
        this.pendingCenterTimeMs = undefined;
      });
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
