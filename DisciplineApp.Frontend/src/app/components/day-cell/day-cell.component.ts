// src/app/components/day-cell/day-cell.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarDay, StreakColor } from '../../models/discipline.models';

@Component({
  selector: 'app-day-cell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="day-cell"
      [class.completed]="day.isCompleted"
      [class.in-streak]="day.dayInStreak > 0"
      [class.special-day]="day.isSpecial"
  [class.streak-salmon]="day.color === StreakColor.Salmon"
  [class.streak-orange]="day.color === StreakColor.Orange"
  [class.streak-yellow]="day.color === StreakColor.Yellow"
  [class.streak-white]="day.color === StreakColor.White"
  [class.streak-none]="day.color === StreakColor.None"
      (click)="onDayClick()"
      [title]="getDayTitle()">
      
      <!-- Display Reward Icon or Day Number -->
      <i *ngIf="day.rewards && day.rewards.length > 0" 
         [class]="getRewardIcon()" 
         class="reward-icon"></i>
      <span *ngIf="!day.rewards || day.rewards.length === 0" 
            class="day-number">{{ getDayNumber() }}</span>
    </div>
  `,
  styles: [`
    .day-cell {
      width: 35px;
      height: 35px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(30, 30, 30, 0.5);
      color: #fff;
      font-size: 14px;
      font-weight: 500;
    }

    .day-cell:hover {
      border-color: rgba(255, 255, 255, 0.4);
      transform: scale(1.05);
    }

    .day-cell.completed {
      background: rgba(100, 181, 246, 0.3);
      border-color: #64b5f6;
    }

    .day-cell.special-day {
      background: rgba(255, 193, 7, 0.3);
      border-color: #ffc107;
    }

    /* Streak color classes */
    .day-cell.streak-blue {
      background: rgba(33, 150, 243, 0.4);
      border-color: #2196f3;
    }

    .day-cell.streak-green {
      background: rgba(76, 175, 80, 0.4);
      border-color: #4caf50;
    }

    .day-cell.streak-orange {
      background: rgba(255, 152, 0, 0.4);
      border-color: #ff9800;
    }

    .day-cell.streak-red {
      background: rgba(244, 67, 54, 0.4);
      border-color: #f44336;
    }

    .day-cell.streak-special {
      background: rgba(156, 39, 176, 0.4);
      border-color: #9c27b0;
    }

    .day-number {
      font-weight: bold;
    }

    .reward-icon {
      font-size: 16px;
      color: #ffc107;
    }
  `]
})
export class DayCellComponent {
  @Input() day!: CalendarDay;
  @Output() dayClick = new EventEmitter<CalendarDay>();

  // Make StreakColor available in template
  StreakColor = StreakColor;

  onDayClick(): void {
    this.dayClick.emit(this.day);
  }

  getDayNumber(): number {
    return this.day.dayOfMonth;
  }

  getDayTitle(): string {
    const parts: string[] = [];
    
    parts.push(`Date: ${this.day.date}`);
    
    if (this.day.isCompleted) {
      parts.push('✓ Completed');
    } else {
      parts.push('○ Not completed');
    }

    if (this.day.dayInStreak > 0) {
      parts.push(`Streak day: ${this.day.dayInStreak}`);
    }

    if (this.day.isSpecial) {
      parts.push('🎉 Special reward day!');
    }

    if (this.day.rewards && this.day.rewards.length > 0) {
      parts.push(`Rewards: ${this.day.rewards.length}`);
      this.day.rewards.forEach(reward => {
        parts.push(`- ${reward.description}`);
      });
    }

    return parts.join('\n');
  }

  getRewardIcon(): string {
    if (!this.day.rewards || this.day.rewards.length === 0) {
      return '';
    }

    // Check reward types and return appropriate FontAwesome icon
    const hasWeekly = this.day.rewards.some(r => r.type === 'Weekly');
    const hasMonthly = this.day.rewards.some(r => r.type === 'Monthly');
    const hasMilestone = this.day.rewards.some(r => r.type === 'Milestone');

    if (hasMilestone) {
      return 'fas fa-crown'; // Crown for milestones
    } else if (hasMonthly) {
      return 'fas fa-trophy'; // Trophy for monthly rewards
    } else if (hasWeekly) {
      return 'fas fa-medal'; // Medal for weekly rewards
    }

    return 'fas fa-gift'; // Default gift icon
  }
}