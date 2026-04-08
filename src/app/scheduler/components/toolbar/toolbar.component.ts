import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ZoomLevel } from '../../../models/timeline.models';
import { getZoomInLevel, getZoomOutLevel } from '../../utils/timeline-zoom';

@Component({
  selector: 'app-scheduler-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolbarComponent {
  @Input() updatesPaused = false;
  @Input() zoomLevel: ZoomLevel = 60;

  @Output() reload = new EventEmitter<void>();
  @Output() toggleUpdates = new EventEmitter<void>();
  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();

  get isZoomInDisabled(): boolean {
    return !getZoomInLevel(this.zoomLevel);
  }

  get isZoomOutDisabled(): boolean {
    return !getZoomOutLevel(this.zoomLevel);
  }
}
