import { Injectable } from '@angular/core';
import {
  Driver,
  HOLD_ROW_ID,
  PresentationConfig,
  SchedulerEvent,
  Shift,
  TimelineWindow
} from '../models/timeline.models';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  private readonly statuses: SchedulerEvent['status'][] = [
    'normal',
    'warning',
    'delayed',
    'conflict',
    'locked'
  ];

  createDataset(timelineWindow?: TimelineWindow): {
    drivers: Driver[];
    shifts: Shift[];
    events: SchedulerEvent[];
    timelineWindow: TimelineWindow;
  } {
    const resolvedWindow = timelineWindow ?? this.createTimelineWindow();
    const drivers = this.createDrivers(100);
    const shifts = this.createShifts(drivers, resolvedWindow);
    const events = this.createEvents(drivers, resolvedWindow, 5000);

    return { drivers, shifts, events, timelineWindow: resolvedWindow };
  }

  private createDrivers(total: number): Driver[] {
    return Array.from({ length: total }, (_, index) => ({
      id: `DRV-${String(index + 1).padStart(3, '0')}`,
      name: `Driver ${index + 1}`,
      score: 70 + Math.floor(Math.random() * 30),
      activeTrips: Math.floor(Math.random() * 6)
    }));
  }

  private createTimelineWindow(): TimelineWindow {
    const now = new Date();
    const start = new Date(now);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(2, 0, 0, 0);

    return {
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString()
    };
  }

  private createShifts(drivers: Driver[], window: TimelineWindow): Shift[] {
    const startMs = new Date(window.startDateTime).getTime();
    return drivers.map((driver) => {
      const shiftStart = new Date(startMs + this.randomInt(0, 90) * 60000);
      const shiftEnd = new Date(shiftStart.getTime() + this.randomInt(320, 480) * 60000);
      return {
        id: `SHIFT-${driver.id}`,
        driverId: driver.id,
        startDateTime: shiftStart.toISOString(),
        endDateTime: shiftEnd.toISOString()
      };
    });
  }

  private createEvents(drivers: Driver[], window: TimelineWindow, count: number): SchedulerEvent[] {
    const rows = [HOLD_ROW_ID, ...drivers.map((driver) => driver.id)];
    const startMs = new Date(window.startDateTime).getTime();
    const windowMinutes = (new Date(window.endDateTime).getTime() - startMs) / 60000;

    return Array.from({ length: count }, (_, index) => {
      const eventStart = new Date(startMs + this.randomInt(0, windowMinutes - 40) * 60000);
      const eventEnd = new Date(eventStart.getTime() + this.randomInt(20, 75) * 60000);
      const status = this.statuses[this.randomInt(0, this.statuses.length - 1)];
      return {
        id: `EVT-${index + 1}`,
        rowId: rows[this.randomInt(0, rows.length - 1)],
        type: ['PICKUP', 'DROPOFF', 'POSITION', 'ASSIST'][this.randomInt(0, 3)],
        status,
        startDateTime: eventStart.toISOString(),
        endDateTime: eventEnd.toISOString(),
        payload: {
          flightNumber: `UA${this.randomInt(100, 9999)}`,
          route: `${['LAX', 'JFK', 'SFO', 'DEN', 'ORD'][this.randomInt(0, 4)]}-${['ATL', 'LAS', 'DFW', 'MIA', 'SEA'][this.randomInt(0, 4)]}`,
          gate: `G${this.randomInt(1, 40)}`,
          stand: `S-${this.randomInt(1, 22)}`,
          taskCode: `TK-${this.randomInt(100, 999)}`
        },
        presentation: this.presentationForStatus(status)
      };
    });
  }

  presentationForStatus(status: SchedulerEvent['status']): PresentationConfig {
    const palette: Record<SchedulerEvent['status'], PresentationConfig> = {
      normal: {
        backgroundColor: '#e0f2fe',
        borderColor: '#0284c7',
        accentColor: '#0369a1',
        lines: [{ key: 'flightNumber' }, { key: 'route' }, { key: 'taskCode', label: 'Task' }]
      },
      warning: {
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        accentColor: '#d97706',
        lines: [{ key: 'flightNumber' }, { key: 'gate', label: 'Gate' }, { key: 'stand' }]
      },
      delayed: {
        backgroundColor: '#ffedd5',
        borderColor: '#f97316',
        accentColor: '#ea580c',
        lines: [{ key: 'flightNumber' }, { key: 'route' }, { key: 'gate' }]
      },
      conflict: {
        backgroundColor: '#fee2e2',
        borderColor: '#ef4444',
        accentColor: '#b91c1c',
        lines: [{ key: 'taskCode' }, { key: 'flightNumber' }, { key: 'route' }]
      },
      locked: {
        backgroundColor: '#e2e8f0',
        borderColor: '#64748b',
        accentColor: '#334155',
        lines: [{ key: 'taskCode', label: 'Locked' }, { key: 'flightNumber' }]
      }
    };

    return palette[status];
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
