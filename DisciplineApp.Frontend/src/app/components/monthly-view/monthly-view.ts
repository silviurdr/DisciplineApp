// src/app/components/monthly-view/monthly-view.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitService } from '../../services/habit.service';
import { forkJoin, Subject, of } from 'rxjs';
import { takeUntil, map, catchError } from 'rxjs/operators';
import { DisciplineService } from '../../services/discipline.services';
import { CalendarDay, StreakColor } from '../../models/discipline.models';

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
  tasks: string[];
  completedTasks: string[];
  hasWarnings: boolean;
  rewards: string[];
}

interface MonthlyStats {
  completedDays: number;
  totalDays: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
}

@Component({
  selector: 'app-monthly-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="monthly-view">
      <!-- Header -->
      <div class="month-header">
        <button class="nav-btn" (click)="previousMonth()">‹</button>
        <div class="month-info">
          <h2>{{ getMonthName(currentMonth) }} {{ currentYear }}</h2>
          <button class="today-btn" (click)="goToToday()">Today</button>
        </div>
        <button class="nav-btn" (click)="nextMonth()">›</button>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading calendar...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error" class="error-state">
        <p>{{ error }}</p>
        <button (click)="loadMonthData()" class="retry-btn">Retry</button>
      </div>

      <!-- Stats -->
      <div class="stats-overview" *ngIf="monthlyStats && !loading">
        <div class="stat-card completion">
          <div class="stat-value">{{ monthlyStats.completionRate }}%</div>
          <div class="stat-label">Completion Rate</div>
        </div>
        <div class="stat-card streak">
          <div class="stat-value">{{ monthlyStats.currentStreak }}</div>
          <div class="stat-label">Current Streak</div>
        </div>
        <div class="stat-card completed">
          <div class="stat-value">{{ monthlyStats.completedDays }}</div>
          <div class="stat-label">Completed Days</div>
        </div>
      </div>

      <!-- Calendar -->
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

        <!-- Calendar Grid -->
        <div class="calendar-grid">
          <div *ngFor="let day of calendarDays" 
               class="calendar-day"
               [class.other-month]="!day.isCurrentMonth"
               [class.today]="day.isToday"
               [class.completed]="day.isCompleted"
               [class.partial]="day.isPartiallyCompleted"
               [class.grace-used]="day.isGraceUsed"
               [class.future]="isFutureDate(day.date)"
               (click)="selectDay(day)">
            
            <!-- Day Number -->
            <div class="day-number">{{ day.dayNumber }}</div>
            
            <!-- Completion Status -->
            <div class="day-status" *ngIf="!isFutureDate(day.date)">
              <span *ngIf="day.isCompleted" class="status-icon completed">✓</span>
              <span *ngIf="day.isPartiallyCompleted && !day.isCompleted" class="status-icon partial">◐</span>
              <span *ngIf="day.isGraceUsed" class="status-icon grace">G</span>
            </div>

            <!-- Tasks -->
            <div class="task-list" *ngIf="day.tasks.length > 0">
              <div class="task-count">{{ day.completedHabits }}/{{ day.totalHabits }}</div>
              <div class="task-items">
                <div *ngFor="let task of day.tasks" 
                     class="task-item" 
                     [class.completed]="day.completedTasks.includes(task)"
                     [title]="task + (day.completedTasks.includes(task) ? ' ✓' : '')"
                     (click)="toggleTask(task, day.date, $event)">
                  {{ getTaskInitial(task) }}
                </div>
              </div>
            </div>

            <!-- Free Day -->
            <div class="free-day" *ngIf="day.tasks.length === 0 && !isFutureDate(day.date) && day.isCurrentMonth">
              Free
            </div>

            <!-- Future -->
            <div class="future-indicator" *ngIf="isFutureDate(day.date) && day.isCurrentMonth">
              Future
            </div>
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
      background: #0a0a0a;
      color: #ffffff;
      min-height: 100vh;
    }

    .month-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 0 10px;
    }

    .nav-btn {
      background: rgba(100, 181, 246, 0.2);
      border: 1px solid rgba(100, 181, 246, 0.4);
      color: #64b5f6;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      font-size: 1.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .nav-btn:hover {
      background: rgba(100, 181, 246, 0.3);
      border-color: rgba(100, 181, 246, 0.6);
    }

    .month-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .month-info h2 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 700;
      color: #64b5f6;
    }

    .today-btn {
      background: rgba(76, 175, 80, 0.2);
      border: 1px solid rgba(76, 175, 80, 0.4);
      color: #4caf50;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }

    .today-btn:hover {
      background: rgba(76, 175, 80, 0.3);
    }

    .loading-state, .error-state {
      text-align: center;
      padding: 40px;
      color: #90caf9;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(100, 181, 246, 0.3);
      border-top: 3px solid #64b5f6;
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
      border: 1px solid rgba(100, 181, 246, 0.4);
      color: #64b5f6;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 10px;
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

    .stat-card.completion { border-left: 4px solid #4caf50; }
    .stat-card.streak { border-left: 4px solid #2196f3; }
    .stat-card.completed { border-left: 4px solid #ff9800; }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #64b5f6;
      margin-bottom: 5px;
    }

    .stat-label {
      font-size: 0.9rem;
      color: #90caf9;
      font-weight: 600;
    }

    .calendar-container {
      background: rgba(20, 20, 40, 0.6);
      border-radius: 15px;
      padding: 20px;
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
      transition: all 0.2s ease;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .calendar-day:hover {
      border-color: rgba(100, 181, 246, 0.5);
      transform: translateY(-1px);
    }

    .calendar-day.other-month {
      opacity: 0.3;
    }

    .calendar-day.today {
      border-color: #64b5f6;
      box-shadow: 0 0 10px rgba(100, 181, 246, 0.4);
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
      background: rgba(33, 150, 243, 0.2);
      border-color: rgba(33, 150, 243, 0.6);
    }

    .calendar-day.future {
      opacity: 0.6;
    }

    .day-number {
      font-size: 1rem;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 5px;
    }

    .calendar-day.today .day-number {
      color: #64b5f6;
      font-weight: bold;
    }

    .day-status {
      display: flex;
      justify-content: center;
      margin-bottom: 5px;
    }

    .status-icon {
      font-size: 1rem;
      font-weight: bold;
    }

    .status-icon.completed { color: #4caf50; }
    .status-icon.partial { color: #ffc107; }
    .status-icon.grace { color: #2196f3; }

    .task-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-top: auto;
    }

    .task-count {
      font-size: 0.7rem;
      text-align: center;
      color: #64b5f6;
      font-weight: 500;
    }

    .task-items {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      justify-content: center;
    }

    .task-item {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(100, 181, 246, 0.2);
      border: 1px solid rgba(100, 181, 246, 0.4);
      color: #90caf9;
    }

    .task-item:hover {
      background: rgba(100, 181, 246, 0.3);
      transform: scale(1.1);
    }

    .task-item.completed {
      background: rgba(76, 175, 80, 0.6);
      border-color: rgba(76, 175, 80, 0.8);
      color: #ffffff;
    }

    .free-day, .future-indicator {
      font-size: 0.6rem;
      color: rgba(144, 202, 249, 0.7);
      text-align: center;
      font-style: italic;
      margin-top: auto;
      padding: 2px;
      background: rgba(144, 202, 249, 0.1);
      border-radius: 2px;
    }

    @media (max-width: 768px) {
      .monthly-view {
        padding: 10px;
      }
      
      .stats-overview {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      
      .calendar-day {
        min-height: 80px;
        padding: 6px;
      }
    }
  `]
})
export class MonthlyViewComponent implements OnInit, OnDestroy {
  currentMonth: number;
  currentYear: number;
  
  calendarDays: MonthlyDayData[] = [];
  monthlyStats: MonthlyStats | null = null;
  selectedDay: MonthlyDayData | null = null;
  loading = false;
  error: string | null = null;

  private destroy$ = new Subject<void>();

constructor(private disciplineService: DisciplineService) { // ✅ Add this line
  const today = new Date();
  this.currentMonth = today.getMonth();
  this.currentYear = today.getFullYear();
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
  
  const firstDay = new Date(this.currentYear, this.currentMonth, 1);
  const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
  
  const monthDays: Date[] = [];
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    monthDays.push(new Date(d));
  }

  console.log('Month days being requested:', monthDays.map(d => d.toISOString().split('T')[0]));

  const dayRequests = monthDays.map(date => {
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    
    console.log(`Requesting data for: ${dateStr}`);
    
    return this.disciplineService.getDay(dateStr)
      .pipe(
        map((disciplineDay: any) => this.mapToMonthlyDayData(disciplineDay, date)), // ✅ Add type annotation
        catchError(error => {
          console.error(`Error fetching data for ${dateStr}:`, error);
          return of(this.createEmptyDayData(date));
        }),
        takeUntil(this.destroy$)
      );
  });

  forkJoin(dayRequests).subscribe({
    next: (days) => {
      this.calendarDays = days;
      this.calculateStats(); // ✅ Fix method name
      this.loading = false;
    },
    error: (error) => {
      console.error('Error loading month data:', error);
      this.error = 'Failed to load calendar data';
      this.loading = false;
    }
  });
}

private mapToMonthlyDayData(disciplineDay: any, date: Date): MonthlyDayData {
  const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  
  return {
    date: dateStr, // ✅ Now returns string, not Date
    dayNumber: date.getDate(),
    isCurrentMonth: true,
    isToday: this.isToday(date),
    isCompleted: disciplineDay.isCompleted || false,
    isPartiallyCompleted: false,
    isGraceUsed: false,
    completedHabits: disciplineDay.isCompleted ? 1 : 0,
    totalHabits: 1,
    tasks: ['Phone Lock Box'],
    completedTasks: disciplineDay.isCompleted ? ['Phone Lock Box'] : [],
    hasWarnings: false,
    rewards: disciplineDay.rewards?.map((r: any) => r.description) || [] // ✅ Fix rewards mapping
  };
}

// Helper method to create empty day data when API fails
private createEmptyDayData(date: Date): MonthlyDayData {
  const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  
  return {
    date: dateStr, // ✅ Now returns string, not Date
    dayNumber: date.getDate(),
    isCurrentMonth: true,
    isToday: this.isToday(date),
    isCompleted: false,
    isPartiallyCompleted: false,
    isGraceUsed: false,
    completedHabits: 0,
    totalHabits: 1,
    tasks: ['Phone Lock Box'],
    completedTasks: [],
    hasWarnings: false,
    rewards: []
  };
}

private isToday(date: Date): boolean {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
}
private generateCalendar(apiData: any[]): MonthlyDayData[] {
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
    
    // ✅ Use the SAME date formatting as in loadMonthData
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    
    const dayApiData = apiData.find(d => 
      d.date.toISOString().split('T')[0] === dateStr
    );

    // Rest of your existing generateCalendar logic...
    let dayData: MonthlyDayData;

    if (dayApiData && dayApiData.data) {
      const apiDay = dayApiData.data;
      const allHabits = apiDay.habitStatuses || apiDay.HabitStatuses || [];
      const requiredHabits = allHabits.filter((h: any) => h.isRequired || h.IsRequired);
      const completedRequiredHabits = requiredHabits.filter((h: any) => h.isCompleted || h.IsCompleted);

      dayData = {
        date: dateStr, // ✅ Use consistent dateStr format
        dayNumber: date.getDate(),
        isCurrentMonth,
        isToday: date.getTime() === today.getTime(),
        isCompleted: apiDay.isCompleted || apiDay.IsCompleted || false,
        isGraceUsed: apiDay.isGraceUsed || apiDay.IsGraceUsed || false,
        completedHabits: completedRequiredHabits.length,
        totalHabits: requiredHabits.length,
        tasks: requiredHabits.map((h: any) => 
          this.mapHabitNameToTaskName(h.habitName || h.HabitName)
        ),
        completedTasks: completedRequiredHabits.map((h: any) => 
          this.mapHabitNameToTaskName(h.habitName || h.HabitName)
        ),
        hasWarnings: (apiDay.warnings && apiDay.warnings.length > 0) || 
                    (apiDay.Warnings && apiDay.Warnings.length > 0),
        rewards: apiDay.rewards || apiDay.Rewards || [],
        isPartiallyCompleted: false
      };
    } else {
      dayData = {
        date: dateStr, // ✅ Use consistent dateStr format
        dayNumber: date.getDate(),
        isCurrentMonth,
        isToday: date.getTime() === today.getTime(),
        isCompleted: false,
        isGraceUsed: false,
        completedHabits: 0,
        totalHabits: 0,
        tasks: [],
        completedTasks: [],
        hasWarnings: false,
        rewards: [],
        isPartiallyCompleted: false
      };
    }

    days.push(dayData);
  }

  return days;
}

 private calculateStats(): MonthlyStats {
  const completedDays = this.calendarDays.filter(day => day.isCompleted).length;
  const totalDays = this.calendarDays.length;
  const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  const sortedDays = this.calendarDays
    .filter(day => new Date(day.date) <= today)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const day of sortedDays) {
    if (day.isCompleted) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate longest streak (simple version)
  let longestStreak = 0;
  let tempStreak = 0;
  
  for (const day of this.calendarDays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
    if (day.isCompleted) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  return {
    completedDays,
    totalDays,
    completionRate,
    currentStreak,
    longestStreak
    // ✅ Remove partialDays if it doesn't exist in your interface
  };
}

 toggleTask(taskName: string, date: string, event: Event): void {
  event.stopPropagation();
  
  const day = this.calendarDays.find(d => d.date === date);
  if (!day) return;

  const isCurrentlyCompleted = day.completedTasks.includes(taskName);
  
  // Update local state immediately for better UX
  if (isCurrentlyCompleted) {
    day.completedTasks = day.completedTasks.filter(t => t !== taskName);
  } else {
    day.completedTasks.push(taskName);
  }
  
  day.completedHabits = day.completedTasks.length;
  day.isCompleted = day.completedHabits >= day.totalHabits && day.totalHabits > 0;

  // Update stats
  this.monthlyStats = this.calculateStats();

  // ✅ FIX: Ensure consistent date formatting for save
  // The 'date' parameter is in 'YYYY-MM-DD' format, use it exactly as-is
  console.log(`Toggling task ${taskName} for date ${date} to ${!isCurrentlyCompleted}`);
  
  // Save to backend using the exact date string
  this.saveTaskCompletion(taskName, date, !isCurrentlyCompleted);
}

 
// The issue is likely that toggleHabitCompletion method doesn't exist in your habit service
// Based on the APIs we created, the correct method should be calling the habit tracking API

// ✅ FIX 1: Make sure your constructor has habitService injected
constructor(private habitService: HabitService, private disciplineService: DisciplineService) {
  const today = new Date();
  this.currentMonth = today.getMonth();
  this.currentYear = today.getFullYear();
}

// ✅ FIX 2: Update the saveTaskCompletion method to use the correct API call
private saveTaskCompletion(taskName: string, date: string, isCompleted: boolean): void {
  const taskToHabitId: { [key: string]: number } = {
    'Phone Lock Box': 1,
    'Clean Dishes': 2,
    'Vacuum & Sweep': 4, // ✅ Note: this should be 4 based on our habit setup
    'Gym Workout': 3,    // ✅ Note: this should be 3 based on our habit setup  
    'Clean Bathroom': 5,
    'Kitchen Deep Clean': 6,
    'Clean Windows': 7
  };

  const habitId = taskToHabitId[taskName];
  if (!habitId) {
    console.warn(`No habit ID found for task: ${taskName}`);
    return;
  }

  console.log(`Saving ${taskName} (ID: ${habitId}) for ${date} as ${isCompleted}`);

  // ✅ FIX 3: Use the correct method that exists in your habit tracking API
  if (isCompleted) {
    // Complete the habit
    this.habitService.completeHabit({
      habitId: habitId,
      date: date,
      notes: `Completed via monthly calendar`
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        console.log(`Successfully saved ${taskName} for ${date}`);
        this.updateLocalTaskCompletion(taskName, date, true);
      },
      error: (error) => {
        console.error(`Error saving ${taskName} for ${date}:`, error);
        this.revertTaskCompletion(taskName, date);
        alert('Failed to save. Please try again.');
      }
    });
  } else {
    // For uncompleting a habit, you might need a different approach
    // Since our API doesn't have an "uncomplete" method, we could:
    console.log(`Cannot uncomplete habit ${taskName} - API doesn't support uncompleting`);
    alert('Habit completion cannot be undone through this interface');
  }
}
 private revertTaskCompletion(taskName: string, date: string): void {
  const day = this.calendarDays.find(d => d.date === date);
  if (day) {
    // Revert the local state back to what it was
    const taskIndex = day.completedTasks.indexOf(taskName);
    if (taskIndex > -1) {
      day.completedTasks.splice(taskIndex, 1);
    }
    day.completedHabits = day.completedTasks.length;
    day.isCompleted = day.completedHabits === day.totalHabits;
  }
}

  private updateLocalTaskCompletion(taskName: string, date: string, isCompleted: boolean): void {
  const day = this.calendarDays.find(d => d.date === date);
  if (day) {
    if (isCompleted) {
      if (!day.completedTasks.includes(taskName)) {
        day.completedTasks.push(taskName);
      }
    } else {
      day.completedTasks = day.completedTasks.filter(t => t !== taskName);
    }
    
    day.completedHabits = day.completedTasks.length;
    day.isCompleted = day.completedHabits === day.totalHabits;
    
    // Recalculate monthly stats
    this.monthlyStats = this.calculateStats();
  }
}

  private mapHabitNameToTaskName(habitName: string): string {
    if (!habitName) return '';
    
    const mapping: { [key: string]: string } = {
      'Lock Phone in Box': 'Phone Lock Box',
      'Clean Dishes/Sink': 'Clean Dishes', 
      'Vacuum/Sweep Floors': 'Vacuum & Sweep',
      'Gym Workout': 'Gym Workout',
      'Clean Bathroom': 'Clean Bathroom',
      'Kitchen Deep Clean': 'Kitchen Deep Clean',
      'Clean Windows': 'Clean Windows'
    };
    
    return mapping[habitName] || habitName;
  }

  getTaskInitial(taskName: string): string {
    const mapping: { [key: string]: string } = {
      'Phone Lock Box': 'P',
      'Clean Dishes': 'C',
      'Vacuum & Sweep': 'V',
      'Gym Workout': 'G',
      'Clean Bathroom': 'B',
      'Kitchen Deep Clean': 'K',
      'Clean Windows': 'W'
    };
    
    return mapping[taskName] || taskName.charAt(0);
  }

  isFutureDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  }

  getMonthName(monthIndex: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }

  selectDay(day: MonthlyDayData): void {
    this.selectedDay = day;
  }

  closeModal(): void {
    this.selectedDay = null;
  }

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
}