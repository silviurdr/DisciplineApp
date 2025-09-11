// src/app/components/monthly-view/monthly-view.component.ts
// Updated to use ONLY real API data, no mock data generation

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitService } from '../../services/habit.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
  tasks?: string[];           // Array of task names for this day
  completedTasks?: string[];  // Array of completed task names for this day
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

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading calendar data...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error" class="error-state">
        <p>{{ error }}</p>
        <button (click)="loadMonthData()" class="retry-btn">Try Again</button>
      </div>

      <!-- Monthly Stats Overview -->
      <div class="stats-overview" *ngIf="monthlyStats && !loading">
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
      <div class="calendar-container" *ngIf="!loading">
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
            [class.future]="isFutureDate(day.date)"
            (click)="selectDay(day)">
            
            <!-- Day Number -->
            <div class="day-number">{{ day.dayNumber }}</div>
            
            <!-- Completion Status -->
            <div class="day-status" *ngIf="!isFutureDate(day.date)">
              <div class="status-indicator">
                <span *ngIf="day.isCompleted" class="status-icon completed">✓</span>
                <span *ngIf="day.isPartiallyCompleted && !day.isCompleted" class="status-icon partial">◐</span>
                <span *ngIf="day.isGraceUsed" class="status-icon grace">G</span>
                <span *ngIf="day.hasWarnings" class="status-icon warning">⚠</span>
              </div>
            </div>

            <div class="task-list" *ngIf="day.tasks && day.tasks.length > 0">
              <div class="task-count">{{ day.completedHabits }}/{{ day.tasks.length }} task{{ day.tasks.length !== 1 ? 's' : '' }}</div>
              <div class="task-items">
                <div *ngFor="let task of day.tasks" 
                    class="task-item" 
                    [class.completed]="isTaskCompleted(day, task)"
                    [title]="task + (isTaskCompleted(day, task) ? ' ✓' : '')"
                    (click)="toggleTaskCompletion(task, day.date, $event)">
                  {{ getTaskInitial(task) }}
                </div>
              </div>
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

            <!-- Future date indicator -->
            <div class="future-indicator" *ngIf="isFutureDate(day.date) && day.isCurrentMonth">
              <span class="future-text">Future</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State for No Data -->
      <div class="empty-state" *ngIf="!loading && !error && monthlyStats && monthlyStats.totalDays === 0">
        <div class="empty-icon">📅</div>
        <h3>No Data Yet</h3>
        <p>Start using your habit tracker to see your progress here!</p>
        <p>Go to the Weekly view to begin tracking your habits.</p>
      </div>

      <!-- Habit Performance Section (only if there's data) -->
      <div class="habit-performance" *ngIf="monthlyStats && monthlyStats.habitStats.length > 0 && !loading">
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
      <div class="legend" *ngIf="!loading">
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
          <div class="legend-item">
            <div class="legend-color future"></div>
            <span>Future Date</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Day Detail Modal -->
    <div class="modal-overlay" *ngIf="selectedDay" (click)="closeModal()">
  <div class="modal-content" (click)="$event.stopPropagation()">
    <!-- Modal Header -->
    <div class="modal-header">
      <div class="header-content">
        <h3>{{ formatDate(selectedDay.date) }}</h3>
        <div class="progress-ring">
          <svg class="progress-circle" width="50" height="50">
            <circle cx="25" cy="25" r="20" 
                    stroke="rgba(100, 181, 246, 0.3)" 
                    stroke-width="3" 
                    fill="transparent"/>
            <circle cx="25" cy="25" r="20" 
                    stroke="#64b5f6" 
                    stroke-width="3" 
                    fill="transparent"
                    stroke-dasharray="125.6"
                    [style.stroke-dashoffset]="125.6 - (125.6 * selectedDay.completedHabits / selectedDay.totalHabits)"
                    class="progress-bar-circle"/>
          </svg>
          <span class="progress-text">{{ selectedDay.completedHabits }}/{{ selectedDay.totalHabits }}</span>
        </div>
      </div>
      <button class="close-btn" (click)="closeModal()">×</button>
    </div>
    
    <div class="modal-body">
      <!-- Status Badge -->
      <div class="status-badge-container">
  <div class="status-badge" 
       [class.completed]="selectedDay.isCompleted"
       [class.partial]="selectedDay.isPartiallyCompleted && !selectedDay.isCompleted"
       [class.not-started]="!selectedDay.isCompleted && !selectedDay.isPartiallyCompleted">
    <div class="status-icon">
      <!-- Fixed: Check the actual completion states -->
      <span *ngIf="selectedDay.isCompleted">✓</span>
      <span *ngIf="selectedDay.isPartiallyCompleted && !selectedDay.isCompleted">◐</span>
      <span *ngIf="!selectedDay.isCompleted && !selectedDay.isPartiallyCompleted">○</span>
    </div>
    <div class="status-text">
      <!-- Fixed: Check the actual completion states -->
      <span *ngIf="selectedDay.isCompleted">Day Completed</span>
      <span *ngIf="selectedDay.isPartiallyCompleted && !selectedDay.isCompleted">Partially Done</span>
      <span *ngIf="!selectedDay.isCompleted && !selectedDay.isPartiallyCompleted">Not Started</span>
    </div>
  </div>
</div>

      <!-- Task List -->
      <div class="tasks-section" *ngIf="selectedDay.tasks && selectedDay.tasks.length > 0">
        <h4 class="section-title">
          <span class="title-icon">📋</span>
          Daily Tasks
        </h4>
        
        <div class="task-grid">
          <div *ngFor="let task of selectedDay.tasks; let i = index" 
              class="task-card"
              [class.completed]="isTaskCompleted(selectedDay, task)"
              [class.animate-in]="true"
              [style.animation-delay]="(i * 100) + 'ms'"
              (click)="toggleTaskCompletion(task, selectedDay.date, $event)">

            <!-- Task Icon & Status -->
            <div class="task-icon-container">
              <div class="task-icon" [class]="getTaskClass(task)">
                {{ getTaskInitial(task) }}
              </div>
              <!-- FIX: Change this to show correct status for each task -->
              <div class="completion-check" [class.visible]="isTaskCompleted(selectedDay, task)">
                <div class="checkmark">✓</div>
              </div>
            </div>
            
            <!-- Task Info -->
            <div class="task-info">
              <div class="task-name" [class.completed]="isTaskCompleted(selectedDay, task)">
                {{ task }}
              </div>
              <div class="task-frequency">{{ getTaskFrequency(task) }}</div>
            </div>
            
            <!-- Task Action -->
            <div class="task-action">
              <div class="action-button" [class.completed]="isTaskCompleted(selectedDay, task)">
                <!-- FIX: Change the button text based on actual completion status -->
                <span *ngIf="isTaskCompleted(selectedDay, task)">Done</span>
                <span *ngIf="!isTaskCompleted(selectedDay, task)">Mark</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!selectedDay.tasks || selectedDay.tasks.length === 0">
        <div class="empty-icon">🌟</div>
        <h4>No Tasks Today</h4>
        <p>Enjoy your free day!</p>
      </div>

      <!-- Completion Message -->
      <div class="completion-message" *ngIf="selectedDay.isCompleted">
        <div class="celebration-icon">🎉</div>
        <h4>Congratulations!</h4>
        <p>You've completed all tasks for today. Keep up the great work!</p>
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

    .loading-state, .error-state {
      text-align: center;
      padding: 40px;
      background: rgba(20, 20, 40, 0.6);
      border-radius: 15px;
      margin-bottom: 30px;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(100, 181, 246, 0.3);
      border-top: 4px solid #64b5f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .retry-btn {
      background: rgba(100, 181, 246, 0.2);
      border: 1px solid rgba(100, 181, 246, 0.5);
      color: #64b5f6;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 15px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: rgba(20, 20, 40, 0.6);
      border-radius: 15px;
      margin-bottom: 30px;
      border: 1px dashed rgba(100, 181, 246, 0.3);
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: 20px;
    }

    .empty-state h3 {
      color: #64b5f6;
      margin-bottom: 15px;
    }

    .empty-state p {
      color: #90caf9;
      margin-bottom: 10px;
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

    .calendar-day:hover:not(.future) {
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

    .calendar-day.future {
      opacity: 0.5;
      cursor: default;
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

    .future-indicator {
      text-align: center;
      margin-top: auto;
    }

    .future-text {
      font-size: 0.7rem;
      color: #90caf9;
      opacity: 0.6;
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

    .legend-color.future {
      background: rgba(120, 120, 120, 0.6);
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

      .task-details {
        margin: 20px 0;
      }

      .task-details h4 {
        color: #90caf9;
        margin-bottom: 15px;
        font-size: 1rem;
      }

      .task-list-modal {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .task-item-modal {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: rgba(30, 30, 60, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .task-item-modal:hover {
        background: rgba(100, 181, 246, 0.1);
        border-color: rgba(100, 181, 246, 0.3);
      }

      .task-item-modal.completed {
        background: rgba(76, 175, 80, 0.2);
        border-color: rgba(76, 175, 80, 0.5);
      }

      .task-item-modal.completed .task-name {
        text-decoration: line-through;
        opacity: 0.8;
      }

      .task-status-icon {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }

      .completed-icon {
        color: #4caf50;
        font-size: 1.2rem;
      }

      .incomplete-icon {
        color: #90caf9;
        font-size: 1.2rem;
      }

      .task-name {
        flex: 1;
        color: #e3f2fd;
        font-weight: 500;
      }

      .task-badge {
        width: 24px;
        height: 24px;
        background: rgba(100, 181, 246, 0.3);
        color: #64b5f6;
        border: 1px solid rgba(100, 181, 246, 0.5);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        font-weight: bold;
      }

      .task-item-modal.completed .task-badge {
        background: rgba(76, 175, 80, 0.6);
        border-color: rgba(76, 175, 80, 0.8);
        color: #ffffff;
      }

      .no-tasks {
        text-align: center;
        padding: 20px;
        color: #90caf9;
        font-style: italic;
      }

      .additional-info {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      /* Keep existing modal styles and update these */
      .modal-content {
        background: rgba(20, 20, 40, 0.95);
        border-radius: 15px;
        padding: 25px;
        max-width: 600px; /* Increased width for task list */
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        border: 1px solid rgba(100, 181, 246, 0.3);
      }
     /* Responsive */
      @media (max-width: 768px) {
        .modal-content {
          margin: 20px;
          max-height: 90vh;
        }
        
        .header-content {
          flex-direction: column;
          gap: 10px;
          text-align: center;
        }
        
        .task-card {
          padding: 15px;
        }
        
        .modal-body {
          padding: 20px;
        }
      }
    }
  `]
})
export class MonthlyViewComponent implements OnInit, OnDestroy {
  // Fix the initial month to current date
  currentMonth: number;
  currentYear: number;
  
  calendarDays: MonthlyDayData[] = [];
  monthlyStats: MonthlyStats | null = null;
  selectedDay: MonthlyDayData | null = null;
  loading = false;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(private habitService: HabitService) {
    // Initialize to current date
    const today = new Date();
    this.currentMonth = today.getMonth(); // This will be 8 for September (0-based)
    this.currentYear = today.getFullYear(); // 2025
  }

  ngOnInit(): void {
    this.loadMonthData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

 loadMonthData(): void {
  this.loading = true;
  this.error = null;
  
  // Load real completion data from backend
  this.loadRealCompletionData();
}

private loadRealCompletionData(): void {
  const firstDay = new Date(this.currentYear, this.currentMonth, 1);
  const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
  
  // Get all days in the current month
  const monthDays: Date[] = [];
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    monthDays.push(new Date(d));
  }

  // Load completion data for each day from API
  const dayRequests = monthDays.map(date => 
    this.habitService.getDayStatus(date.toISOString().split('T')[0])
      .pipe(takeUntil(this.destroy$))
  );

  // Execute all requests
  Promise.allSettled(dayRequests.map(req => req.toPromise()))
    .then(results => {
      const apiData: any[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          apiData.push({
            date: monthDays[index],
            data: result.value
          });
        }
      });

      // Generate calendar with real completion data
      this.calendarDays = this.generateCalendarWithCompletionData(apiData);
      this.monthlyStats = this.calculateTaskBasedStats();
      this.loading = false;
    })
    .catch(error => {
      console.error('Error loading completion data:', error);
      // Fallback to task-only calendar (no completion data)
      this.calendarDays = this.generateTaskPopulatedCalendar();
      this.monthlyStats = this.calculateTaskBasedStats();
      this.loading = false;
    });
}

private generateCalendarWithCompletionData(apiData: any[]): MonthlyDayData[] {
  const days: MonthlyDayData[] = [];
  const firstDay = new Date(this.currentYear, this.currentMonth, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const isCurrentMonth = date.getMonth() === this.currentMonth;
    const isFutureFromTomorrow = date >= tomorrow;
    
    // Generate scheduled tasks for this day
    const scheduledTasks = (isFutureFromTomorrow && date <= threeMonthsFromNow) 
      ? this.getTasksForDate(date) 
      : [];
    
    // Find API completion data for this date
    const apiDayData = apiData.find(d => 
      d.date.toDateString() === date.toDateString()
    );
    
    // Extract completed tasks from API data
    const completedTasks: string[] = [];
    let completedCount = 0;
    
    if (apiDayData && apiDayData.data.requiredHabits) {
      // Map API habit completions to task names
      apiDayData.data.requiredHabits.forEach((habit: any) => {
        if (habit.isCompleted) {
          const taskName = this.mapHabitToTaskName(habit.habitId);
          if (taskName && scheduledTasks.includes(taskName)) {
            completedTasks.push(taskName);
            completedCount++;
          }
        }
      });
    }
    
    const totalTasks = scheduledTasks.length;
    
    days.push({
      date: date.toISOString().split('T')[0],
      dayNumber: date.getDate(),
      isCurrentMonth,
      isToday: date.getTime() === today.getTime(),
      isCompleted: completedCount >= totalTasks && totalTasks > 0,
      isPartiallyCompleted: completedCount > 0 && completedCount < totalTasks,
      isGraceUsed: apiDayData?.data.isGraceUsed || false,
      completedHabits: completedCount,
      totalHabits: totalTasks,
      streakDay: apiDayData?.data.streakDay || null,
      rewards: apiDayData?.data.rewards || [],
      hasWarnings: apiDayData?.data.warnings?.length > 0 || false,
      tasks: scheduledTasks,
      completedTasks: completedTasks
    });
  }

  return days;
}

private mapHabitToTaskName(habitId: string | number): string | null {
  const habitToTaskMap: { [key: string]: string } = {
    '1': 'Phone Lock Box',
    '2': 'Clean Dishes',
    '3': 'Vacuum & Sweep',
    '4': 'Gym Workout',
    '5': 'Clean Bathroom',
    '6': 'Kitchen Deep Clean',
    '7': 'Clean Windows'
  };
  return habitToTaskMap[habitId.toString()] || null;
}

  private taskDefinitions = [
  {
    id: 'phone-lock',
    name: 'Phone Lock Box',
    frequency: 'daily' as const
  },
  {
    id: 'dishes',
    name: 'Clean Dishes',
    frequency: 'rolling' as const,
    details: { rollingDays: 2 }
  },
  {
    id: 'vacuum',
    name: 'Vacuum & Sweep',
    frequency: 'weekly' as const,
    details: { 
      weeklyCount: 2, 
      preferredDays: [1, 4] // Monday and Thursday
    }
  },
  {
    id: 'gym',
    name: 'Gym Workout',
    frequency: 'weekly' as const,
    details: { 
      weeklyCount: 4,
      preferredDays: [1, 2, 4, 5] // Mon, Tue, Thu, Fri
    }
  },
  {
    id: 'bathroom',
    name: 'Clean Bathroom',
    frequency: 'weekly' as const,
    details: { 
      weeklyCount: 1,
      preferredDays: [0] // Sunday
    }
  },
  {
    id: 'kitchen-deep',
    name: 'Kitchen Deep Clean',
    frequency: 'monthly' as const,
    details: {
      monthlyWeek: 1, // First week of month
      monthlyDay: 6 // Saturday
    }
  },
  {
    id: 'windows',
    name: 'Clean Windows',
    frequency: 'quarterly' as const,
    details: {
      quarterlyMonths: [3, 6, 9] // March, June, September
    }
  }
];

 private generateTaskPopulatedCalendar(): MonthlyDayData[] {
    const days: MonthlyDayData[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === this.currentMonth;
      const isPastOrToday = date <= today;
      const isFutureFromTomorrow = date >= tomorrow;
      
      const dayTasks = (isFutureFromTomorrow && date <= threeMonthsFromNow) 
        ? this.getTasksForDate(date) 
        : [];
      
      days.push({
        date: date.toISOString().split('T')[0],
        dayNumber: date.getDate(),
        isCurrentMonth,
        isToday: date.getTime() === today.getTime(),
        isCompleted: false,
        isPartiallyCompleted: false,
        isGraceUsed: false,
        completedHabits: 0,
        totalHabits: dayTasks.length,
        streakDay: null,
        rewards: [],
        hasWarnings: false,
        tasks: dayTasks,
        completedTasks: [] // Initialize empty completed tasks array
      });
    }

    return days;
  }

 // Add task completion functionality
  toggleTaskCompletion(taskName: string, date: string, event: Event): void {
  event.stopPropagation();
  
  const day = this.calendarDays.find(d => d.date === date);
  if (!day || !day.tasks) return;

  const taskIndex = day.tasks.indexOf(taskName);
  if (taskIndex === -1) return;

  // Initialize completedTasks array if it doesn't exist
  if (!day.completedTasks) {
    day.completedTasks = [];
  }

  const isCurrentlyCompleted = day.completedTasks.includes(taskName);
  
  if (isCurrentlyCompleted) {
    // Remove from completed tasks
    day.completedTasks = day.completedTasks.filter(t => t !== taskName);
  } else {
    // Add to completed tasks
    day.completedTasks.push(taskName);
  }

  // Update completion counters
  day.completedHabits = day.completedTasks.length;
  
  // Update completion status - THIS IS THE KEY FIX
  day.isCompleted = day.completedHabits >= day.totalHabits && day.totalHabits > 0;
  day.isPartiallyCompleted = day.completedHabits > 0 && day.completedHabits < day.totalHabits;

  // If selectedDay is the same day, update it too for immediate UI feedback
  if (this.selectedDay && this.selectedDay.date === date) {
    this.selectedDay.completedTasks = [...day.completedTasks];
    this.selectedDay.completedHabits = day.completedHabits;
    this.selectedDay.isCompleted = day.isCompleted;
    this.selectedDay.isPartiallyCompleted = day.isPartiallyCompleted;
  }

  // Save to backend
  this.saveTaskCompletion(taskName, date, !isCurrentlyCompleted);
  
  // Update statistics
  this.monthlyStats = this.calculateTaskBasedStats();
}

 private saveTaskCompletion(taskName: string, date: string, isCompleted: boolean): void {
  // Map task names to numeric habit IDs (matching your backend database)
  const taskToHabitId: { [key: string]: number } = {
    'Phone Lock Box': 1,
    'Clean Dishes': 2,
    'Vacuum & Sweep': 3,
    'Gym Workout': 4,
    'Clean Bathroom': 5,
    'Kitchen Deep Clean': 6,
    'Clean Windows': 7
  };

  const habitId = taskToHabitId[taskName];
  if (!habitId) {
    console.warn(`No habit ID found for task: ${taskName}`);
    return;
  }

  // Convert numeric ID to string for the service call (it will convert back internally)
  this.habitService.toggleHabitCompletion(habitId.toString(), date, isCompleted)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        console.log(`Task "${taskName}" completion saved successfully:`, response);
      },
      error: (error) => {
        console.error(`Error saving task completion for "${taskName}":`, error);
        this.revertTaskCompletion(taskName, date);
        alert('Failed to save task completion. Please try again.');
      }
    });
}

  private revertTaskCompletion(taskName: string, date: string): void {
    const day = this.calendarDays.find(d => d.date === date);
    if (!day || !day.completedTasks) return;

    // Revert the UI state
    const wasCompleted = day.completedTasks.includes(taskName);
    if (wasCompleted) {
      day.completedTasks = day.completedTasks.filter(t => t !== taskName);
      day.completedHabits = Math.max(0, day.completedHabits - 1);
    } else {
      day.completedTasks.push(taskName);
      day.completedHabits++;
    }

    day.isCompleted = day.completedHabits >= day.totalHabits;
    day.isPartiallyCompleted = day.completedHabits > 0 && day.completedHabits < day.totalHabits;
  }

private getTasksForDate(date: Date): string[] {
  const tasks: string[] = [];
  
  for (const taskDef of this.taskDefinitions) {
    if (this.isTaskRequiredOnDate(taskDef, date)) {
      tasks.push(taskDef.name);
    }
  }
  
  return tasks;
}

private isTaskRequiredOnDate(taskDef: any, date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // 1=January, 2=February, etc.
  const weekOfMonth = Math.ceil(dayOfMonth / 7);
  
  switch (taskDef.frequency) {
    case 'daily':
      return true; // Every day
      
    case 'rolling':
      if (taskDef.details?.rollingDays) {
        // For rolling tasks, check if it's time based on a cycle
        const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
        return daysSinceEpoch % taskDef.details.rollingDays === 0;
      }
      return false;
      
    case 'weekly':
      if (taskDef.details?.preferredDays) {
        return taskDef.details.preferredDays.includes(dayOfWeek);
      }
      return false;
      
    case 'monthly':
      if (taskDef.details?.monthlyWeek && taskDef.details?.monthlyDay !== undefined) {
        return weekOfMonth === taskDef.details.monthlyWeek && 
               dayOfWeek === taskDef.details.monthlyDay;
      }
      return false;
      
    case 'quarterly':
      if (taskDef.details?.quarterlyMonths) {
        // Check if it's the first day of a quarterly month
        return taskDef.details.quarterlyMonths.includes(month) && 
               dayOfMonth === 1;
      }
      return false;
      
    default:
      return false;
  }
}

private calculateTaskBasedStats(): MonthlyStats {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const currentMonthFutureDays = this.calendarDays.filter(day => {
      const dayDate = new Date(day.date);
      return day.isCurrentMonth && dayDate >= tomorrow;
    });
    
    const totalTaskDays = currentMonthFutureDays.filter(day => day.totalHabits > 0).length;
    const completedDays = currentMonthFutureDays.filter(day => day.isCompleted).length;
    const partialDays = currentMonthFutureDays.filter(day => day.isPartiallyCompleted).length;
    
    // Calculate task distribution with completion data
    const taskStats = this.taskDefinitions.map(taskDef => {
      const totalOccurrences = currentMonthFutureDays.filter(day => 
        day.tasks && day.tasks.includes(taskDef.name)
      ).length;
      
      const completedOccurrences = currentMonthFutureDays.filter(day => 
        day.completedTasks && day.completedTasks.includes(taskDef.name)
      ).length;
      
      return {
        habitName: taskDef.name,
        completedCount: completedOccurrences,
        totalPossible: totalOccurrences,
        percentage: totalOccurrences > 0 ? Math.round((completedOccurrences / totalOccurrences) * 100) : 0
      };
    }).filter(stat => stat.totalPossible > 0);

    return {
      totalDays: totalTaskDays,
      completedDays,
      partialDays,
      graceDaysUsed: 0, // No grace system in this view yet
      currentStreak: this.calculateCurrentStreak(currentMonthFutureDays),
      completionRate: totalTaskDays > 0 ? Math.round((completedDays / totalTaskDays) * 100) : 0,
      habitStats: taskStats
    };
  }

   private calculateCurrentStreak(days: MonthlyDayData[]): number {
    // Calculate streak from completed days (most recent first)
    const sortedDays = days
      .filter(day => day.totalHabits > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    let streak = 0;
    for (const day of sortedDays) {
      if (day.isCompleted) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

    // Helper method to check if task is completed
  isTaskCompleted(day: MonthlyDayData, taskName: string): boolean {
    return day.completedTasks ? day.completedTasks.includes(taskName) : false;
  }

  private loadRealMonthData(): void {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    
    // Get all days in the current month only
    const monthDays: Date[] = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      monthDays.push(new Date(d));
    }

    // Load data for each day in the month from API
    const dayRequests = monthDays.map(date => 
      this.habitService.getDayStatus(date.toISOString().split('T')[0])
        .pipe(takeUntil(this.destroy$))
    );

    // Execute all requests
    Promise.allSettled(dayRequests.map(req => req.toPromise()))
      .then(results => {
        const dayData: any[] = [];
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            dayData.push({
              date: monthDays[index],
              data: result.value
            });
          }
        });

        // Generate calendar with real data only
        this.calendarDays = this.generateCleanCalendarDays(dayData);
        this.monthlyStats = this.calculateRealMonthlyStats(dayData);
        this.loading = false;
      })
      .catch(error => {
        console.error('Error loading month data:', error);
        this.error = 'Failed to load calendar data. Please check your API connection.';
        this.loading = false;
        
        // Don't fallback to mock data - show empty calendar
        this.calendarDays = this.generateEmptyCalendarDays();
        this.monthlyStats = this.getEmptyStats();
      });
  }

  private generateCleanCalendarDays(realDayData: any[]): MonthlyDayData[] {
    const days: MonthlyDayData[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === this.currentMonth;
      const isFuture = date > today;
      
      // Find real data for this date
      const realData = realDayData.find(d => 
        d.date.toDateString() === date.toDateString()
      );

      let dayData: MonthlyDayData;

      if (realData && !isFuture) {
        // Use real API data
        dayData = this.convertApiDataToMonthlyData(date, realData.data, isCurrentMonth);
      } else {
        // Empty data for future days or days without API data
        dayData = {
          date: date.toISOString().split('T')[0],
          dayNumber: date.getDate(),
          isCurrentMonth,
          isToday: date.getTime() === today.getTime(),
          isCompleted: false,
          isPartiallyCompleted: false,
          isGraceUsed: false,
          completedHabits: 0,
          totalHabits: 0, // No habits shown for days without data
          streakDay: null,
          rewards: [],
          hasWarnings: false
        };
      }

      days.push(dayData);
    }

    return days;
  }

  private generateEmptyCalendarDays(): MonthlyDayData[] {
    const days: MonthlyDayData[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === this.currentMonth;
      
      days.push({
        date: date.toISOString().split('T')[0],
        dayNumber: date.getDate(),
        isCurrentMonth,
        isToday: date.getTime() === today.getTime(),
        isCompleted: false,
        isPartiallyCompleted: false,
        isGraceUsed: false,
        completedHabits: 0,
        totalHabits: 0,
        streakDay: null,
        rewards: [],
        hasWarnings: false
      });
    }

    return days;
  }

  private convertApiDataToMonthlyData(date: Date, apiData: any, isCurrentMonth: boolean): MonthlyDayData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count completed habits from API data
  const completedHabits = (apiData.requiredHabits || [])
    .filter((h: any) => h.isCompleted).length;
  const totalHabits = (apiData.requiredHabits || []).length;

  return {
    date: date.toISOString().split('T')[0],
    dayNumber: date.getDate(),
    isCurrentMonth,
    isToday: date.getTime() === today.getTime(),
    isCompleted: false, // Changed: Always false to remove green styling
    isPartiallyCompleted: false, // Changed: Always false to remove partial styling
    isGraceUsed: false, // Changed: Always false to remove grace styling
    completedHabits: 0, // Changed: Always 0 to hide progress bars
    totalHabits: 0, // Changed: Always 0 to hide progress bars
    streakDay: null, // Changed: Always null to remove streak indicators
    rewards: [], // Changed: Always empty to remove reward icons
    hasWarnings: false // Changed: Always false to remove warning indicators
  };
}

private calculateRealMonthlyStats(realDayData: any[]): MonthlyStats {
  return {
    totalDays: 0, // Changed: Always 0
    completedDays: 0, // Changed: Always 0
    partialDays: 0, // Changed: Always 0
    graceDaysUsed: 0, // Changed: Always 0
    currentStreak: 0, // Changed: Always 0
    completionRate: 0, // Changed: Always 0
    habitStats: [] // Changed: Always empty
  };
}

  private calculateHabitStats(realDayData: any[]): any[] {
    const habitMap = new Map<string, { completed: number, total: number }>();

    realDayData.forEach(dayData => {
      const habits = dayData.data.requiredHabits || [];
      habits.forEach((habit: any) => {
        const existing = habitMap.get(habit.habitName) || { completed: 0, total: 0 };
        existing.total++;
        if (habit.isCompleted) {
          existing.completed++;
        }
        habitMap.set(habit.habitName, existing);
      });
    });

    return Array.from(habitMap.entries()).map(([habitName, stats]) => ({
      habitName,
      completedCount: stats.completed,
      totalPossible: stats.total,
      percentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
    }));
  }

  private getEmptyStats(): MonthlyStats {
    return {
      totalDays: 0,
      completedDays: 0,
      partialDays: 0,
      graceDaysUsed: 0,
      currentStreak: 0,
      completionRate: 0,
      habitStats: []
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

  isFutureDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    return date > today;
  }

  // Interaction methods
  selectDay(day: MonthlyDayData): void {
    if (!day.isCurrentMonth || this.isFutureDate(day.date)) return;
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
    // For example: this.router.navigate(['/'], { queryParams: { date } });
  }

  getTaskInitial(taskName: string): string {
    if (!taskName || typeof taskName !== 'string') return '?';
    
    // Specific initials for your defined tasks
    const taskInitials: { [key: string]: string } = {
      'Phone Lock Box': 'P',
      'Clean Dishes': 'D', 
      'Vacuum & Sweep': 'V',
      'Gym Workout': 'G',
      'Clean Bathroom': 'B',
      'Kitchen Deep Clean': 'K',
      'Clean Windows': 'W'
    };
    
    // Return specific initial if found, otherwise first letter
    return taskInitials[taskName] || taskName.trim().charAt(0).toUpperCase();
  }

  getTaskClass(taskName: string): string {
  const taskClasses: { [key: string]: string } = {
    'Phone Lock Box': 'phone',
    'Clean Dishes': 'dishes',
    'Vacuum & Sweep': 'vacuum',
    'Gym Workout': 'gym',
    'Clean Bathroom': 'bathroom',
    'Kitchen Deep Clean': 'kitchen',
    'Clean Windows': 'windows'
  };
  return taskClasses[taskName] || 'default';
}

getTaskFrequency(taskName: string): string {
  const taskFrequencies: { [key: string]: string } = {
    'Phone Lock Box': 'Daily habit',
    'Clean Dishes': 'Every 2 days',
    'Vacuum & Sweep': '2x per week',
    'Gym Workout': '4x per week',
    'Clean Bathroom': 'Weekly',
    'Kitchen Deep Clean': 'Monthly',
    'Clean Windows': 'Quarterly'
  };
  return taskFrequencies[taskName] || 'Custom frequency';
}
}

