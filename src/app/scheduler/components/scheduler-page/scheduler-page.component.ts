import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { map, tap } from 'rxjs/operators';
import { Driver, SchedulerEvent, SchedulerSettings, Shift, TimelineWindow } from '../../../models/timeline.models';
import { SchedulerStateService } from '../../../services/scheduler-state.service';
import { EventDragResult } from '../../renderers/timeline-konva-renderer';
import { getTimelineZoomConfig } from '../../utils/timeline-zoom';
import {
  computeVisibleRowRange,
  ViewportState,
  VisibleRowRange,
  VIRTUALIZATION_OVERSCAN
} from '../../utils/viewport-virtualization';

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
export class SchedulerPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('timelineScroll') timelineScroll?: ElementRef<HTMLDivElement>;
  @ViewChild('boardScroll') boardScroll?: ElementRef<HTMLDivElement>;

  readonly rowHeight = 54;
  readonly headerHeight = 40;
  readonly verticalOverscanRows = VIRTUALIZATION_OVERSCAN.verticalRows;

  viewport: ViewportState = { scrollLeft: 0, scrollTop: 0, viewportWidth: 0, viewportHeight: 0 };
  visibleRowRange: VisibleRowRange = { startIndex: 0, endIndex: 0 };

  private latestVm?: SchedulerPageVm;
  private pendingCenterTimeMs?: number;
  private rafHandle?: number;

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
      this.recomputeViewport(vm.drivers.length + 1);
    })
  );

  constructor(private readonly state: SchedulerStateService, private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (this.pendingCenterTimeMs && this.latestVm) {
      this.restoreCenterAfterSettings(this.latestVm);
    }
    this.recomputeViewport((this.latestVm?.drivers.length ?? 0) + 1);
  }

  ngOnDestroy(): void {
    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
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

  onScroll(): void {
    if (this.rafHandle) {
      return;
    }

    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = undefined;
      this.recomputeViewport((this.latestVm?.drivers.length ?? 0) + 1);
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.recomputeViewport((this.latestVm?.drivers.length ?? 0) + 1);
  }

  private recomputeViewport(rowCount: number): void {
    const board = this.boardScroll?.nativeElement;
    const timeline = this.timelineScroll?.nativeElement;
    if (!board || !timeline) {
      return;
    }

    this.viewport = {
      scrollLeft: timeline.scrollLeft,
      scrollTop: board.scrollTop,
      viewportWidth: timeline.clientWidth,
      viewportHeight: board.clientHeight
    };

    this.visibleRowRange = computeVisibleRowRange({
      viewport: this.viewport,
      rowHeight: this.rowHeight,
      rowCount,
      headerHeight: this.headerHeight,
      overscanRows: this.verticalOverscanRows
    });

    this.cdr.markForCheck();
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
      this.recomputeViewport(vm.drivers.length + 1);
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
