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

export interface EventDragResult {
  eventId: string;
  mode: 'assignment' | 'time';
  rowId?: string;
  startDateTime?: string;
  endDateTime?: string;
}

export interface EventHoverPayload {
  event: SchedulerEvent;
  x: number;
  y: number;
}

interface DragState {
  eventId: string;
  mode: 'assignment' | 'time';
  originalX: number;
  originalY: number;
  originalRowId: string;
  durationMs: number;
}

interface RowDropTarget {
  rowId: string;
  minY: number;
  maxY: number;
}

interface RendererEventNode {
  event: SchedulerEvent;
  model: EventVisualModel;
  group: Konva.Group;
}

export class TimelineKonvaRenderer {
  private stage?: Konva.Stage;
  private gridLayer?: Konva.Layer;
  private shiftLayer?: Konva.Layer;
  private eventLayer?: Konva.Layer;

  private rowBackgroundRects = new Map<string, Konva.Rect>();
  private rowIndexMap = new Map<string, number>();
  private rowDropTargets: RowDropTarget[] = [];
  private eventNodes = new Map<string, RendererEventNode>();
  private rowLabelMap = new Map<string, string>();

  private rows: string[] = [];
  private rowHeight = 0;
  private headerHeight = 0;
  private timelineWidth = 0;
  private scale?: TimelineScale;
  private currentDrag?: DragState;
  private onDragCommit?: (result: EventDragResult) => void;
  private onEventHover?: (payload: EventHoverPayload) => void;
  private onEventHoverEnd?: () => void;
  private isCtrlPressed?: () => boolean;
  private initializedContainer?: HTMLDivElement;
  private lastGridSignature = '';
  private dragPreview?: Konva.Group;

