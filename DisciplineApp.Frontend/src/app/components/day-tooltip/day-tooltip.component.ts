import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SimpleTask {
  name: string;
  category?: string;
  isCompleted: boolean;
  type: 'required' | 'optional' | 'adhoc' | 'deferred';
}

export interface SimpleDayData {
  date: Date;
  tasks: SimpleTask[];
}

@Component({
  standalone: true,
  imports: [CommonModule], // <- ADD this line
  selector: 'app-day-tooltip',
  templateUrl: './day-tooltip.component.html',
  styleUrls: ['./day-tooltip.component.scss']
})
export class DayTooltipComponent {
  @Input() dayData!: SimpleDayData;

  getDayName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getDayNumber(date: Date): string {
    return date.getDate().toString();
  }
}