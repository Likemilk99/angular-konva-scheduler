export interface TimelineScaleConfig {
  startMs: number;
  endMs: number;
  pixelsPerMinute: number;
}

export class TimelineScale {
  private readonly totalMinutes: number;

  constructor(private readonly config: TimelineScaleConfig) {
    this.totalMinutes = (config.endMs - config.startMs) / 60000;
  }

  datetimeToX(datetime: string): number {
    const minutesFromStart = (new Date(datetime).getTime() - this.config.startMs) / 60000;
    return minutesFromStart * this.config.pixelsPerMinute;
  }

  durationToWidth(startDateTime: string, endDateTime: string): number {
    const diffMinutes =
      (new Date(endDateTime).getTime() - new Date(startDateTime).getTime()) / 60000;
    return diffMinutes * this.config.pixelsPerMinute;
  }

  xToDateTime(x: number): string {
    const minutes = x / this.config.pixelsPerMinute;
    return new Date(this.config.startMs + minutes * 60000).toISOString();
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
    return this.totalMinutes * this.config.pixelsPerMinute;
  }
}
