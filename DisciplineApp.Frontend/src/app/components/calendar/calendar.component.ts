import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitService } from '../../services/habit.service';
import { DisciplineService } from '../../services/discipline.services';


// Models for the habit-based system
interface DayStatus {
  date: string;
  isCompleted: boolean;
  isPartiallyCompleted: boolean;
  isGraceUsed: boolean;
  canUseGrace: boolean;
  requiredHabits: HabitStatus[];
  optionalHabits: HabitStatus[];
  warnings: string[];
  recommendations: string[];
}

interface RequiredHabit {
  habitId: string;
  habitName: string;
  name: string;
  isCompleted: boolean;
  isRequired: boolean;
  urgencyLevel: string;
}

interface HabitStatus {
  habitId: string;
  habitName: string;
  isCompleted: boolean;
  isRequired: boolean;
  description: string;
  urgencyLevel: 'Normal' | 'Urgent' | 'Critical';
}

interface WeeklyProgress {
  weekStart: string;
  weekEnd: string;
  graceRemaining: number;
  graceUsed: number;
  overallProgress: number;
  habitProgress: {
    habitName: string;
    completedCount: number;
    requiredCount: number;
    isOnTrack: boolean;
  }[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="calendar-container">
      <!-- Header -->
      <div class="header">
        <h1 class="title">Discipline Calendar</h1>
        <h2 class="week-title">Current Week: September 11-17, 2025</h2>
      </div>

      <!-- Weekly Progress Overview -->
      <div class="weekly-overview" *ngIf="weeklyProgress">
        <div class="progress-card">
          <h3>Week Progress: {{weeklyProgress.overallProgress}}%</h3>
          <div class="grace-info">
            <span class="grace-remaining">Grace Days: {{weeklyProgress.graceRemaining}}/1</span>
            <span class="grace-used" *ngIf="weeklyProgress.graceUsed > 0">Used: {{weeklyProgress.graceUsed}}</span>
          </div>
        </div>
        
        <!-- Habit Progress Summary -->
        <div class="habit-summary">
          <div *ngFor="let habit of weeklyProgress.habitProgress" 
               class="habit-progress" 
               [class.on-track]="habit.isOnTrack"
               [class.behind]="!habit.isOnTrack">
            <span class="habit-name">{{habit.habitName}}</span>
            <span class="habit-count">{{habit.completedCount}}/{{habit.requiredCount}}</span>
          </div>
        </div>
      </div>

      <!-- Current Week Calendar -->
      <div class="week-container">
        <div class="week-grid">
          <div *ngFor="let day of currentWeekDays; let i = index" 
               class="day-card"
               [class.completed]="day.isCompleted"
               [class.partial]="day.isPartiallyCompleted"
               [class.grace-used]="day.isGraceUsed"
               [class.today]="isToday(day.date)"
               [class.future]="isFuture(day.date)"
               (click)="openDayDetail(day)">
            
            <!-- Day Header -->
            <div class="day-header">
              <span class="day-name">{{getDayName(day.date)}}</span>
              <span class="day-number">{{getDayNumber(day.date)}}</span>
            </div>

            <!-- Day Status -->
            <div class="day-status">
              <div class="status-indicator">
                <span *ngIf="day.isCompleted" class="status-icon completed">✓</span>
                <span *ngIf="day.isPartiallyCompleted && !day.isCompleted" class="status-icon partial">◐</span>
                <span *ngIf="day.isGraceUsed" class="status-icon grace">G</span>
                <span *ngIf="!day.isCompleted && !day.isPartiallyCompleted && !day.isGraceUsed && !isFuture(day.date) && !isToday(day.date)" class="status-icon missed">✗</span>
              </div>
            </div>

            <!-- Quick Habit Overview -->
            <div class="habits-preview">
              <div class="habit-dots">
                <span *ngFor="let habit of day.requiredHabits" 
                      class="habit-dot"
                      [class.completed]="habit.isCompleted"
                      [title]="habit.habitName">
                </span>
              </div>
            </div>

            <!-- Warnings -->
            <div class="warnings" *ngIf="day.warnings.length > 0">
              <span class="warning-icon">⚠</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Today's Focus (if today is in current week) -->
      <div class="today-focus" *ngIf="todayData && !todayData.isCompleted">
        <h3>Today's Tasks</h3>
        <div class="today-habits">
          <div *ngFor="let habit of todayData.requiredHabits" 
               class="today-habit"
               [class.completed]="habit.isCompleted"
               [class.urgent]="habit.urgencyLevel === 'Urgent'"
               [class.critical]="habit.urgencyLevel === 'Critical'">
            <input type="checkbox" 
                   [checked]="habit.isCompleted" 
                   (change)="toggleHabit(habit.habitId, todayData.date)"
                   [id]="'habit-' + habit.habitId">
            <label [for]="'habit-' + habit.habitId">
              <span class="habit-name">{{habit.habitName}}</span>
              <span class="habit-description">{{habit.description}}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Day Detail Modal -->
    <div class="modal-overlay" *ngIf="selectedDay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{formatDate(selectedDay.date)}}</h3>
          <button class="close-btn" (click)="closeModal()">×</button>
        </div>
        
        <div class="modal-body">
          <!-- Required Habits -->
          <div class="habit-section" *ngIf="selectedDay.requiredHabits.length > 0">
            <h4>Required Habits</h4>
            <div *ngFor="let habit of selectedDay.requiredHabits" class="habit-item">
              <input type="checkbox" 
                     [checked]="habit.isCompleted" 
                     (change)="toggleHabit(habit.habitId, selectedDay.date)"
                     [id]="'modal-habit-' + habit.habitId">
              <label [for]="'modal-habit-' + habit.habitId">
                <span class="habit-name">{{habit.habitName}}</span>
                <span class="habit-description">{{habit.description}}</span>
                <span class="urgency-badge" [class]="habit.urgencyLevel.toLowerCase()">{{habit.urgencyLevel}}</span>
              </label>
            </div>
          </div>

          <!-- Optional Habits -->
          <div class="habit-section" *ngIf="selectedDay.optionalHabits.length > 0">
            <h4>Optional Habits</h4>
            <div *ngFor="let habit of selectedDay.optionalHabits" class="habit-item optional">
              <input type="checkbox" 
                     [checked]="habit.isCompleted" 
                     (change)="toggleHabit(habit.habitId, selectedDay.date)"
                     [id]="'modal-optional-' + habit.habitId">
              <label [for]="'modal-optional-' + habit.habitId">
                <span class="habit-name">{{habit.habitName}}</span>
                <span class="habit-description">{{habit.description}}</span>
              </label>
            </div>
          </div>

          <!-- Grace Option -->
          <div class="grace-section" *ngIf="selectedDay.canUseGrace && !selectedDay.isCompleted">
            <button class="grace-btn" (click)="useGraceDay(selectedDay.date)">
              Use Grace Day ({{weeklyProgress?.graceRemaining}} remaining)
            </button>
          </div>

          <!-- Warnings & Recommendations -->
          <div class="alerts" *ngIf="selectedDay.warnings.length > 0 || selectedDay.recommendations.length > 0">
            <div class="warnings" *ngIf="selectedDay.warnings.length > 0">
              <h5>Warnings</h5>
              <ul>
                <li *ngFor="let warning of selectedDay.warnings">{{warning}}</li>
              </ul>
            </div>
            <div class="recommendations" *ngIf="selectedDay.recommendations.length > 0">
              <h5>Recommendations</h5>
              <ul>
                <li *ngFor="let rec of selectedDay.recommendations">{{rec}}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #e3f2fd;
      padding: 20px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .title {
      font-size: 2.5rem;
      font-weight: 700;
      color: #64b5f6;
      margin: 0;
    }

    .week-title {
      font-size: 1.2rem;
      color: #90caf9;
      margin: 10px 0 0 0;
      font-weight: 400;
    }

    .weekly-overview {
      background: rgba(20, 20, 40, 0.6);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 30px;
      border: 1px solid rgba(100, 181, 246, 0.3);
    }

    .progress-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .progress-card h3 {
      color: #64b5f6;
      margin: 0;
    }

    .grace-info {
      display: flex;
      gap: 15px;
    }

    .grace-remaining {
      color: #4caf50;
      font-weight: 600;
    }

    .grace-used {
      color: #ff9800;
      font-weight: 600;
    }

    .habit-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
    }

