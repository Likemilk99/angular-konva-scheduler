import Konva from 'konva';
import { Driver, EventVisualModel, HOLD_ROW_ID, SchedulerEvent, Shift } from '../../models/timeline.models';
import { TimelineScale } from '../utils/timeline-scale';

export interface RenderContext {
  container: HTMLDivElement;
  width: number;
  rowHeight: number;
  headerHeight: number;
  scale: TimelineScale;
}

export class TimelineKonvaRenderer {
  private stage?: Konva.Stage;
  private gridLayer?: Konva.Layer;
  private shiftLayer?: Konva.Layer;
  private eventLayer?: Konva.Layer;

  initialize(ctx: RenderContext): void {
    this.destroy();
    this.stage = new Konva.Stage({
      container: ctx.container,
      width: ctx.width,
      height: ctx.headerHeight + ctx.rowHeight
    });
    this.gridLayer = new Konva.Layer();
    this.shiftLayer = new Konva.Layer();
    this.eventLayer = new Konva.Layer();
    this.stage.add(this.gridLayer);
    this.stage.add(this.shiftLayer);
    this.stage.add(this.eventLayer);
  }

  setSize(width: number, height: number): void {
    if (!this.stage) {
      return;
    }
    this.stage.width(width);
    this.stage.height(height);
  }

  render(args: {
    rowHeight: number;
    headerHeight: number;
    timelineWidth: number;
    rows: string[];
    drivers: Driver[];
    shifts: Shift[];
    events: SchedulerEvent[];
    scale: TimelineScale;
  }): void {
    if (!this.stage || !this.gridLayer || !this.shiftLayer || !this.eventLayer) {
      return;
    }

    const totalHeight = args.headerHeight + args.rows.length * args.rowHeight;
    this.setSize(args.timelineWidth, totalHeight);

    this.gridLayer.destroyChildren();
    this.shiftLayer.destroyChildren();
    this.eventLayer.destroyChildren();

    this.drawGrid(args.rows, args.rowHeight, args.headerHeight, args.timelineWidth);
    this.drawTimelineTicks(args.scale, args.headerHeight, args.timelineWidth);
    this.drawShifts(args, args.rowHeight, args.headerHeight);
    this.drawEvents(args, args.rowHeight, args.headerHeight);

    this.gridLayer.draw();
    this.shiftLayer.draw();
    this.eventLayer.draw();
  }

  destroy(): void {
    this.stage?.destroy();
    this.stage = undefined;
  }

