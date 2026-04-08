import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DriversPanelComponent } from './components/drivers-panel/drivers-panel.component';
import { EventTooltipComponent } from './components/event-tooltip/event-tooltip.component';
import { SchedulerPageComponent } from './components/scheduler-page/scheduler-page.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { TimelineCanvasComponent } from './components/timeline-canvas/timeline-canvas.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';

@NgModule({
  declarations: [
    SchedulerPageComponent,
    DriversPanelComponent,
    TimelineCanvasComponent,
    ToolbarComponent,
    EventTooltipComponent,
    SettingsModalComponent
  ],
  imports: [CommonModule, FormsModule],
  exports: [SchedulerPageComponent]
})
export class SchedulerModule {}