    .habit-progress {
      background: rgba(30, 30, 60, 0.6);
      padding: 10px 15px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .habit-progress.on-track {
      border-color: rgba(76, 175, 80, 0.5);
      background: rgba(76, 175, 80, 0.1);
    }

    .habit-progress.behind {
      border-color: rgba(244, 67, 54, 0.5);
      background: rgba(244, 67, 54, 0.1);
    }

    .habit-name {
      font-weight: 600;
      margin-right: 10px;
    }

    .habit-count {
      color: #90caf9;
    }

    .week-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .week-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 15px;
    }

    .day-card {
      background: rgba(20, 20, 40, 0.6);
      border-radius: 12px;
      padding: 15px;
      min-height: 150px;
      border: 2px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    }

    .day-card:hover {
      border-color: rgba(100, 181, 246, 0.5);
      transform: translateY(-2px);
    }

    .day-card.today {
      border-color: rgba(100, 181, 246, 0.8);
      box-shadow: 0 0 20px rgba(100, 181, 246, 0.3);
    }

    .day-card.completed {
      border-color: rgba(76, 175, 80, 0.8);
      background: rgba(76, 175, 80, 0.1);
    }

    .day-card.partial {
      border-color: rgba(255, 193, 7, 0.8);
      background: rgba(255, 193, 7, 0.1);
    }