  initialize(ctx: RenderContext): void {
    if (this.stage && this.initializedContainer === ctx.container) {
      return;
    }

    this.destroy();
    this.initializedContainer = ctx.container;
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
    onDragCommit: (result: EventDragResult) => void;
    onEventHover: (payload: EventHoverPayload) => void;
    onEventHoverEnd: () => void;
    isCtrlPressed: () => boolean;
  }): void {
    if (!this.stage || !this.gridLayer || !this.shiftLayer || !this.eventLayer) {
      return;
    }

    this.rows = args.rows;
    this.rowHeight = args.rowHeight;
    this.headerHeight = args.headerHeight;
    this.timelineWidth = args.timelineWidth;
    this.scale = args.scale;
    this.onDragCommit = args.onDragCommit;
    this.onEventHover = args.onEventHover;
    this.onEventHoverEnd = args.onEventHoverEnd;
    this.isCtrlPressed = args.isCtrlPressed;
    this.rowIndexMap = new Map(args.rows.map((rowId, index) => [rowId, index]));
    this.rowLabelMap = new Map<string, string>([
      [HOLD_ROW_ID, 'HOLD'],
      ...args.drivers.map((driver) => [driver.id, driver.name] as [string, string])
    ]);
    this.rowDropTargets = this.buildRowDropTargets(args.rows, args.rowHeight, args.headerHeight);

    const totalHeight = args.headerHeight + args.rows.length * args.rowHeight;
    this.setSize(args.timelineWidth, totalHeight);

    const gridSignature = this.createGridSignature(args);
    if (gridSignature !== this.lastGridSignature) {
      this.lastGridSignature = gridSignature;
      this.renderGridAndShifts(args);
    }

    this.reconcileEvents(args.events, args.rowHeight, args.headerHeight, args.scale);
  }

  destroy(): void {
    this.stage?.destroy();
    this.stage = undefined;
    this.gridLayer = undefined;
    this.shiftLayer = undefined;
    this.eventLayer = undefined;
    this.rowBackgroundRects.clear();
    this.eventNodes.clear();
    this.initializedContainer = undefined;
    this.lastGridSignature = '';
    this.dragPreview?.destroy();
    this.dragPreview = undefined;
  }

  private renderGridAndShifts(args: {
    rowHeight: number;
    headerHeight: number;
    timelineWidth: number;
    rows: string[];
    shifts: Shift[];
    scale: TimelineScale;
  }): void {
    if (!this.gridLayer || !this.shiftLayer) {
      return;
    }

    this.gridLayer.destroyChildren();
    this.shiftLayer.destroyChildren();
    this.rowBackgroundRects.clear();

    this.drawGrid(args.rows, args.rowHeight, args.headerHeight, args.timelineWidth);
    this.drawTimelineTicks(args.scale, args.headerHeight, args.timelineWidth);
    this.drawShifts(args, args.rowHeight, args.headerHeight);

    this.gridLayer.draw();
    this.shiftLayer.draw();
  }

  private reconcileEvents(events: SchedulerEvent[], rowHeight: number, headerHeight: number, scale: TimelineScale): void {
    if (!this.eventLayer) {
      return;
    }

    const incomingIds = new Set(events.map((event) => event.id));

    this.eventNodes.forEach((node, id) => {
      if (!incomingIds.has(id)) {
        node.group.destroy();
        this.eventNodes.delete(id);
      }
    });

    events.forEach((event) => {
      const rowIndex = this.rowIndexMap.get(event.rowId);
      if (rowIndex === undefined) {
        return;
      }

      const model = this.toVisualModel(event, rowIndex, rowHeight, headerHeight, scale);
      const existing = this.eventNodes.get(event.id);
      if (!existing) {
        const group = this.createEventGroup(model, event.id);
        this.eventLayer?.add(group);
        this.eventNodes.set(event.id, { event, model, group });
        return;
      }

      existing.event = event;
      existing.model = model;

      if (this.currentDrag?.eventId === event.id) {
        return;
      }

      this.updateEventGroup(existing.group, model);
    });

    this.eventLayer.draw();
  }

  private createGridSignature(args: {
    rowHeight: number;
    headerHeight: number;
    timelineWidth: number;
    rows: string[];
    shifts: Shift[];
    scale: TimelineScale;
  }): string {
    const shiftSig = args.shifts
      .map((shift) => `${shift.id}:${shift.driverId}:${shift.startDateTime}:${shift.endDateTime}`)
      .join('|');
    return [
      args.rowHeight,
      args.headerHeight,
      args.timelineWidth,
      args.rows.join(','),
      args.scale.getStartMs(),
      args.scale.getEndMs(),
      args.scale.getPixelsPerMinute(),
      shiftSig
    ].join('::');
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
      const rowRect = new Konva.Rect({
        x: 0,
        y,
        width,
        height: rowHeight,
        fill: this.getBaseRowColor(index, isHold)
      });
      this.gridLayer?.add(rowRect);
      this.rowBackgroundRects.set(rowId, rowRect);

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
    if (!this.gridLayer || !this.stage) {
      return;
    }

    const tickIntervalMinutes = scale.getTickIntervalMinutes();
    const totalMinutes = scale.getTotalMinutes();
    const totalTicks = Math.ceil(totalMinutes / tickIntervalMinutes);

    for (let i = 0; i <= totalTicks; i += 1) {
      const x = (i * tickIntervalMinutes * scale.getPixelsPerHour()) / 60;
      this.gridLayer.add(
        new Konva.Line({
          points: [x, 0, x, this.stage.height()],
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

  private createEventGroup(model: EventVisualModel, eventId: string): Konva.Group {
    const group = new Konva.Group({
      id: model.id,
      x: model.x,
      y: model.y,
      draggable: true
    });

    group.dragBoundFunc((pos) => this.getBoundedPosition(eventId, pos));
    group.on('dragstart', () => this.handleDragStart(group, eventId));
    group.on('dragmove', () => this.handleDragMove(group));
    group.on('dragend', () => this.handleDragEnd(group, model, eventId));
    group.on('mouseenter', () => this.handleEventMouseEnter(eventId));
    group.on('mousemove', () => this.handleEventMouseMove(eventId));
    group.on('mouseleave', () => this.handleEventMouseLeave(eventId));

    const bodyRect = new Konva.Rect({
      name: 'event-body',
      x: 0,
      y: 0,
      width: model.width,
      height: model.height,
      fill: model.backgroundColor,
      stroke: model.borderColor,
      strokeWidth: 1,
      cornerRadius: 5
    });
    group.add(bodyRect);

    const tail = new Konva.Line({
      name: 'event-tail',
      points: [model.width, 8, model.width + 8, model.height / 2, model.width, model.height - 8],
      fill: model.accentColor,
      closed: true,
      stroke: model.accentColor,
      strokeWidth: 1
    });
    group.add(tail);

    model.lines.forEach((line, index) => {
      group.add(
        new Konva.Text({
          name: `event-line-${index}`,
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

  private updateEventGroup(group: Konva.Group, model: EventVisualModel): void {
    group.position({ x: model.x, y: model.y });

    const bodyRect = group.findOne<Konva.Rect>('.event-body');
    bodyRect?.setAttrs({
      width: model.width,
      height: model.height,
      fill: model.backgroundColor,
      stroke: model.borderColor
    });

    const tail = group.findOne<Konva.Line>('.event-tail');
    tail?.setAttrs({
      points: [model.width, 8, model.width + 8, model.height / 2, model.width, model.height - 8],
      fill: model.accentColor,
      stroke: model.accentColor
    });

    group.find('Text').forEach((textNode) => textNode.destroy());
    model.lines.forEach((line, index) => {
      group.add(
        new Konva.Text({
          name: `event-line-${index}`,
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
  }

  private handleDragStart(group: Konva.Group, eventId: string): void {
    const event = this.eventNodes.get(eventId)?.event;
    if (!event) {
      return;
    }
    const mode: DragState['mode'] = this.isCtrlPressed?.() ? 'time' : 'assignment';
    this.currentDrag = {
      eventId: event.id,
      mode,
      originalX: group.x(),
      originalY: group.y(),
      originalRowId: event.rowId,
      durationMs: new Date(event.endDateTime).getTime() - new Date(event.startDateTime).getTime()
    };
    this.onEventHoverEnd?.();

    group.opacity(0.9);
    group.moveToTop();
    const bodyRect = group.findOne<Konva.Rect>('.event-body');
    bodyRect?.setAttrs({
      shadowColor: '#0f172a',
      shadowBlur: 12,
      shadowOffset: { x: 0, y: 4 },
      shadowOpacity: 0.25
    });

    if (mode === 'assignment') {
      const rowTarget = this.getRowDropTarget(group.y());
      this.highlightRow(rowTarget?.rowId);
      this.showDragPreview(`Move to ${this.getRowLabel(rowTarget?.rowId)}`, group.x(), group.y(), '#1d4ed8');
    } else {
      const preview = this.getTimePreviewText(group.x(), this.currentDrag.durationMs, event);
      this.showDragPreview(preview, group.x(), group.y(), '#7c3aed');
    }

    this.eventLayer?.batchDraw();
  }

  private handleDragMove(group: Konva.Group): void {
    if (!this.currentDrag) {
      return;
    }

    if (this.currentDrag.mode === 'assignment') {
      const rowTarget = this.getRowDropTarget(group.y());
      this.highlightRow(rowTarget?.rowId);
      this.updateDragPreview(`Move to ${this.getRowLabel(rowTarget?.rowId)}`, group.x(), group.y(), '#1d4ed8');
      return;
    }

    const event = this.eventNodes.get(this.currentDrag.eventId)?.event;
    if (!event) {
      return;
    }
    this.updateDragPreview(this.getTimePreviewText(group.x(), this.currentDrag.durationMs, event), group.x(), group.y(), '#7c3aed');
  }

  private handleDragEnd(group: Konva.Group, model: EventVisualModel, eventId: string): void {
    const event = this.eventNodes.get(eventId)?.event;
    if (!event || !this.currentDrag || this.currentDrag.eventId !== event.id) {
      return;
    }

    const drag = this.currentDrag;
    this.currentDrag = undefined;
    group.opacity(1);
    const bodyRect = group.findOne<Konva.Rect>('.event-body');
    bodyRect?.setAttrs({ shadowOpacity: 0 });
    this.highlightRow(undefined);
    this.hideDragPreview();

    if (drag.mode === 'assignment') {
      const nextRowId = this.getRowDropTarget(group.y())?.rowId ?? drag.originalRowId;
      group.position({ x: drag.originalX, y: this.getRowY(nextRowId) + 9 });

      if (nextRowId !== drag.originalRowId) {
        this.onDragCommit?.({
          eventId: event.id,
          mode: 'assignment',
          rowId: nextRowId
        });
      }

      this.eventLayer?.batchDraw();
      return;
    }

    const snappedX = this.getSnappedX(group.x(), model.width);
    const nextStart = this.scale?.xToDateTime(snappedX);
    if (!nextStart) {
      group.position({ x: drag.originalX, y: drag.originalY });
      this.eventLayer?.batchDraw();
      return;
    }

    const nextEnd = new Date(new Date(nextStart).getTime() + drag.durationMs).toISOString();
    group.position({ x: snappedX, y: drag.originalY });

    if (nextStart !== event.startDateTime) {
      this.onDragCommit?.({
        eventId: event.id,
        mode: 'time',
        startDateTime: nextStart,
        endDateTime: nextEnd
      });
    }

    this.eventLayer?.batchDraw();
  }

  private handleEventMouseEnter(eventId: string): void {
    if (this.currentDrag) {
      return;
    }
    const node = this.eventNodes.get(eventId);
    if (!node) {
      return;
    }
    const bodyRect = node.group.findOne<Konva.Rect>('.event-body');
    bodyRect?.setAttrs({
      strokeWidth: 2,
      shadowColor: '#0f172a',
      shadowOpacity: 0.15,
      shadowBlur: 8,
      shadowOffset: { x: 0, y: 2 }
    });
    this.emitHover(node.event);
    this.eventLayer?.batchDraw();
  }

  private handleEventMouseMove(eventId: string): void {
    if (this.currentDrag) {
      return;
    }
    const event = this.eventNodes.get(eventId)?.event;
    if (!event) {
      return;
    }
    this.emitHover(event);
  }

  private handleEventMouseLeave(eventId: string): void {
    const node = this.eventNodes.get(eventId);
    const bodyRect = node?.group.findOne<Konva.Rect>('.event-body');
    bodyRect?.setAttrs({
      strokeWidth: 1,
      shadowOpacity: 0
    });
    this.onEventHoverEnd?.();
    this.eventLayer?.batchDraw();
  }

  private emitHover(event: SchedulerEvent): void {
    const pointer = this.stage?.getPointerPosition();
    if (!pointer) {
      return;
    }
    this.onEventHover?.({
      event,
      x: pointer.x,
      y: pointer.y
    });
  }

  private getBoundedPosition(eventId: string, pos: Konva.Vector2d): Konva.Vector2d {
    const drag = this.currentDrag;
    if (!drag) {
      return pos;
    }

    if (drag.mode === 'assignment') {
      const minY = this.headerHeight + 9;
      const maxY = this.headerHeight + (this.rows.length - 1) * this.rowHeight + 9;
      return {
        x: drag.originalX,
        y: Math.max(minY, Math.min(maxY, pos.y))
      };
    }

    return {
      x: this.getSnappedX(pos.x, this.eventNodes.get(eventId)?.model.width ?? 24),
      y: drag.originalY
    };
  }

  private getSnappedX(x: number, eventWidth: number): number {
    if (!this.scale) {
      return x;
    }

    const pixelsPerMinute = this.scale.getPixelsPerMinute();
    const snapMinutes = pixelsPerMinute >= 3 ? 5 : 15;
    const snapped = this.scale.snapX(x, snapMinutes);
    const minX = 0;
    const maxX = Math.max(0, this.timelineWidth - eventWidth - 12);
    return Math.max(minX, Math.min(maxX, snapped));
  }

  private buildRowDropTargets(rows: string[], rowHeight: number, headerHeight: number): RowDropTarget[] {
    return rows.map((rowId, index) => {
      const rowTop = headerHeight + index * rowHeight;
      return {
        rowId,
        minY: rowTop,
        maxY: rowTop + rowHeight
      };
    });
  }

  private getRowDropTarget(y: number): RowDropTarget | undefined {
    const eventCenterY = y + (this.rowHeight - 18) / 2;
    return this.rowDropTargets.find((target) => eventCenterY >= target.minY && eventCenterY < target.maxY);
  }

  private getRowY(rowId: string): number {
    const index = this.rowIndexMap.get(rowId) ?? 0;
    return this.headerHeight + index * this.rowHeight;
  }

  private highlightRow(rowId: string | undefined): void {
    this.rowBackgroundRects.forEach((rect, id) => {
      const rowIndex = this.rowIndexMap.get(id) ?? 0;
      rect.fill(id === rowId ? '#d1fae5' : this.getBaseRowColor(rowIndex, id === HOLD_ROW_ID));
    });
    this.gridLayer?.batchDraw();
  }

  private getBaseRowColor(index: number, isHold: boolean): string {
    if (isHold) {
      return '#fef3c7';
    }
    return index % 2 === 0 ? '#f8fafc' : '#ffffff';
  }

  private getRowLabel(rowId: string | undefined): string {
    if (!rowId) {
      return 'No row';
    }
    return this.rowLabelMap.get(rowId) ?? rowId;
  }

  private getTimePreviewText(x: number, durationMs: number, event: SchedulerEvent): string {
    const snappedX = this.getSnappedX(x, this.eventNodes.get(event.id)?.model.width ?? 24);
    const nextStartIso = this.scale?.xToDateTime(snappedX);
    if (!nextStartIso) {
      return 'Move in time';
    }
    const nextEndIso = new Date(new Date(nextStartIso).getTime() + durationMs).toISOString();
    const startLabel = new Date(nextStartIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endLabel = new Date(nextEndIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${startLabel} - ${endLabel}`;
  }

  private showDragPreview(text: string, groupX: number, groupY: number, accentColor: string): void {
    this.hideDragPreview();
    const preview = new Konva.Group({ listening: false });
    preview.add(
      new Konva.Rect({
        name: 'preview-bg',
        x: 0,
        y: 0,
        width: 120,
        height: 24,
        fill: '#ffffff',
        stroke: accentColor,
        strokeWidth: 1,
        cornerRadius: 6,
        shadowColor: '#0f172a',
        shadowOpacity: 0.15,
        shadowBlur: 8,
        shadowOffset: { x: 0, y: 3 }
      })
    );
    preview.add(
      new Konva.Text({
        name: 'preview-text',
        x: 8,
        y: 5,
        text,
        fontSize: 11,
        fill: '#0f172a'
      })
    );
    this.dragPreview = preview;
    this.eventLayer?.add(preview);
    this.updateDragPreview(text, groupX, groupY, accentColor);
  }

  private updateDragPreview(text: string, groupX: number, groupY: number, accentColor: string): void {
    if (!this.dragPreview) {
      return;
    }
    const textNode = this.dragPreview.findOne<Konva.Text>('.preview-text');
    const bgNode = this.dragPreview.findOne<Konva.Rect>('.preview-bg');
    textNode?.text(text);
    if (bgNode && textNode) {
      bgNode.stroke(accentColor);
      bgNode.width(Math.max(120, textNode.width() + 16));
    }
    this.dragPreview.position({ x: groupX + 10, y: groupY - 28 });
    this.dragPreview.moveToTop();
    this.eventLayer?.batchDraw();
  }

  private hideDragPreview(): void {
    this.dragPreview?.destroy();
    this.dragPreview = undefined;
  }
}
