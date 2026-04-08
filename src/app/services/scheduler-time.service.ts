import { Injectable } from '@angular/core';

export interface DateTimeParts {
  date: string;
  time: string;
}

@Injectable({ providedIn: 'root' })
export class SchedulerTimeService {
  formatTime(isoDateTime: string, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(isoDateTime));
  }

  formatShortDate(isoDateTime: string, timeZone: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric'
    }).format(new Date(isoDateTime));
  }

  toDateTimeParts(isoDateTime: string, timeZone: string): DateTimeParts {
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(isoDateTime));

    const year = dateParts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = dateParts.find((part) => part.type === 'month')?.value ?? '01';
    const day = dateParts.find((part) => part.type === 'day')?.value ?? '01';

    return {
      date: `${year}-${month}-${day}`,
      time: this.formatTime(isoDateTime, timeZone)
    };
  }

  combineLocalDateTimeToIso(date: string, time: string, timeZone: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);

    let utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);

    for (let i = 0; i < 2; i += 1) {
      const offsetMinutes = this.getOffsetMinutes(new Date(utcGuess), timeZone);
      utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - offsetMinutes * 60000;
    }

    return new Date(utcGuess).toISOString();
  }

  isValidWindow(startIso: string, endIso: string, maxDays = 7): boolean {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return false;
    }
    return end - start <= maxDays * 24 * 60 * 60000;
  }

  private getOffsetMinutes(date: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: '2-digit'
    }).formatToParts(date);

    const offsetToken = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'UTC';
    if (offsetToken === 'UTC' || offsetToken === 'GMT') {
      return 0;
    }

    const match = offsetToken.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) {
      return 0;
    }

    const sign = match[1] === '-' ? -1 : 1;
    const offsetHours = Number(match[2]);
    const offsetMinutes = Number(match[3] ?? 0);
    return sign * (offsetHours * 60 + offsetMinutes);
  }
}
