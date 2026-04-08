import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { Driver, HOLD_ROW_ID, SchedulerEvent, SchedulerState, Shift } from '../models/timeline.models';
import { getZoomInLevel, getZoomOutLevel } from '../scheduler/utils/timeline-zoom';
import { MockDataService } from './mock-data.service';

const EMPTY_STATE: SchedulerState = {
  loading: true,
  drivers: [],
  shifts: [],
  events: [],
  timelineWindow: {
    startDateTime: new Date().toISOString(),
    endDateTime: new Date().toISOString()
  },
  updatesPaused: false,
  zoomLevel: 60
};

@Injectable({ providedIn: 'root' })
export class SchedulerStateService implements OnDestroy {
  private readonly stateSubject = new BehaviorSubject<SchedulerState>(EMPTY_STATE);
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
      const dataset = this.mockData.createDataset();
      this.stateSubject.next({
        ...dataset,
        loading: false,
        updatesPaused: this.stateSubject.value.updatesPaused,
        zoomLevel: this.stateSubject.value.zoomLevel
      });
    }, 900);
  }

  toggleUpdatesPaused(): void {
    const current = this.stateSubject.value;
    this.stateSubject.next({ ...current, updatesPaused: !current.updatesPaused });
  }

  zoomIn(): void {
    this.updateZoomByStep(1);
  }

  zoomOut(): void {
    this.updateZoomByStep(-1);
  }

  updateEventRow(eventId: string, rowId: string): void {
    this.updateEvents((event) => (event.id === eventId ? { ...event, rowId } : event));
  }

  shiftEventTime(eventId: string, startDateTime: string, endDateTime: string): void {
    this.updateEvents((event) =>
      event.id === eventId
        ? {
            ...event,
            startDateTime,
            endDateTime
          }
        : event
    );
  }

  private updateEvents(mapper: (event: SchedulerEvent) => SchedulerEvent): void {
    const current = this.stateSubject.value;
    this.stateSubject.next({
      ...current,
      events: current.events.map(mapper)
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
        this.zone.run(() => {
          this.stateSubject.next({ ...snapshot, events: updatedEvents });
        });
      });
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

  private updateZoomByStep(direction: 1 | -1): void {
    const current = this.stateSubject.value;
    const nextLevel = direction === 1 ? getZoomInLevel(current.zoomLevel) : getZoomOutLevel(current.zoomLevel);
    if (!nextLevel) {
      return;
    }

    this.stateSubject.next({ ...current, zoomLevel: nextLevel });
  }
}
