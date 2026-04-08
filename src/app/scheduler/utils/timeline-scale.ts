import { ZoomLevel } from '../../models/timeline.models';
import { getTimelineZoomConfig, TimelineZoomConfig } from './timeline-zoom';

export interface TimelineScaleConfig {
  startMs: number;
  endMs: number;
  zoomLevel: ZoomLevel;
}

export class TimelineScale {
  private readonly totalMinutes: number;
  private readonly pixelsPerMinute: number;
  private readonly zoomConfig: TimelineZoomConfig;

  constructor(private readonly config: TimelineScaleConfig) {
    this.zoomConfig = getTimelineZoomConfig(config.zoomLevel);
    this.totalMinutes = (config.endMs - config.startMs) / 60000;
    this.pixelsPerMinute = this.zoomConfig.pixelsPerHour / 60;
  }

  timeMsToX(timeMs: number): number {
    const minutesFromStart = (timeMs - this.config.startMs) / 60000;
    return minutesFromStart * this.pixelsPerMinute;
  }

  timeToX(datetime: string): number {
    return this.timeMsToX(new Date(datetime).getTime());
  }

  datetimeToX(datetime: string): number {
    return this.timeToX(datetime);
  }

  durationMsToWidth(startMs: number, endMs: number): number {
    const diffMinutes = (endMs - startMs) / 60000;
    return diffMinutes * this.pixelsPerMinute;
  }

  durationToWidth(startDateTime: string, endDateTime: string): number {
    return this.durationMsToWidth(new Date(startDateTime).getTime(), new Date(endDateTime).getTime());
  }

  xToTimeMs(x: number): number {
    const minutes = x / this.pixelsPerMinute;
    return this.config.startMs + minutes * 60000;
  }

  xToTime(x: number): string {
    return new Date(this.xToTimeMs(x)).toISOString();
  }

  xToDateTime(x: number): string {
    return this.xToTime(x);
  }

  snapX(x: number, snapMinutes: number): number {
    const snapWidth = snapMinutes * this.pixelsPerMinute;
    if (snapWidth <= 0) {
      return x;
    }
    return Math.round(x / snapWidth) * snapWidth;
  }

  getPixelsPerMinute(): number {
    return this.pixelsPerMinute;
  }

  getStartMs(): number {
    return this.config.startMs;
  }

  getEndMs(): number {
    return this.config.endMs;
  }

  getTotalWidth(): number {
    return this.totalMinutes * this.pixelsPerMinute;
  }

  getTotalMinutes(): number {
    return this.totalMinutes;
  }

  getTickIntervalMinutes(): number {
    return this.zoomConfig.tickIntervalMinutes;
  }

  getPixelsPerHour(): number {
    return this.zoomConfig.pixelsPerHour;
  }
}
