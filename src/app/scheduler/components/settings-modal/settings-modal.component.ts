import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { SchedulerSettings, ZoomLevel } from '../../../models/timeline.models';
import { SchedulerTimeService } from '../../../services/scheduler-time.service';

interface SettingsFormModel {
  zoomLevel: ZoomLevel;
  timeZone: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

@Component({
  selector: 'app-settings-modal',
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsModalComponent implements OnChanges {
  @Input() settings!: SchedulerSettings;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<SchedulerSettings>();

  readonly zoomOptions: ZoomLevel[] = [60, 30, 15];
  readonly timeZones = ['UTC', 'Europe/Amsterdam', 'Europe/London', 'Asia/Dubai', 'Asia/Tokyo', 'America/New_York'];

  form?: SettingsFormModel;
  validationError = '';

  constructor(private readonly timeService: SchedulerTimeService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ('settings' in changes && this.settings) {
      this.form = this.toFormModel(this.settings);
      this.validationError = '';
    }
  }

  onSave(): void {
    if (!this.form) {
      return;
    }

    const startDateTime = this.timeService.combineLocalDateTimeToIso(this.form.startDate, this.form.startTime, this.form.timeZone);
    const endDateTime = this.timeService.combineLocalDateTimeToIso(this.form.endDate, this.form.endTime, this.form.timeZone);

    if (!this.timeService.isValidWindow(startDateTime, endDateTime, 7)) {
      this.validationError = 'End must be after start and range must be within 7 days.';
      return;
    }

    this.save.emit({
      zoomLevel: this.form.zoomLevel,
      timeZone: this.form.timeZone,
      visibleWindow: { startDateTime, endDateTime }
    });
  }

  private toFormModel(settings: SchedulerSettings): SettingsFormModel {
    const start = this.timeService.toDateTimeParts(settings.visibleWindow.startDateTime, settings.timeZone);
    const end = this.timeService.toDateTimeParts(settings.visibleWindow.endDateTime, settings.timeZone);

    return {
      zoomLevel: settings.zoomLevel,
      timeZone: settings.timeZone,
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time
    };
  }
}
