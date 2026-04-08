import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DriversPanelComponent } from './components/drivers-panel/drivers-panel.component';
import { EventTooltipComponent } from './components/event-tooltip/event-tooltip.component';
import { SchedulerPageComponent } from './components/scheduler-page/scheduler-page.component';
import { TimelineCanvasComponent } from './components/timeline-canvas/timeline-canvas.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';

@NgModule({
  declarations: [SchedulerPageComponent, DriversPanelComponent, TimelineCanvasComponent, ToolbarComponent, EventTooltipComponent],
  imports: [CommonModule],
  exports: [SchedulerPageComponent]
})
export class SchedulerModule {}