  private drawGrid(rows: string[], rowHeight: number, headerHeight: number, width: number): void {
    if (!this.gridLayer) {
      return;
    }

    this.gridLayer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height: headerHeight,
        fill: '#ffffff'
      })
    );

    rows.forEach((rowId, index) => {
      const y = headerHeight + index * rowHeight;
      const isHold = rowId === HOLD_ROW_ID;
      this.gridLayer?.add(
        new Konva.Rect({
          x: 0,
          y,
          width,
          height: rowHeight,
          fill: isHold ? '#fef3c7' : index % 2 === 0 ? '#f8fafc' : '#ffffff'
        })
      );

      this.gridLayer?.add(
        new Konva.Line({
          points: [0, y, width, y],
          stroke: '#e2e8f0',
          strokeWidth: 1
        })
      );
    });
  }

  private drawTimelineTicks(scale: TimelineScale, headerHeight: number, width: number): void {
    if (!this.gridLayer) {
      return;
    }

    const tickIntervalMinutes = scale.getTickIntervalMinutes();
    const totalMinutes = scale.getTotalMinutes();
    const totalTicks = Math.ceil(totalMinutes / tickIntervalMinutes);

    for (let i = 0; i <= totalTicks; i += 1) {
      const x = (i * tickIntervalMinutes * scale.getPixelsPerHour()) / 60;
      this.gridLayer.add(
        new Konva.Line({
          points: [x, 0, x, this.stage?.height() ?? 0],
          stroke: '#e2e8f0',
          strokeWidth: 1,
          dash: [2, 2]
        })
      );
      const labelDate = new Date(scale.xToTime(x));
      this.gridLayer.add(
        new Konva.Text({
          x: x + 4,
          y: 4,
          text: labelDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          fontSize: 11,
          fill: '#475569'
        })
      );
    }

    this.gridLayer.add(
      new Konva.Line({
        points: [0, headerHeight, width, headerHeight],
        stroke: '#cbd5e1',
        strokeWidth: 1
      })
    );
  }

  private drawShifts(
    args: { rows: string[]; shifts: Shift[]; scale: TimelineScale },
    rowHeight: number,
    headerHeight: number
  ): void {
    const rowIndexMap = new Map(args.rows.map((rowId, index) => [rowId, index]));
    args.shifts.forEach((shift) => {
      const rowIndex = rowIndexMap.get(shift.driverId);
      if (rowIndex === undefined) {
        return;
      }
      const x = args.scale.datetimeToX(shift.startDateTime);
      const width = Math.max(8, args.scale.durationToWidth(shift.startDateTime, shift.endDateTime));
      const y = headerHeight + rowIndex * rowHeight + 6;
      this.shiftLayer?.add(
        new Konva.Rect({
          x,
          y,
          width,
          height: rowHeight - 12,
          fill: '#dbeafe',
          opacity: 0.6,
          cornerRadius: 6
        })
      );
    });
  }

  private drawEvents(
    args: { rows: string[]; events: SchedulerEvent[]; scale: TimelineScale },
    rowHeight: number,
    headerHeight: number
  ): void {
    const rowIndexMap = new Map(args.rows.map((rowId, index) => [rowId, index]));
    args.events.forEach((event) => {
      const rowIndex = rowIndexMap.get(event.rowId);
      if (rowIndex === undefined) {
        return;
      }
      const model = this.toVisualModel(event, rowIndex, rowHeight, headerHeight, args.scale);
      this.eventLayer?.add(this.createEventGroup(model));
    });
  }

  private toVisualModel(
    event: SchedulerEvent,
    rowIndex: number,
    rowHeight: number,
    headerHeight: number,
    scale: TimelineScale
  ): EventVisualModel {
    const x = scale.datetimeToX(event.startDateTime);
    const width = Math.max(24, scale.durationToWidth(event.startDateTime, event.endDateTime));
    const y = headerHeight + rowIndex * rowHeight + 9;
    const height = rowHeight - 18;
    const compactLevel = width < 60 ? 'tiny' : width < 140 ? 'compact' : 'full';
    const linesConfig = event.presentation?.lines ?? [{ key: 'flightNumber' }, { key: 'route' }, { key: 'taskCode' }];
    const lines = linesConfig
      .map((line) => {
        const raw = event.payload[line.key];
        return raw === undefined ? '' : `${line.label ? `${line.label}: ` : ''}${raw}`;
      })
      .filter(Boolean)
      .slice(0, compactLevel === 'tiny' ? 1 : compactLevel === 'compact' ? 2 : 3);

    return {
      id: event.id,
      rowId: event.rowId,
      x,
      y,
      width,
      height,
      borderColor: event.presentation?.borderColor ?? '#2563eb',
      backgroundColor: event.presentation?.backgroundColor ?? '#eff6ff',
      accentColor: event.presentation?.accentColor ?? '#1d4ed8',
      compactLevel,
      lines,
      status: event.status
    };
  }

  private createEventGroup(model: EventVisualModel): Konva.Group {
    const group = new Konva.Group({ x: model.x, y: model.y });
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: model.width,
        height: model.height,
        fill: model.backgroundColor,
        stroke: model.borderColor,
        strokeWidth: 1,
        cornerRadius: 5
      })
    );

    group.add(
      new Konva.Line({
        points: [model.width, 8, model.width + 8, model.height / 2, model.width, model.height - 8],
        fill: model.accentColor,
        closed: true,
        stroke: model.accentColor,
        strokeWidth: 1
      })
    );

    model.lines.forEach((line, index) => {
      group.add(
        new Konva.Text({
          x: 8,
          y: 5 + index * 14,
          width: model.width - 12,
          text: line,
          fontSize: 11,
          fill: '#0f172a',
          ellipsis: true
        })
      );
    });
    return group;
  }
}
