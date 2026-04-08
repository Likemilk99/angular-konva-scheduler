export type TimelineItemType = 'SHIFT' | 'EVENT' | 'HOLD_EVENT' | 'BREAK';

export interface Driver {
  id: string;
  name: string;
  score?: number;
  activeTrips?: number;
}

export interface Shift {
  id: string;
  driverId: string;
  startDateTime: string;
  endDateTime: string;
}

export interface PresentationConfig {
  backgroundColor?: string;
  borderColor?: string;
  accentColor?: string;
  lines?: Array<{
    key: string;
    label?: string;
  }>;
}

export interface SchedulerEvent {
  id: string;
  rowId: string;
  type: string;
  status: 'normal' | 'warning' | 'delayed' | 'conflict' | 'locked';
  startDateTime: string;
  endDateTime: string;
  payload: Record<string, string | number>;
  presentation?: PresentationConfig;
}

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  rowId: string;
  startDateTime: string;
  endDateTime: string;
}

export interface TimelineWindow {
  startDateTime: string;
  endDateTime: string;
}

export type ZoomLevel = 60 | 30 | 15;

export interface EventVisualModel {
  id: string;
  rowId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderColor: string;
  backgroundColor: string;
  accentColor: string;
  compactLevel: 'tiny' | 'compact' | 'full';
  lines: string[];
  status: SchedulerEvent['status'];
}

export interface SchedulerState {
  loading: boolean;
  drivers: Driver[];
  shifts: Shift[];
  events: SchedulerEvent[];
  timelineWindow: TimelineWindow;
  updatesPaused: boolean;
  zoomLevel: ZoomLevel;
}

export const HOLD_ROW_ID = 'HOLD';
