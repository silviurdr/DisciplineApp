// src/app/components/monthly-view/monthly-view.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitService } from '../../services/habit.service';

interface MonthlyDayData {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isCompleted: boolean;
  isPartiallyCompleted: boolean;
  isGraceUsed: boolean;
  completedHabits: number;
  totalHabits: number;
  streakDay: number | null;
  rewards: string[];
  hasWarnings: boolean;
}

interface MonthlyStats {
  totalDays: number;
  completedDays: number;
  partialDays: number;
  graceDaysUsed: number;
  currentStreak: number;
  completionRate: number;
  habitStats: {
    habitName: string;
    completedCount: number;
    totalPossible: number;
    percentage: number;
  }[];
}

@Component({
  selector: 'app-monthly-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="monthly-view">
      <!-- Header with Month Navigation -->
      <div class="month-header">
        <button class="nav-btn" (click)="previousMonth()">
          <span>‹</span>
        </button>
        <div class="month-info">
          <h2>{{ getMonthName(currentMonth) }} {{ currentYear }}</h2>
          <button class="today-btn" (click)="goToToday()">Today</button>
        </div>
        <button class="nav-btn" (click)="nextMonth()">
          <span>›</span>
        </button>
      </div>

      <!-- Monthly Stats Overview -->
      <div class="stats-overview" *ngIf="monthlyStats">
        <div class="stat-card completion">
          <div class="stat-value">{{ monthlyStats.completionRate }}%</div>
          <div class="stat-label">Completion Rate</div>
          <div class="stat-detail">{{ monthlyStats.completedDays }}/{{ monthlyStats.totalDays }} days</div>
        </div>
        
        <div class="stat-card streak">
          <div class="stat-value">{{ monthlyStats.currentStreak }}</div>
          <div class="stat-label">Current Streak</div>
          <div class="stat-detail">consecutive days</div>
        </div>
        
        <div class="stat-card grace">
          <div class="stat-value">{{ monthlyStats.graceDaysUsed }}</div>
          <div class="stat-label">Grace Days Used</div>
          <div class="stat-detail">this month</div>
        </div>
        
        <div class="stat-card partial">
          <div class="stat-value">{{ monthlyStats.partialDays }}</div>
          <div class="stat-label">Partial Days</div>
          <div class="stat-detail">some habits completed</div>
        </div>
      </div>

      <!-- Calendar Grid -->
      <div class="calendar-container">
        <!-- Day Headers -->
        <div class="calendar-header">
          <div class="day-header">Sun</div>
          <div class="day-header">Mon</div>
          <div class="day-header">Tue</div>
          <div class="day-header">Wed</div>
          <div class="day-header">Thu</div>
          <div class="day-header">Fri</div>
          <div class="day-header">Sat</div>
        </div>

        <!-- Calendar Days Grid -->
        <div class="calendar-grid">
          <div 
            *ngFor="let day of calendarDays" 
            class="calendar-day"
            [class.other-month]="!day.isCurrentMonth"
            [class.today]="day.isToday"
            [class.completed]="day.isCompleted"
            [class.partial]="day.isPartiallyCompleted"
            [class.grace-used]="day.isGraceUsed"
            [class.has-warnings]="day.hasWarnings"
            (click)="selectDay(day)">
            
            <!-- Day Number -->
            <div class="day-number">{{ day.dayNumber }}</div>
            
            <!-- Completion Status -->
            <div class="day-status">
              <div class="status-indicator">
                <span *ngIf="day.isCompleted" class="status-icon completed">✓</span>
                <span *ngIf="day.isPartiallyCompleted && !day.isCompleted" class="status-icon partial">◐</span>
                <span *ngIf="day.isGraceUsed" class="status-icon grace">G</span>
                <span *ngIf="day.hasWarnings" class="status-icon warning">⚠</span>
              </div>
            </div>

            <!-- Habit Progress Bar -->
            <div class="habit-progress" *ngIf="day.isCurrentMonth && day.totalHabits > 0">
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  [style.width.%]="(day.completedHabits / day.totalHabits) * 100">
                </div>
              </div>
              <div class="progress-text">{{ day.completedHabits }}/{{ day.totalHabits }}</div>
            </div>

            <!-- Streak Indicator -->
            <div class="streak-indicator" *ngIf="day.streakDay && day.streakDay <= 30">
              <span class="streak-day">{{ day.streakDay }}</span>
            </div>

            <!-- Rewards -->
            <div class="rewards" *ngIf="day.rewards.length > 0">
              <span *ngFor="let reward of day.rewards" class="reward-icon">
                {{ getRewardEmoji(reward) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Habit Performance Section -->
      <div class="habit-performance" *ngIf="monthlyStats">
        <h3>Habit Performance This Month</h3>
        <div class="habit-stats">
          <div *ngFor="let habit of monthlyStats.habitStats" class="habit-stat">
            <div class="habit-stat-header">
              <span class="habit-name">{{ habit.habitName }}</span>
              <span class="habit-percentage">{{ habit.percentage }}%</span>
            </div>
            <div class="habit-progress-bar">
              <div 
                class="habit-progress-fill" 
                [style.width.%]="habit.percentage"
                [class.excellent]="habit.percentage >= 90"
                [class.good]="habit.percentage >= 70 && habit.percentage < 90"
                [class.needs-improvement]="habit.percentage < 70">
              </div>
            </div>
            <div class="habit-stat-detail">
              {{ habit.completedCount }}/{{ habit.totalPossible }} completed
            </div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <h3>Legend</h3>
        <div class="legend-items">
          <div class="legend-item">
            <div class="legend-color completed"></div>
            <span>Completed Day</span>
          </div>
          <div class="legend-item">
            <div class="legend-color partial"></div>
            <span>Partial Completion</span>
          </div>
          <div class="legend-item">
            <div class="legend-color grace"></div>
            <span>Grace Day Used</span>
          </div>
          <div class="legend-item">
            <div class="legend-color today"></div>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Day Detail Modal -->
    <div class="modal-overlay" *ngIf="selectedDay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ formatDate(selectedDay.date) }}</h3>
          <button class="close-btn" (click)="closeModal()">×</button>
        </div>
        
        <div class="modal-body">
          <div class="day-summary">
            <div class="summary-item">
              <strong>Status:</strong>
              <span *ngIf="selectedDay.isCompleted" class="status-text completed">✓ Completed</span>
              <span *ngIf="selectedDay.isPartiallyCompleted && !selectedDay.isCompleted" class="status-text partial">◐ Partial</span>
              <span *ngIf="selectedDay.isGraceUsed" class="status-text grace">G Grace Used</span>
              <span *ngIf="!selectedDay.isCompleted && !selectedDay.isPartiallyCompleted && !selectedDay.isGraceUsed" class="status-text incomplete">○ Not Completed</span>
            </div>
            
            <div class="summary-item">
              <strong>Habits:</strong>
              <span>{{ selectedDay.completedHabits }}/{{ selectedDay.totalHabits }} completed</span>
            </div>
            
            <div class="summary-item" *ngIf="selectedDay.streakDay">
              <strong>Streak Day:</strong>
              <span class="streak-day">Day {{ selectedDay.streakDay }}</span>
            </div>
            
            <div class="summary-item" *ngIf="selectedDay.rewards.length > 0">
              <strong>Rewards Earned:</strong>
              <div class="rewards-list">
                <span *ngFor="let reward of selectedDay.rewards" class="reward-badge">
                  {{ getRewardEmoji(reward) }} {{ reward }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="view-details-btn" (click)="viewDayDetails(selectedDay.date)">
              View Full Details
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .monthly-view {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      color: #e3f2fd;
    }

    .month-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(20, 20, 40, 0.6);
      border-radius: 15px;
      border: 1px solid rgba(100, 181, 246, 0.3);
    }

    .nav-btn {
      background: rgba(100, 181, 246, 0.2);
      border: 1px solid rgba(100, 181, 246, 0.5);
      color: #64b5f6;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.5rem;
      font-weight: bold;
      transition: all 0.3s ease;
    }

    .nav-btn:hover {
      background: rgba(100, 181, 246, 0.3);
      transform: scale(1.1);
    }

    .month-info {
      text-align: center;
    }

    .month-info h2 {
      margin: 0 0 10px 0;
      color: #64b5f6;
      font-size: 2rem;
      font-weight: 700;
    }

    .today-btn {
      background: rgba(76, 175, 80, 0.2);
      border: 1px solid rgba(76, 175, 80, 0.5);
      color: #4caf50;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }

    .stats-overview {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: rgba(20, 20, 40, 0.6);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .stat-card.completion {
      border-left: 4px solid #4caf50;
    }

    .stat-card.streak {
      border-left: 4px solid #2196f3;
    }

    .stat-card.grace {
      border-left: 4px solid #9c27b0;
    }

    .stat-card.partial {
      border-left: 4px solid #ff9800;
    }

    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: #64b5f6;
      margin-bottom: 5px;
    }

    .stat-label {
      font-size: 1rem;
      color: #90caf9;
      font-weight: 600;
      margin-bottom: 5px;
    }

    .stat-detail {
      font-size: 0.8rem;
      color: #90caf9;
      opacity: 0.8;
    }

    .calendar-container {
      background: rgba(20, 20, 40, 0.6);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 30px;
      border: 1px solid rgba(100, 181, 246, 0.3);
    }

    .calendar-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 10px;
      margin-bottom: 15px;
    }

    .day-header {
      text-align: center;
      font-weight: 700;
      color: #90caf9;
      padding: 10px;
      font-size: 0.9rem;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
    }

    .calendar-day {
      background: rgba(30, 30, 60, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 8px;
      min-height: 100px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .calendar-day:hover {
      border-color: rgba(100, 181, 246, 0.5);
      transform: translateY(-2px);
    }

    .calendar-day.other-month {
      opacity: 0.3;
    }

    .calendar-day.today {
      border-color: rgba(100, 181, 246, 0.8);
      box-shadow: 0 0 15px rgba(100, 181, 246, 0.3);
    }

    .calendar-day.completed {
      background: rgba(76, 175, 80, 0.2);
      border-color: rgba(76, 175, 80, 0.6);
    }

    .calendar-day.partial {
      background: rgba(255, 193, 7, 0.2);
      border-color: rgba(255, 193, 7, 0.6);
    }

    .calendar-day.grace-used {
      background: rgba(156, 39, 176, 0.2);
      border-color: rgba(156, 39, 176, 0.6);
    }

    .calendar-day.has-warnings {
      border-color: rgba(244, 67, 54, 0.6);
    }

    .day-number {
      font-size: 1.1rem;
      font-weight: 600;
      color: #e3f2fd;
      margin-bottom: 5px;
    }

    .day-status {
      text-align: center;
      margin-bottom: 5px;
    }

    .status-icon {
      font-size: 1.2rem;
      font-weight: bold;
    }

    .status-icon.completed {
      color: #4caf50;
    }

    .status-icon.partial {
      color: #ff9800;
    }

    .status-icon.grace {
      color: #9c27b0;
    }

    .status-icon.warning {
      color: #f44336;
    }

    .habit-progress {
      margin-top: auto;
    }

    .progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 2px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50, #64b5f6);
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 0.7rem;
      color: #90caf9;
      text-align: center;
    }

    .streak-indicator {
      position: absolute;
      top: 5px;
      right: 5px;
      background: rgba(33, 150, 243, 0.8);
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: bold;
    }

    .rewards {
      position: absolute;
      bottom: 5px;
      right: 5px;
      display: flex;
      gap: 2px;
    }

    .reward-icon {
      font-size: 0.8rem;
    }

    .habit-performance {
      background: rgba(20, 20, 40, 0.6);
      border-radius: 15px;
      padding: 25px;
      margin-bottom: 30px;
      border: 1px solid rgba(100, 181, 246, 0.3);
    }

    .habit-performance h3 {
      color: #64b5f6;
      margin-top: 0;
      margin-bottom: 20px;
    }

    .habit-stats {
      display: grid;
      gap: 15px;
    }

    .habit-stat {
      background: rgba(30, 30, 60, 0.4);
      padding: 15px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .habit-stat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .habit-name {
      font-weight: 600;
      color: #e3f2fd;
    }

    .habit-percentage {
      font-weight: 700;
      color: #64b5f6;
    }

    .habit-progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 5px;
    }

    .habit-progress-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .habit-progress-fill.excellent {
      background: linear-gradient(90deg, #4caf50, #66bb6a);
    }

    .habit-progress-fill.good {
      background: linear-gradient(90deg, #2196f3, #42a5f5);
    }

    .habit-progress-fill.needs-improvement {
      background: linear-gradient(90deg, #ff9800, #ffb74d);
    }

    .habit-stat-detail {
      font-size: 0.8rem;
      color: #90caf9;
    }

    .legend {
      background: rgba(20, 20, 40, 0.6);
      border-radius: 15px;
      padding: 20px;
      border: 1px solid rgba(100, 181, 246, 0.3);
    }

    .legend h3 {
      color: #64b5f6;
      margin-top: 0;
      margin-bottom: 15px;
    }

    .legend-items {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .legend-color.completed {
      background: rgba(76, 175, 80, 0.6);
    }

    .legend-color.partial {
      background: rgba(255, 193, 7, 0.6);
    }

    .legend-color.grace {
      background: rgba(156, 39, 176, 0.6);
    }

    .legend-color.today {
      background: rgba(100, 181, 246, 0.6);
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal-content {
      background: rgba(20, 20, 40, 0.95);
      border-radius: 15px;
      padding: 25px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      border: 1px solid rgba(100, 181, 246, 0.3);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 15px;
    }

    .modal-header h3 {
      color: #64b5f6;
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      color: #90caf9;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 5px;
    }

    .day-summary {
      margin-bottom: 20px;
    }

    .summary-item {
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-text {
      font-weight: 600;
    }

    .status-text.completed {
      color: #4caf50;
    }

    .status-text.partial {
      color: #ff9800;
    }

    .status-text.grace {
      color: #9c27b0;
    }

    .status-text.incomplete {
      color: #90caf9;
    }

    .rewards-list {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .reward-badge {
      background: rgba(100, 181, 246, 0.2);
      color: #64b5f6;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .modal-actions {
      text-align: center;
    }

    .view-details-btn {
      background: rgba(100, 181, 246, 0.2);
      border: 1px solid rgba(100, 181, 246, 0.5);
      color: #64b5f6;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }

    @media (max-width: 768px) {
      .monthly-view {
        padding: 10px;
      }

      .month-header {
        flex-direction: column;
        gap: 15px;
        text-align: center;
      }

      .stats-overview {
        grid-template-columns: repeat(2, 1fr);
      }

      .calendar-day {
        min-height: 80px;
        padding: 5px;
      }

      .day-number {
        font-size: 1rem;
      }

      .legend-items {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class MonthlyViewComponent implements OnInit {
  currentMonth: number = 9; // September (0-based)
  currentYear: number = 2025;
  calendarDays: MonthlyDayData[] = [];
  monthlyStats: MonthlyStats | null = null;
  selectedDay: MonthlyDayData | null = null;

  constructor(private habitService: HabitService) {}

  ngOnInit(): void {
    this.loadMonthData();
  }

  loadMonthData(): void {
    this.calendarDays = this.generateCalendarDays();
    this.monthlyStats = this.generateMonthlyStats();
  }

  private generateCalendarDays(): MonthlyDayData[] {
    const days: MonthlyDayData[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    // Generate 42 days (6 weeks) to fill calendar grid
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === this.currentMonth;
      const dayData = this.generateDayData(date, isCurrentMonth);
      days.push(dayData);
    }

    return days;
  }

  private generateDayData(date: Date, isCurrentMonth: boolean): MonthlyDayData {
    const dateStr = date.toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Simulate habit completion data
    const completedHabits = Math.floor(Math.random() * 5);
    const totalHabits = 4;
    const isCompleted = completedHabits >= totalHabits;
    const isPartiallyCompleted = completedHabits > 0 && completedHabits < totalHabits;
    const isGraceUsed = !isCompleted && !isPartiallyCompleted && Math.random() > 0.9;
    
    // Calculate streak day (if in a streak)
    const daysSinceStart = Math.floor((date.getTime() - new Date('2025-09-01').getTime()) / (1000 * 60 * 60 * 24));
    const streakDay = isCompleted || isGraceUsed ? Math.max(1, daysSinceStart) : null;
    
    // Generate rewards for milestone days
    const rewards: string[] = [];
    if (streakDay) {
      if (streakDay % 7 === 0) rewards.push('Coffee');
      if (streakDay % 14 === 0) rewards.push('Book');
      if (streakDay % 30 === 0) rewards.push('Clothing');
    }

    return {
      date: dateStr,
      dayNumber: date.getDate(),
      isCurrentMonth,
      isToday: date.getTime() === today.getTime(),
      isCompleted,
      isPartiallyCompleted,
      isGraceUsed,
      completedHabits,
      totalHabits,
      streakDay,
      rewards,
      hasWarnings: !isCompleted && !isPartiallyCompleted && !isGraceUsed && date < today
    };
  }

  private generateMonthlyStats(): MonthlyStats {
    const currentMonthDays = this.calendarDays.filter(day => day.isCurrentMonth);
    const completedDays = currentMonthDays.filter(day => day.isCompleted).length;
    const partialDays = currentMonthDays.filter(day => day.isPartiallyCompleted).length;
    const graceDaysUsed = currentMonthDays.filter(day => day.isGraceUsed).length;
    
    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    for (let i = currentMonthDays.length - 1; i >= 0; i--) {
      const day = currentMonthDays[i];
      const dayDate = new Date(day.date);
      if (dayDate <= today && (day.isCompleted || day.isGraceUsed)) {
        currentStreak++;
      } else if (dayDate <= today) {
        break;
      }
    }

    return {
      totalDays: currentMonthDays.length,
      completedDays,
      partialDays,
      graceDaysUsed,
      currentStreak,
      completionRate: Math.round((completedDays / currentMonthDays.length) * 100),
      habitStats: [
        { habitName: 'Phone Lock', completedCount: 25, totalPossible: 30, percentage: 83 },
        { habitName: 'Clean Dishes', completedCount: 20, totalPossible: 15, percentage: 100 },
        { habitName: 'Vacuum', completedCount: 6, totalPossible: 8, percentage: 75 },
        { habitName: 'Bathroom', completedCount: 3, totalPossible: 4, percentage: 75 },
        { habitName: 'Gym', completedCount: 12, totalPossible: 16, percentage: 75 }
      ]
    };
  }

  // Navigation methods
  previousMonth(): void {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.loadMonthData();
  }

  nextMonth(): void {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.loadMonthData();
  }

  goToToday(): void {
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.loadMonthData();
  }

  // Utility methods
  getMonthName(month: number): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[month];
  }

  getRewardEmoji(reward: string): string {
    const emojiMap: { [key: string]: string } = {
      'Coffee': '☕',
      'Book': '📚',
      'Clothing': '👕',
      'Equipment': '🎾',
      'Experience': '🎵',
      'Trip': '✈️'
    };
    return emojiMap[reward] || '🏆';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // Interaction methods
  selectDay(day: MonthlyDayData): void {
    if (!day.isCurrentMonth) return;
    this.selectedDay = day;
  }

  closeModal(): void {
    this.selectedDay = null;
  }

  viewDayDetails(date: string): void {
    // TODO: Navigate to detailed day view or weekly view
    console.log('Navigate to detailed view for:', date);
    this.closeModal();
    
    // This could emit an event or use router to navigate
    // For example: this.router.navigate(['/calendar'], { queryParams: { date } });
  }
}