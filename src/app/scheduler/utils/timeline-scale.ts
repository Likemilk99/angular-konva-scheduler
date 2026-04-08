import { ZoomLevel } from '../../models/timeline.models';
import { getTimelineZoomConfig, TimelineZoomConfig } from './timeline-zoom';

export interface TimelineScaleConfig {
  startMs: number;
  endMs: number;
  zoomLevel: ZoomLevel;
  pixelsPerMinute:number;
}

export class TimelineScale {
  private readonly totalMinutes: number;
  private readonly pixelsPerMinute: number;
  private readonly zoomConfig: TimelineZoomConfig;

  constructor(private readonly config: TimelineScaleConfig) {
    this.zoomConfig = getTimelineZoomConfig(config.zoomLevel);
    this.totalMinutes = (config.endMs - config.startMs) / 60000;
    this.pixelsPerMinute = this.getPixelsPerHour() / 60;
  }

  timeToX(datetime: string): number {
    const minutesFromStart = (new Date(datetime).getTime() - this.config.startMs) / 60000;
    return minutesFromStart * this.pixelsPerMinute;
  }

  datetimeToX(datetime: string): number {
    return this.timeToX(datetime);
  }

  durationToWidth(startDateTime: string, endDateTime: string): number {
    const diffMinutes =
      (new Date(endDateTime).getTime() - new Date(startDateTime).getTime()) / 60000;
    return diffMinutes * this.pixelsPerMinute;
  }

  xToTime(x: number): string {
    const minutes = x / this.pixelsPerMinute;
    return new Date(this.config.startMs + minutes * 60000).toISOString();
  }

  xToDateTime(x: number): string {
    return this.xToTime(x);
  }

  snapX(x: number, snapMinutes: number): number {
    const snapWidth = snapMinutes * this.config.pixelsPerMinute;
    if (snapWidth <= 0) {
      return x;
    }
    return Math.round(x / snapWidth) * snapWidth;
  }

  getPixelsPerMinute(): number {
    return this.config.pixelsPerMinute;
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