    .day-card.grace-used {
      border-color: rgba(156, 39, 176, 0.8);
      background: rgba(156, 39, 176, 0.1);
    }

    .day-card.future {
      opacity: 0.6;
      cursor: default;
    }

    .day-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .day-name {
      font-size: 0.9rem;
      color: #90caf9;
      font-weight: 600;
    }

    .day-number {
      font-size: 1.2rem;
      font-weight: 700;
      color: #64b5f6;
    }

    .day-status {
      text-align: center;
      margin-bottom: 10px;
    }

    .status-icon {
      font-size: 1.5rem;
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
      font-size: 1.2rem;
    }

    .status-icon.missed {
      color: #f44336;
    }

    .habits-preview {
      margin-bottom: 10px;
    }

    .habit-dots {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      justify-content: center;
    }

    .habit-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.5);
    }

    .habit-dot.completed {
      background: #4caf50;
      border-color: #4caf50;
    }

    .warnings {
      position: absolute;
      top: 5px;
      right: 5px;
    }

    .warning-icon {
      color: #ff9800;
      font-size: 1.2rem;
    }

    .today-focus {
      background: rgba(20, 20, 40, 0.6);
      border-radius: 15px;
      padding: 20px;
      margin-top: 30px;
      border: 1px solid rgba(100, 181, 246, 0.3);
    }

    .today-focus h3 {
      color: #64b5f6;
      margin-top: 0;
    }

    .today-habits {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .today-habit {
      display: flex;
      align-items: center;
      padding: 12px;
      background: rgba(30, 30, 60, 0.4);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .today-habit.completed {
      opacity: 0.7;
      text-decoration: line-through;
    }

    .today-habit.urgent {
      border-color: rgba(255, 193, 7, 0.5);
    }

    .today-habit.critical {
      border-color: rgba(244, 67, 54, 0.5);
    }

    .today-habit input[type="checkbox"] {
      margin-right: 12px;
      width: 18px;
      height: 18px;
    }

    .today-habit label {
      display: flex;
      flex-direction: column;
      cursor: pointer;
    }

    .habit-description {
      font-size: 0.9rem;
      color: #90caf9;
      margin-top: 2px;
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

    .habit-section {
      margin-bottom: 20px;
    }

    .habit-section h4 {
      color: #90caf9;
      margin-bottom: 10px;
    }

    .habit-item {
      display: flex;
      align-items: flex-start;
      padding: 10px;
      margin-bottom: 8px;
      background: rgba(30, 30, 60, 0.4);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .habit-item.optional {
      opacity: 0.8;
    }

    .habit-item input[type="checkbox"] {
      margin-right: 12px;
      margin-top: 2px;
      width: 18px;
      height: 18px;
    }

    .habit-item label {
      display: flex;
      flex-direction: column;
      cursor: pointer;
      flex: 1;
    }

    .urgency-badge {
      font-size: 0.8rem;
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 4px;
      display: inline-block;
      width: fit-content;
    }

    .urgency-badge.normal {
      background: rgba(76, 175, 80, 0.2);
      color: #4caf50;
    }

    .urgency-badge.urgent {
      background: rgba(255, 193, 7, 0.2);
      color: #ffc107;
    }

    .urgency-badge.critical {
      background: rgba(244, 67, 54, 0.2);
      color: #f44336;
    }

    .grace-section {
      margin: 20px 0;
      text-align: center;
    }

    .grace-btn {
      background: rgba(156, 39, 176, 0.2);
      border: 1px solid rgba(156, 39, 176, 0.5);
      color: #e3f2fd;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.3s ease;
    }

    .grace-btn:hover {
      background: rgba(156, 39, 176, 0.3);
    }

    .alerts {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .alerts h5 {
      margin-bottom: 8px;
      color: #90caf9;
    }

    .warnings ul {
      color: #ff9800;
    }

    .recommendations ul {
      color: #4caf50;
    }

    .alerts ul {
      margin: 0;
      padding-left: 20px;
    }

    .alerts li {
      margin-bottom: 5px;
    }

    @media (max-width: 768px) {
      .week-grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      
      .day-card {
        min-height: 100px;
      }
      
      .habit-summary {
        flex-direction: column;
      }
    }
  `]
})
export class CalendarComponent implements OnInit {
  currentWeekDays: DayStatus[] = [];
  weeklyProgress: WeeklyProgress | null = null;
  selectedDay: DayStatus | null = null;
  todayData: DayStatus | null = null;
  loading = false;
  error: string | null = null;

  constructor(private habitService: HabitService, private disciplineService: DisciplineService) {}

  ngOnInit(): void {
    this.loadCurrentWeekData();
  }

private loadCurrentWeekData(): void {
  const today = new Date();

  this.loading = true;
  this.error = null;

  this.disciplineService.getWeekData(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  ).subscribe({
    next: (weekData) => {
      console.log('API Week Data:', weekData);
      
      // Map the API response correctly
      this.currentWeekDays = this.mapApiDataToWeekDays(weekData);
      this.weeklyProgress = this.mapWeekDataToProgress(weekData);
      this.todayData = this.getCurrentDayData(weekData); // Pass weekData parameter
      this.loading = false;
    },
    error: (error) => {
      console.error('Error loading week data:', error);
/*       this.loadHardcodedData(); // Make sure this method exists */
    }
  });
}

private mapApiDataToDayStatus(weekData: any): any[] {
  return weekData.dayStatuses.map((dayStatus: any) => ({
    date: dayStatus.date,
    isCompleted: dayStatus.isCompleted,
    isPartiallyCompleted: dayStatus.isPartiallyCompleted,
    canUseGrace: dayStatus.canUseGrace,
    requiredHabitsCount: dayStatus.requiredHabitsCount,
    completedRequiredCount: dayStatus.completedRequiredCount
  }));
}

private mapWeekDataToProgress(weekData: any): any {
  return weekData.weeklyHabitProgress.reduce((acc: any, habit: any) => {
    acc[habit.name.replace(/\s+/g, '')] = {
      completed: habit.completions,
      target: habit.target,
      percentage: habit.percentage
    };
    return acc;
  }, {});
}

private getCurrentDayData(weekData: any): any {
  if (!weekData || !weekData.currentDay) {
    return {
      requiredHabits: [],
      optionalHabits: [],
      warnings: [],
      recommendations: []
    };
  }

  // Transform the habit objects to the format your template expects
  const requiredTasks = weekData.currentDay.requiredHabits.map((habit: any) => ({
    name: habit.name,
    description: habit.description,
    isCompleted: habit.isCompleted,
    habitId: habit.habitId,
    urgencyLevel: habit.urgencyLevel,
    reason: habit.reason
  }));

  const optionalTasks = weekData.currentDay.optionalHabits.map((habit: any) => ({
    name: habit.name,
    description: habit.description,
    isCompleted: habit.isCompleted,
    habitId: habit.habitId,
    urgencyLevel: habit.urgencyLevel,
    reason: habit.reason
  }));

  return {
    date: weekData.currentDay.date,
    requiredHabits: requiredTasks,
    optionalHabits: optionalTasks,
    warnings: weekData.currentDay.warnings || [],
    recommendations: weekData.currentDay.recommendations || [],
    canUseGrace: weekData.currentDay.canUseGrace,
    isCompleted: weekData.currentDay.isCompleted,
    isPartiallyCompleted: weekData.currentDay.isPartiallyCompleted
  };
}

private getWeekStart(date: Date): Date {
  const dayOfWeek = date.getDay();
  const mondayOffset = (dayOfWeek === 0) ? -6 : -(dayOfWeek - 1);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() + mondayOffset);
  return weekStart;
}


private mapWeekDataToDays(weekData: any): DayStatus[] {
  if (!weekData || !weekData.dayStatuses) {
    return this.generateCurrentWeekData(); // Fallback to hardcoded data
  }

  return weekData.dayStatuses.map((apiDay: any) => ({
    date: apiDay.date,
    isCompleted: apiDay.status === 'Complete',
    isPartiallyCompleted: apiDay.status === 'Partial',
    isGraceUsed: apiDay.status === 'GraceUsed',
    requiredHabits: apiDay.habitStatuses.map((habit: any) => ({
      habitId: this.mapNumericIdToString(habit.habitId),
      name: habit.habitName,
      isCompleted: habit.isCompleted,
      isRequired: habit.isRequired,
      urgency: habit.urgencyLevel || 'normal'
    })),
    completedHabits: apiDay.habitStatuses.filter((h: any) => h.isCompleted).length,
    totalHabits: apiDay.habitStatuses.length,
    warnings: apiDay.reminders || []
  }));
}

private calculateOverallProgress(habitProgress: any[]): number {
  if (!habitProgress.length) return 0;
  
  const totalCompleted = habitProgress.reduce((sum, habit) => sum + habit.completedCount, 0);
  const totalRequired = habitProgress.reduce((sum, habit) => sum + habit.requiredCount, 0);
  
  return totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;
}

// Fallback method for when API fails
/* private loadHardcodedData(): void {
  // Initialize with proper data structures that match what your template expects
  this.currentWeekDays = [];
  this.weeklyProgress = {}; // Empty object instead of null
  this.todayData = {
    requiredHabits: [],
    optionalHabits: [],
    warnings: [],
    recommendations: [],
    canUseGrace: false,
    isCompleted: false,
    isPartiallyCompleted: false
  }; // Proper object structure instead of null
  this.loading = false;
} */


private mapApiDataToWeekDays(weekData: any): any[] {
  return weekData.dayStatuses.map((apiDay: any) => ({
    date: apiDay.date,
    isCompleted: apiDay.isCompleted,
    isPartiallyCompleted: apiDay.isPartiallyCompleted,
    canUseGrace: apiDay.canUseGrace,
    requiredHabitsCount: apiDay.requiredHabitsCount,
    completedRequiredCount: apiDay.completedRequiredCount,
    // Add these missing properties:
    warnings: apiDay.warnings || [],  // Add default empty array
    recommendations: apiDay.recommendations || [],
    // Add any other properties your template expects
  }));
}

// Map numeric habit IDs back to string IDs for frontend
private mapNumericIdToString(numericId: number): string {
  const idMap: { [key: number]: string } = {
    1: 'phone-lock',
    2: 'clean-dishes',
    3: 'gym-workout',
    4: 'vacuum-sweep',
    5: 'clean-bathroom',
    6: 'kitchen-deep-clean',
    7: 'clean-windows'
  };
  return idMap[numericId] || `habit-${numericId}`;
}

// Helper method to format date for API
private formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper method to get Monday of current week
  loadCurrentWeek(): void {
    this.loading = true;
    this.error = null;

    // Generate current week (September 11-17, 2025)
    this.currentWeekDays = this.generateCurrentWeekData();
    this.weeklyProgress = this.generateWeeklyProgressData();
    this.todayData = this.getCurrentDayData(this.currentWeekDays.find(day => this.isToday(day.date)) || this.currentWeekDays[0]);
    
    this.loading = false;
  }

  private generateCurrentWeekData(): DayStatus[] {
    const weekDays = [];
    const startDate = new Date('2025-09-11'); // Thursday, September 11, 2025

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      weekDays.push({
        date: date.toISOString().split('T')[0],
        isCompleted: false,
        isPartiallyCompleted: false,
        isGraceUsed: false,
        canUseGrace: true,
        requiredHabits: this.generateHabitsForDay(date),
        optionalHabits: [],
        warnings: [],
        recommendations: []
      });
    }

    return weekDays;
  }

  private generateHabitsForDay(date: Date): HabitStatus[] {
    const baseHabits = [
      {
        habitId: 'phone-lock',
        habitName: 'Phone Lock Box',
        isCompleted: false,
        isRequired: true,
        description: 'Lock iPhone in the lock box for the day',
        urgencyLevel: 'Normal' as const
      },
      {
        habitId: 'dishes',
        habitName: 'Clean Dishes',
        isCompleted: false,
        isRequired: this.shouldCleanDishes(date),
        description: 'Ensure sink is clean, no dishes left',
        urgencyLevel: 'Normal' as const
      }
    ];

    // Add weekly habits based on day
    if (date.getDay() === 1 || date.getDay() === 4) { // Monday or Thursday
      baseHabits.push({
        habitId: 'vacuum',
        habitName: 'Vacuum & Sweep',
        isCompleted: false,
        isRequired: true,
        description: 'Vacuum and sweep all floors',
        urgencyLevel: 'Normal' as const
      });
    }

    if (date.getDay() === 0) { // Sunday
      baseHabits.push({
        habitId: 'bathroom',
        habitName: 'Clean Bathroom',
        isCompleted: false,
        isRequired: true,
        description: 'Full bathroom cleaning',
        urgencyLevel: 'Normal' as const
      });
    }

    return baseHabits;
  }

  private shouldCleanDishes(date: Date): boolean {
    // Simple logic: required every 2 days
    const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
    return daysSinceEpoch % 2 === 0;
  }

  private generateWeeklyProgressData(): WeeklyProgress {
    return {
      weekStart: '2025-09-11',
      weekEnd: '2025-09-17',
      graceRemaining: 1,
      graceUsed: 0,
      overallProgress: 0,
      habitProgress: [
        {
          habitName: 'Phone Lock',
          completedCount: 0,
          requiredCount: 7,
          isOnTrack: true
        },
        {
          habitName: 'Dishes',
          completedCount: 0,
          requiredCount: 4,
          isOnTrack: true
        },
        {
          habitName: 'Vacuum',
          completedCount: 0,
          requiredCount: 2,
          isOnTrack: true
        },
        {
          habitName: 'Bathroom',
          completedCount: 0,
          requiredCount: 1,
          isOnTrack: true
        }
      ]
    };
  }


getHabitDescription(habitId: string): string {
  const descriptions: { [key: string]: string } = {
    'phone-lock': 'Lock iPhone in the lock box for the day',
    'clean-dishes': 'Ensure sink is clean, no dishes left',
    'gym-workout': 'Complete workout session at the gym',
    'vacuum-sweep': 'Vacuum and sweep all floors',
    'clean-bathroom': 'Complete bathroom cleaning',
    'kitchen-deep-clean': 'Monthly deep clean of kitchen',
    'clean-windows': 'Clean all windows (seasonal)'
  };
  return descriptions[habitId] || 'Complete this habit';
}

  // Helper methods
  getDayName(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }

  getDayNumber(dateStr: string): number {
    return new Date(dateStr).getDate();
  }

  isToday(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  }

  isFuture(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateStr > today;
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
  openDayDetail(day: DayStatus): void {
    if (this.isFuture(day.date)) return;
    this.selectedDay = day;
  }

  closeModal(): void {
    this.selectedDay = null;
  }

toggleHabit(habitId: string, date: string): void {
  console.log(`Toggling habit ${habitId} for ${date}`);
  
  const day = this.currentWeekDays.find(d => d.date === date);
  if (!day) {
    console.error(`Day not found for date: ${date}`);
    return;
  }

  const habit = day.requiredHabits.find(h => h.habitId === habitId);
  if (!habit) {
    console.error(`Habit not found with ID: ${habitId}`);
    return;
  }

  const newCompletionState = !habit.isCompleted;
  
  // Optimistically update UI for better UX
  habit.isCompleted = newCompletionState;
  day.isCompleted = day.requiredHabits.every(h => h.isCompleted);
  
  const habitIdMap: { [key: string]: number } = {
    'phone-lock': 1,
    'clean-dishes': 2, 
    'gym-workout': 3,
    'vacuum-sweep': 4,
    'clean-bathroom': 5,
    'kitchen-deep-clean': 6,
    'clean-windows': 7
  };

  const numericHabitId = habitIdMap[habitId];
  if (!numericHabitId) {
    console.error(`No numeric habit ID mapping found for: ${habitId}`);
    return;
  }

  // Always call the same API endpoint - it handles both complete and uncomplete
  this.habitService.completeHabit({
    habitId: numericHabitId,
    date: date,
    notes: `Toggled via weekly calendar`
  }).subscribe({
    next: (response) => {
      console.log(`Successfully toggled habit ${habitId} for ${date}`);
      // The optimistic update should already match the server state
      this.updateWeeklyProgress();
    },
    error: (error) => {
      console.error(`Error toggling habit ${habitId} for ${date}:`, error);
      // Revert optimistic update on error
      habit.isCompleted = !newCompletionState;
      day.isCompleted = day.requiredHabits.every(h => h.isCompleted);
      alert('Failed to toggle habit. Please try again.');
    }
  });
}


toggleTask(task: any, date: string, event: Event): void {
  const isCompleted = (event.target as HTMLInputElement).checked;
  
  this.disciplineService.completeHabit({
    habitId: task.habitId,
    date: date,
    isCompleted: isCompleted,
    notes: ''
  }).subscribe({
    next: (response) => {
      console.log('Task toggled:', response);
      this.loadCurrentWeekData(); // Reload to get updated status
    },
    error: (error) => {
      console.error('Error toggling task:', error);
      // Revert checkbox on error
      (event.target as HTMLInputElement).checked = !isCompleted;
    }
  });
}


  useGraceDay(date: string): void {
    // TODO: Call API to use grace day
    console.log(`Use grace day for ${date}`);
    
    const day = this.currentWeekDays.find(d => d.date === date);
    if (day && this.weeklyProgress && this.weeklyProgress.graceRemaining > 0) {
      day.isGraceUsed = true;
      day.isCompleted = true;
      this.weeklyProgress.graceRemaining--;
      this.weeklyProgress.graceUsed++;
      this.closeModal();
    }
  }

  private updateDayStatus(day: DayStatus): void {
    // Check if all required habits are completed
    const allRequiredCompleted = day.requiredHabits.every(h => h.isCompleted);
    const someRequiredCompleted = day.requiredHabits.some(h => h.isCompleted);
    
    day.isCompleted = allRequiredCompleted;
    day.isPartiallyCompleted = someRequiredCompleted && !allRequiredCompleted;
    
    // Update weekly progress
    this.updateWeeklyProgress();
  }

  private updateWeeklyProgress(): void {
  // Recalculate weekly progress based on current completion states
  this.weeklyProgress = this.generateWeeklyProgressData();
}

  private getHabitIdFromName(habitName: string): string {
    const mapping: { [key: string]: string } = {
      'Phone Lock': 'phone-lock',
      'Dishes': 'dishes',
      'Vacuum': 'vacuum',
      'Bathroom': 'bathroom'
    };
    return mapping[habitName] || '';
  }

  private getHabitIdByName(name: string): number {
  const habitMap: { [key: string]: number } = {
    'Phone Lock Box': 1,
    'Clean Dishes': 2,
    'Gym Workout': 3,
    'Vacuum/Sweep Floors': 4,
    'Clean Bathroom': 5,
    'Kitchen Deep Clean': 6,
    'Clean Windows': 7
  };
  return habitMap[name] || 1;
}
}