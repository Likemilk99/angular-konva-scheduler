import {
  AfterViewInit,
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
import { Driver, HOLD_ROW_ID, SchedulerEvent, Shift, TimelineWindow } from '../../../models/timeline.models';
import { EventDragResult, TimelineKonvaRenderer } from '../../renderers/timeline-konva-renderer';
import { TimelineScale } from '../../utils/timeline-scale';

@Component({
  selector: 'app-timeline-canvas',
  templateUrl: './timeline-canvas.component.html',
  styleUrls: ['./timeline-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() drivers: Driver[] = [];
  @Input() events: SchedulerEvent[] = [];
  @Input() shifts: Shift[] = [];
  @Input() timelineWindow!: TimelineWindow;
  @Input() rowHeight = 54;
  @Output() eventDragged = new EventEmitter<EventDragResult>();

  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLDivElement>;

  timelineWidth = 960;
  timelineHeight = 300;
  private ctrlPressed = false;
  private initialized = false;

  private readonly renderer = new TimelineKonvaRenderer();

  constructor(private readonly zone: NgZone) {}

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
      pixelsPerMinute: 2
    });

    const width = scale.getTotalWidth() + 120;
    const height = 40 + rows.length * this.rowHeight;

    this.timelineWidth = width;
    this.timelineHeight = height;

    this.zone.runOutsideAngular(() => {
      if (!this.initialized) {
        this.renderer.initialize({
          container: this.canvasHost?.nativeElement as HTMLDivElement,
          width,
          rowHeight: this.rowHeight,
          headerHeight: 40,
          scale
        });
        this.initialized = true;
      }
      this.renderer.render({
        rowHeight: this.rowHeight,
        headerHeight: 40,
        timelineWidth: width,
        rows,
        drivers: this.drivers,
        shifts: this.shifts,
        events: this.events,
        scale,
        onDragCommit: (drag) => this.zone.run(() => this.eventDragged.emit(drag)),
        isCtrlPressed: () => this.ctrlPressed
      });
    });
  }
}
