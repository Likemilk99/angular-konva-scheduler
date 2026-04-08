import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { SchedulerEvent } from '../../../models/timeline.models';

interface TooltipRow {
  label?: string;
  value: string;
  emphasis?: 'normal' | 'strong';
  valueClass?: string;
}

interface TooltipSection {
  title?: string;
  rows: TooltipRow[];
}

interface TooltipViewModel {
  title: string;
  subtitle?: string;
  statusLabel: string;
  statusClass: string;
  sections: TooltipSection[];
}

@Component({
  selector: 'app-event-tooltip',
  templateUrl: './event-tooltip.component.html',
  styleUrls: ['./event-tooltip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventTooltipComponent implements OnChanges {
  @Input() event?: SchedulerEvent | null;

  viewModel?: TooltipViewModel;

  ngOnChanges(changes: SimpleChanges): void {
    if (!('event' in changes)) {
      return;
    }
    this.viewModel = this.event ? this.buildViewModel(this.event) : undefined;
  }

  private buildViewModel(event: SchedulerEvent): TooltipViewModel {
    const payload = event.payload ?? {};
    const consumedKeys = new Set<string>();

    const title = this.pickFirstString(payload, consumedKeys, ['flightNumber', 'title', 'tripId', 'taskCode']) ?? event.id;
    const subtitle = this.pickFirstString(payload, consumedKeys, ['route', 'sector', 'destination']);

    const assignmentRows: TooltipRow[] = [];
    const gate = this.pickFirstString(payload, consumedKeys, ['gate']);
    const stand = this.pickFirstString(payload, consumedKeys, ['stand']);
    if (gate || stand) {
      assignmentRows.push({ label: 'Gate / Stand', value: [gate, stand].filter(Boolean).join(' / ') });
    }

    const timeRows: TooltipRow[] = [{ label: 'Time', value: `${this.toTime(event.startDateTime)} - ${this.toTime(event.endDateTime)}` }];

    const route = this.pickFirstString(payload, consumedKeys, ['route', 'originDestination']);
    if (route) {
      assignmentRows.unshift({ label: 'Route', value: route });
    }

    const statusLabel =
      this.pickFirstString(payload, consumedKeys, ['statusLabel', 'statusText', 'state']) ?? this.humanizeStatus(event.status);

    const metadataRows = Object.entries(payload)
      .filter(([key]) => !consumedKeys.has(key))
      .filter(([, value]) => value !== null && value !== undefined && `${value}`.trim().length > 0)
      .map(([key, value]) => ({
        label: this.humanizeLabel(key),
        value: `${value}`
      }));

    const sections: TooltipSection[] = [
      { rows: assignmentRows },
      { rows: timeRows },
      ...(metadataRows.length > 0 ? [{ title: 'Details', rows: metadataRows }] : [])
    ].filter((section) => section.rows.length > 0);

    return {
      title,
      subtitle,
      statusLabel,
      statusClass: event.status,
      sections
    };
  }

  private pickFirstString(payload: Record<string, string | number>, consumed: Set<string>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (value === undefined || value === null) {
        continue;
      }
      const text = `${value}`.trim();
      if (!text) {
        continue;
      }
      consumed.add(key);
      return text;
    }
    return undefined;
  }

  private toTime(isoDateTime: string): string {
    return new Date(isoDateTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private humanizeLabel(rawKey: string): string {
    return rawKey
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^./, (char) => char.toUpperCase());
  }

  private humanizeStatus(status: SchedulerEvent['status']): string {
    return status.slice(0, 1).toUpperCase() + status.slice(1);
  }
}
