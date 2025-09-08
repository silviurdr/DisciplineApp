import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarDay, StreakColor, RewardType } from '../../models/discipline.models';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCoffee, faBook, faTshirt, faTableTennis } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-day-cell',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div 
      class="day-cell"
      [class.completed]="day.isCompleted"
      [class.in-streak]="day.isInStreak"
      [class.special-day]="day.isSpecialDay"
      [class.streak-salmon]="day.streakColor === StreakColor.Salmon"
      [class.streak-orange]="day.streakColor === StreakColor.Orange"
      [class.streak-yellow]="day.streakColor === StreakColor.Yellow"
      [class.streak-white]="day.streakColor === StreakColor.White"
      [class.streak-break]="day.specialDayType === 'streak-break'"
      [class.book-cover]="day.specialDayType === 'book-cover'"
      (click)="onDayClick()"
      [title]="getDayTitle()">
      
      <!-- Display Reward Icon or Day Number -->
      <fa-icon *ngIf="day.rewards.length > 0" [icon]="getRewardIcon()" class="reward-icon"></fa-icon>
      <span *ngIf="day.rewards.length === 0" class="day-number">{{ getDayNumber() }}</span>
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
  background: rgba(30, 30, 60, 0.4);
  color: #e3f2fd;
  margin: 1px;
}
    .day-cell:hover {
  background: rgba(100, 181, 246, 0.2);
  border-color: rgba(100, 181, 246, 0.4);
}

.day-cell.completed {
  background: rgba(30, 30, 60, 0.6);
  border-color: rgba(100, 181, 246, 0.6);
}

    .day-cell.in-streak {
      border-width: 2px;
    }

        .rewards {  
    position: absolute;
    top: 2px;
    right: 2px;
    display: flex;
    gap: 2px;
    }

.reward-icon {
  font-size: 2rem; /* Increased size for icons */
  color: #ffd700;
  opacity: 0.9;
}

    .day-cell.streak-salmon {
      border-color: rgba(250, 128, 114, 0.8);
      box-shadow: 0 0 8px rgba(250, 128, 114, 0.6);
    }

    .day-cell.streak-orange {
      border-color: rgba(255, 165, 0, 0.8);
      box-shadow: 0 0 8px rgba(255, 165, 0, 0.6);
    }

    .day-cell.streak-yellow {
      border-color: rgba(255, 215, 0, 0.8);
      box-shadow: 0 0 8px rgba(255, 215, 0, 0.6);
    }

    .day-cell.streak-white {
      border-color: rgba(255, 255, 255, 0.8);
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
    }

    .day-cell.streak-break {
      border-color: rgba(255, 100, 100, 0.8);
      box-shadow: 0 0 6px rgba(255, 100, 100, 0.4);
    }

    .day-cell.book-cover {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%);
      border: 2px solid #ff0000;
      overflow: hidden;
    }

.day-number {
  font-size: 1rem; /* Adjusted size for day numbers */
  font-weight: bold;
  color: #e3f2fd;
}

    .rewards {
      position: absolute;
      top: 2px;
      right: 2px;
      display: flex;
      gap: 1px;
    }

    .reward-icon {
      font-size: 1.5rem;
      opacity: 0.9;
    }

    .streak-break-indicator {
      position: absolute;
      bottom: 2px;
      left: 3px;
      font-size: 10px;
      color: rgba(255, 100, 100, 0.8);
      font-weight: bold;
    }

    .book-cover-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      height: 100%;
      padding: 2px;
    }

    .book-title {
      font-size: 4px;
      font-weight: bold;
      color: #66ccff;
      text-align: center;
      line-height: 1;
    }

    .book-icon {
      font-size: 6px;
      opacity: 0.8;
    }
  `]
})
export class DayCellComponent {
  @Input() day!: CalendarDay;
  @Output() dayClicked = new EventEmitter<CalendarDay>();

  // Expose enums to template
  StreakColor = StreakColor;
  RewardType = RewardType;

  constructor(private library: FaIconLibrary) {
    library.addIcons(faCoffee, faBook, faTshirt, faTableTennis);
  }

  onDayClick(): void {
    this.dayClicked.emit(this.day);
  }

  getDayNumber(): number {
    return new Date(this.day.date).getDate();
  }

  hasReward(rewardType: RewardType): boolean {
    return this.day.rewards.includes(rewardType);
  }

  isBookCover(): boolean {
    return this.day.specialDayType === 'book-cover';
  }

  getDayTitle(): string {
    const date = new Date(this.day.date);
    const dayStr = date.toLocaleDateString();
    
    let title = `${dayStr}`;
    
    if (this.day.isCompleted) {
      title += ' - Completed';
    }
    
    if (this.day.isInStreak) {
      title += ` - Day ${this.day.dayInStreak} of streak`;
    }
    
    if (this.day.notes) {
      title += ` - ${this.day.notes}`;
    }
    
    return title;
  }

  getRewardIcon(): string {
    if (this.hasReward(RewardType.Coffee)) {
      return 'coffee';
    } else if (this.hasReward(RewardType.Book)) {
      return 'book';
    } else if (this.hasReward(RewardType.Clothing)) {
      return 'tshirt';
    } else if (this.hasReward(RewardType.Tennis)) {
      return 'table-tennis';
    }
    return ''; // Default case if no reward matches
  }
}