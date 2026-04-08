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
import { EventDragResult, EventHoverPayload, TimelineKonvaRenderer } from '../../renderers/timeline-konva-renderer';
import { TimelineScale } from '../../utils/timeline-scale';

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
  private static readonly PIXELS_PER_MINUTE = 2;

  @Input() drivers: Driver[] = [];
  @Input() events: SchedulerEvent[] = [];
  @Input() shifts: Shift[] = [];
  @Input() timelineWindow!: TimelineWindow;
  @Input() zoomLevel: ZoomLevel = 60;
  @Input() rowHeight = 54;
  @Output() eventDragged = new EventEmitter<EventDragResult>();

  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLDivElement>;

  timelineWidth = 960;
  timelineHeight = 300;
  tooltipState: { visible: boolean; x: number; y: number; event?: SchedulerEvent } = {
    visible: false,
    x: 0,
    y: 0
  };
  private ctrlPressed = false;
  private initialized = false;
  private hoveredEventId?: string;

  private readonly renderer = new TimelineKonvaRenderer();

  constructor(
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.render();
  }

  ngOnDestroy(): void {
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

  private render(): void {
    if (!this.canvasHost?.nativeElement || !this.timelineWindow) {
      return;
    }

    const rows = [HOLD_ROW_ID, ...this.drivers.map((driver) => driver.id)];
    const scale = new TimelineScale({
      startMs: new Date(this.timelineWindow.startDateTime).getTime(),
      endMs: new Date(this.timelineWindow.endDateTime).getTime(),
      pixelsPerMinute: TimelineCanvasComponent.PIXELS_PER_MINUTE,
      zoomLevel: this.zoomLevel
    });

    const width = scale.getTotalWidth();
    const height = TimelineCanvasComponent.HEADER_HEIGHT + rows.length * this.rowHeight;

    this.timelineWidth = width;
    this.timelineHeight = height;

    this.zone.runOutsideAngular(() => {
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
        rows,
        drivers: this.drivers,
        shifts: this.shifts,
        events: this.events,
        scale,
        onDragCommit: (drag) => this.zone.run(() => this.eventDragged.emit(drag)),
        onEventHover: (payload) => this.zone.run(() => this.updateTooltip(payload)),
        onEventHoverEnd: () => this.zone.run(() => this.hideTooltip()),
        isCtrlPressed: () => this.ctrlPressed
      });
    });
  }

  private updateTooltip(payload: EventHoverPayload): void {
    const x = this.clamp(payload.x + 14, 8, Math.max(8, this.timelineWidth - TimelineCanvasComponent.TOOLTIP_WIDTH));
    const y = this.clamp(payload.y + 14, 8, Math.max(8, this.timelineHeight - TimelineCanvasComponent.TOOLTIP_HEIGHT));
    this.hoveredEventId = payload.event.id;
    this.tooltipState = {
      visible: true,
      x,
      y,
      event: payload.event
    };
    this.cdr.markForCheck();
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
