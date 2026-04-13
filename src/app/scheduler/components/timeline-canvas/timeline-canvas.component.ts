import {
  AfterViewInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { Driver, HOLD_ROW_ID, SchedulerEvent, Shift, TimelineWindow, ZoomLevel } from '../../../models/timeline.models';
import { SchedulerTimeService } from '../../../services/scheduler-time.service';
import { EventDragResult, EventHoverPayload, TimelineKonvaRenderer } from '../../renderers/timeline-konva-renderer';
import { TimelineScale } from '../../utils/timeline-scale';
import {
  computeVisibleTimeRange,
  filterTimelineItemsByViewport,
  toVisibleRowIds,
  ViewportState,
  VisibleRowRange,
  VIRTUALIZATION_OVERSCAN
} from '../../utils/viewport-virtualization';

@Component({
  selector: 'app-timeline-canvas',
  templateUrl: './timeline-canvas.component.html',
  styleUrls: ['./timeline-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  private static readonly HEADER_HEIGHT = 40;
  private static readonly TOOLTIP_WIDTH = 340;
  private static readonly TOOLTIP_HEIGHT = 220;
  private static readonly HORIZONTAL_OVERSCAN_PX = VIRTUALIZATION_OVERSCAN.horizontalPx;

  @Input() drivers: Driver[] = [];
  @Input() events: SchedulerEvent[] = [];
  @Input() shifts: Shift[] = [];
  @Input() timelineWindow!: TimelineWindow;
  @Input() zoomLevel: ZoomLevel = 60;
  @Input() timeZone = 'UTC';
  @Input() rowHeight = 54;
  @Input() viewport: ViewportState = { scrollLeft: 0, scrollTop: 0, viewportWidth: 0, viewportHeight: 0 };
  @Input() visibleRowRange: VisibleRowRange = { startIndex: 0, endIndex: -1 };
  @Output() eventDragged = new EventEmitter<EventDragResult>();

  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLDivElement>;

  timelineWidth = 960;
  timelineHeight = 300;
  visibleEventsCount = 0;
  visibleShiftsCount = 0;
  tooltipState: { visible: boolean; x: number; y: number; event?: SchedulerEvent } = {
    visible: false,
    x: 0,
    y: 0
  };

  private ctrlPressed = false;
  private initialized = false;
  private hoveredEventId?: string;
  private hoverRafId?: number;
  private pendingHoverPayload?: EventHoverPayload;
  private renderRafId?: number;
  private destroyed = false;
  private lastMeasuredWidth = 0;
  private lastMeasuredHeight = 0;

  private readonly renderer = new TimelineKonvaRenderer();

  constructor(
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly timeService: SchedulerTimeService
  ) {}

  ngAfterViewInit(): void {
    this.scheduleRender();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.scheduleRender();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.renderRafId) {
      cancelAnimationFrame(this.renderRafId);
      this.renderRafId = undefined;
    }
    if (this.hoverRafId) {
      cancelAnimationFrame(this.hoverRafId);
      this.hoverRafId = undefined;
    }
    this.renderer.destroy();
    this.initialized = false;
  }

  @HostListener('window:keydown.control')
  onCtrlDown(): void {
    this.ctrlPressed = true;
  }

  @HostListener('window:keyup.control')
  onCtrlUp(): void {
    this.ctrlPressed = false;
  }

  private scheduleRender(): void {
    if (this.renderRafId || this.destroyed) {
      return;
    }

    this.renderRafId = requestAnimationFrame(() => {
      this.renderRafId = undefined;
      this.zone.runOutsideAngular(() => this.renderFrame());
    });
  }

  private renderFrame(): void {
    if (!this.canvasHost?.nativeElement || !this.timelineWindow) {
      return;
    }

    const rows = [HOLD_ROW_ID, ...this.drivers.map((driver) => driver.id)];
    const scale = new TimelineScale({
      startMs: new Date(this.timelineWindow.startDateTime).getTime(),
      endMs: new Date(this.timelineWindow.endDateTime).getTime(),
      zoomLevel: this.zoomLevel
    });

    const width = scale.getTotalWidth();
    const height = TimelineCanvasComponent.HEADER_HEIGHT + rows.length * this.rowHeight;
    const sizeChanged = width !== this.lastMeasuredWidth || height !== this.lastMeasuredHeight;
    this.timelineWidth = width;
    this.timelineHeight = height;
    this.lastMeasuredWidth = width;
    this.lastMeasuredHeight = height;

    const visibleRowIds = toVisibleRowIds(rows, this.visibleRowRange);
    const visibleTimeRange = computeVisibleTimeRange({
      viewport: this.viewport,
      timelineWindow: this.timelineWindow,
      scale,
      overscanPx: TimelineCanvasComponent.HORIZONTAL_OVERSCAN_PX
    });

    const filteredItems = filterTimelineItemsByViewport({
      events: this.events,
      shifts: this.shifts,
      visibleRowIds,
      visibleTimeRange
    });

    if (!this.initialized) {
      this.renderer.initialize({
        container: this.canvasHost?.nativeElement as HTMLDivElement,
        width,
        rowHeight: this.rowHeight,
        headerHeight: TimelineCanvasComponent.HEADER_HEIGHT,
        scale
      });
      this.initialized = true;
    }

    this.renderer.render({
      rowHeight: this.rowHeight,
      headerHeight: TimelineCanvasComponent.HEADER_HEIGHT,
      timelineWidth: width,
      timelineHeight: height,
      rows,
      visibleRowRange: this.visibleRowRange,
      visibleTimeRange,
      shifts: filteredItems.shifts,
      events: filteredItems.events,
      rowLabels: new Map([[HOLD_ROW_ID, 'HOLD'] as [string, string], ...this.drivers.map((d) => [d.id, d.name] as [string, string])]),
      scale,
      timeZone: this.timeZone,
      formatTime: (isoDateTime) => this.timeService.formatTime(isoDateTime, this.timeZone),
      formatDate: (isoDateTime) => this.timeService.formatShortDate(isoDateTime, this.timeZone),
      onDragCommit: (drag) => this.zone.run(() => this.eventDragged.emit(drag)),
      onEventHover: (payload) => this.queueTooltipUpdate(payload),
      onEventHoverEnd: () => this.zone.run(() => this.hideTooltip()),
      isCtrlPressed: () => this.ctrlPressed
    });

    if (
      sizeChanged ||
      this.visibleEventsCount !== filteredItems.events.length ||
      this.visibleShiftsCount !== filteredItems.shifts.length
    ) {
      this.visibleEventsCount = filteredItems.events.length;
      this.visibleShiftsCount = filteredItems.shifts.length;
      this.zone.run(() => this.cdr.markForCheck());
    }
  }

  private updateTooltip(payload: EventHoverPayload): void {
    const x = this.clamp(payload.x + 14, 8, Math.max(8, this.timelineWidth - TimelineCanvasComponent.TOOLTIP_WIDTH));
    const y = this.clamp(payload.y + 14, 8, Math.max(8, this.timelineHeight - TimelineCanvasComponent.TOOLTIP_HEIGHT));
    if (this.hoveredEventId === payload.event.id && this.tooltipState.visible) {
      const deltaX = Math.abs(this.tooltipState.x - x);
      const deltaY = Math.abs(this.tooltipState.y - y);
      if (deltaX < 3 && deltaY < 3) {
        return;
      }
    }
    this.hoveredEventId = payload.event.id;
    this.tooltipState = {
      visible: true,
      x,
      y,
      event: payload.event
    };
    this.cdr.markForCheck();
  }

  private queueTooltipUpdate(payload: EventHoverPayload): void {
    this.pendingHoverPayload = payload;
    if (this.hoverRafId) {
      return;
    }

    this.hoverRafId = requestAnimationFrame(() => {
      this.hoverRafId = undefined;
      const nextPayload = this.pendingHoverPayload;
      this.pendingHoverPayload = undefined;
      if (!nextPayload) {
        return;
      }
      this.zone.run(() => this.updateTooltip(nextPayload));
    });
  }

  private hideTooltip(): void {
    if (!this.tooltipState.visible && !this.hoveredEventId) {
      return;
    }
    this.hoveredEventId = undefined;
    this.tooltipState = { visible: false, x: 0, y: 0 };
    this.cdr.markForCheck();
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
