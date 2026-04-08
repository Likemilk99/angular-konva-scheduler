import { ZoomLevel } from '../../models/timeline.models';

export interface TimelineZoomConfig {
  level: ZoomLevel;
  tickIntervalMinutes: number;
  pixelsPerHour: number;
}

const TIMELINE_ZOOM_CONFIGS: readonly TimelineZoomConfig[] = [
  { level: 60, tickIntervalMinutes: 60, pixelsPerHour: 80 },
  { level: 30, tickIntervalMinutes: 30, pixelsPerHour: 160 },
  { level: 15, tickIntervalMinutes: 15, pixelsPerHour: 320 }
];

export function getTimelineZoomLevels(): readonly ZoomLevel[] {
  return TIMELINE_ZOOM_CONFIGS.map((config) => config.level);
}

export function getTimelineZoomConfig(level: ZoomLevel): TimelineZoomConfig {
  return TIMELINE_ZOOM_CONFIGS.find((config) => config.level === level) ?? TIMELINE_ZOOM_CONFIGS[0];
}

export function getZoomInLevel(level: ZoomLevel): ZoomLevel | null {
  const levels = getTimelineZoomLevels();
  const index = levels.indexOf(level);
  if (index === -1 || index >= levels.length - 1) {
    return null;
  }
  return levels[index + 1];
}

export function getZoomOutLevel(level: ZoomLevel): ZoomLevel | null {
  const levels = getTimelineZoomLevels();
  const index = levels.indexOf(level);
  if (index <= 0) {
    return null;
  }
  return levels[index - 1];
}
