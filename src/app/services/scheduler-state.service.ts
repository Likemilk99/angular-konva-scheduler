import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { Driver, HOLD_ROW_ID, SchedulerEvent, SchedulerSettings, SchedulerState, Shift } from '../models/timeline.models';
import { MockDataService } from './mock-data.service';

const SETTINGS_STORAGE_KEY = 'scheduler-settings-v1';

const defaultWindowStart = new Date();
defaultWindowStart.setHours(18, 0, 0, 0);
const defaultWindowEnd = new Date(defaultWindowStart);
defaultWindowEnd.setDate(defaultWindowEnd.getDate() + 1);
defaultWindowEnd.setHours(2, 0, 0, 0);

const DEFAULT_SETTINGS: SchedulerSettings = {
  zoomLevel: 60,
  visibleWindow: {
    startDateTime: defaultWindowStart.toISOString(),
    endDateTime: defaultWindowEnd.toISOString()
  },
  timeZone: 'UTC'
};

const EMPTY_STATE: SchedulerState = {
  loading: true,
  drivers: [],
  shifts: [],
  events: [],
  timelineWindow: DEFAULT_SETTINGS.visibleWindow,
  updatesPaused: false,
  zoomLevel: DEFAULT_SETTINGS.zoomLevel,
  settings: DEFAULT_SETTINGS
};

@Injectable({ providedIn: 'root' })
export class SchedulerStateService implements OnDestroy {
  private readonly initialSettings = this.loadSettings();
  private eventIndexById = new Map<string, number>();

  private readonly stateSubject = new BehaviorSubject<SchedulerState>({
    ...EMPTY_STATE,
    settings: this.initialSettings,
    timelineWindow: this.initialSettings.visibleWindow,
    zoomLevel: this.initialSettings.zoomLevel
  });
  readonly state$ = this.stateSubject.asObservable();

  private realtimeSub?: Subscription;

  constructor(private readonly mockData: MockDataService, private readonly zone: NgZone) {
    this.reloadData();
    this.startRealtimeUpdates();
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
  }

  reloadData(): void {
    this.stateSubject.next({ ...this.stateSubject.value, loading: true });

    setTimeout(() => {
      const current = this.stateSubject.value;
      const dataset = this.mockData.createDataset(current.settings.visibleWindow);
      this.rebuildEventIndex(dataset.events);
      this.stateSubject.next({
        ...dataset,
        loading: false,
        updatesPaused: current.updatesPaused,
        zoomLevel: current.settings.zoomLevel,
        timelineWindow: current.settings.visibleWindow,
        settings: current.settings
      });
    }, 900);
  }

  toggleUpdatesPaused(): void {
    const current = this.stateSubject.value;
    this.stateSubject.next({ ...current, updatesPaused: !current.updatesPaused });
  }

  updateSettings(settings: SchedulerSettings): void {
    const current = this.stateSubject.value;
    const next = {
      ...current,
      settings,
      zoomLevel: settings.zoomLevel,
      timelineWindow: settings.visibleWindow
    };
    this.stateSubject.next(next);
    this.persistSettings(settings);
  }

  updateEventRow(eventId: string, rowId: string): void {
    this.patchEventById(eventId, (event) => ({ ...event, rowId }));
  }

  shiftEventTime(eventId: string, startDateTime: string, endDateTime: string): void {
    this.patchEventById(eventId, (event) => ({
      ...event,
      startDateTime,
      endDateTime
    }));
  }

  private patchEventById(eventId: string, patcher: (event: SchedulerEvent) => SchedulerEvent): void {
    const current = this.stateSubject.value;
    const eventIndex = this.eventIndexById.get(eventId) ?? current.events.findIndex((event) => event.id === eventId);
    if (eventIndex < 0 || eventIndex >= current.events.length) {
      return;
    }

    const target = current.events[eventIndex];
    const patched = patcher(target);
    if (patched === target) {
      return;
    }

    const nextEvents = current.events.slice();
    nextEvents[eventIndex] = patched;
    this.stateSubject.next({
      ...current,
      events: nextEvents
    });
  }

  private startRealtimeUpdates(): void {
    this.zone.runOutsideAngular(() => {
      this.realtimeSub = interval(4000).subscribe(() => {
        const snapshot = this.stateSubject.value;
        if (snapshot.loading || snapshot.updatesPaused || snapshot.events.length === 0) {
          return;
        }

        const updatedEvents = [...snapshot.events];
        const eventIndex = Math.floor(Math.random() * updatedEvents.length);
        const target = { ...updatedEvents[eventIndex] };

        const operation = Math.floor(Math.random() * 4);
        if (operation === 0) {
          target.status = this.randomStatus(target.status);
          target.presentation = this.mockData.presentationForStatus(target.status);
        } else if (operation === 1) {
          target.rowId = Math.random() < 0.2 ? HOLD_ROW_ID : this.pickRandomDriverId(snapshot.drivers);
        } else {
          const start = new Date(target.startDateTime);
          const end = new Date(target.endDateTime);
          const delta = (Math.floor(Math.random() * 21) - 10) * 60000;
          start.setTime(start.getTime() + delta);
          end.setTime(end.getTime() + delta);
          target.startDateTime = start.toISOString();
          target.endDateTime = end.toISOString();
        }

        updatedEvents[eventIndex] = target;
        this.eventIndexById.set(target.id, eventIndex);
        this.zone.run(() => {
          this.stateSubject.next({ ...snapshot, events: updatedEvents });
        });
      });
    });
  }

  private rebuildEventIndex(events: SchedulerEvent[]): void {
    this.eventIndexById.clear();
    events.forEach((event, index) => {
      this.eventIndexById.set(event.id, index);
    });
  }

  private pickRandomDriverId(drivers: Driver[]): string {
    return drivers[Math.floor(Math.random() * drivers.length)]?.id ?? HOLD_ROW_ID;
  }

  private randomStatus(current: SchedulerEvent['status']): SchedulerEvent['status'] {
    const statuses: SchedulerEvent['status'][] = ['normal', 'warning', 'delayed', 'conflict', 'locked'];
    const filtered = statuses.filter((status) => status !== current);
    return filtered[Math.floor(Math.random() * filtered.length)] ?? current;
  }

  private loadSettings(): SchedulerSettings {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    try {
      const parsed = JSON.parse(raw) as SchedulerSettings;
      if (!parsed?.visibleWindow?.startDateTime || !parsed?.visibleWindow?.endDateTime || !parsed.zoomLevel || !parsed.timeZone) {
        return DEFAULT_SETTINGS;
      }
      return parsed;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private persistSettings(settings: SchedulerSettings): void {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }
}
