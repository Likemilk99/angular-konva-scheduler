import { SchedulerEvent, Shift, TimelineWindow } from '../../models/timeline.models';
import { TimelineScale } from './timeline-scale';

export interface ViewportState {
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface VisibleRowRange {
  startIndex: number;
  endIndex: number;
}

export interface VisibleTimeRange {
  startMs: number;
  endMs: number;
  startX: number;
  endX: number;
}

export interface FilteredTimelineItems {
  events: SchedulerEvent[];
  shifts: Shift[];
}

export const VIRTUALIZATION_OVERSCAN = {
  verticalRows: 4,
  horizontalPx: 320
} as const;

export function computeVisibleRowRange(params: {
  viewport: ViewportState;
  rowHeight: number;
  rowCount: number;
  headerHeight: number;
  overscanRows: number;
}): VisibleRowRange {
  const { viewport, rowHeight, rowCount, headerHeight, overscanRows } = params;
  if (rowCount <= 0) {
    return { startIndex: 0, endIndex: -1 };
  }

  const bodyTop = Math.max(0, viewport.scrollTop - headerHeight);
  const bodyBottom = Math.max(bodyTop, viewport.scrollTop + viewport.viewportHeight - headerHeight);
  const firstVisible = Math.floor(bodyTop / rowHeight);
  const lastVisible = Math.floor(Math.max(0, bodyBottom - 1) / rowHeight);

  return {
    startIndex: Math.max(0, firstVisible - overscanRows),
    endIndex: Math.min(rowCount - 1, lastVisible + overscanRows)
  };
}

export function computeVisibleTimeRange(params: {
  viewport: ViewportState;
  timelineWindow: TimelineWindow;
  scale: TimelineScale;
  overscanPx: number;
}): VisibleTimeRange {
  const { viewport, timelineWindow, scale, overscanPx } = params;
  const windowStartMs = new Date(timelineWindow.startDateTime).getTime();
  const windowEndMs = new Date(timelineWindow.endDateTime).getTime();

  const startX = Math.max(0, viewport.scrollLeft - overscanPx);
  const endX = Math.min(scale.getTotalWidth(), viewport.scrollLeft + viewport.viewportWidth + overscanPx);

  return {
    startMs: Math.max(windowStartMs, scale.xToTimeMs(startX)),
    endMs: Math.min(windowEndMs, scale.xToTimeMs(endX)),
    startX,
    endX
  };
}

export function toVisibleRowIds(rows: string[], range: VisibleRowRange): Set<string> {
  return new Set(rows.slice(range.startIndex, range.endIndex + 1));
}

export function filterTimelineItemsByViewport(params: {
  events: SchedulerEvent[];
  shifts: Shift[];
  visibleRowIds: Set<string>;
  visibleTimeRange: VisibleTimeRange;
}): FilteredTimelineItems {
  const { events, shifts, visibleRowIds, visibleTimeRange } = params;

  return {
    events: events.filter((event) =>
      visibleRowIds.has(event.rowId) &&
      rangesIntersect(
        new Date(event.startDateTime).getTime(),
        new Date(event.endDateTime).getTime(),
        visibleTimeRange.startMs,
        visibleTimeRange.endMs
      )
    ),
    shifts: shifts.filter((shift) =>
      visibleRowIds.has(shift.driverId) &&
      rangesIntersect(
        new Date(shift.startDateTime).getTime(),
        new Date(shift.endDateTime).getTime(),
        visibleTimeRange.startMs,
        visibleTimeRange.endMs
      )
    )
  };
}

export function rangesIntersect(startA: number, endA: number, startB: number, endB: number): boolean {
  return endA > startB && startA < endB;
}
