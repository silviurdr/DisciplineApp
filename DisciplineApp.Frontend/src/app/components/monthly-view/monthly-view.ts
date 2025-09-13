// src/app/components/monthly-view/monthly-view.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, Subject, of } from 'rxjs';
import { takeUntil, map, catchError } from 'rxjs/operators';
import { DisciplineService } from '../../services/discipline.services';
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
          <div 
            *ngFor="let day of getCalendarGrid()" 
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
            
            <!-- Day Status -->
            <div class="day-status">
              <div class="status-indicator">
                <span *ngIf="day.isCompleted" class="status-icon completed">✓</span>
                <span *ngIf="day.isPartiallyCompleted && !day.isCompleted" class="status-icon partial">◐</span>
                <span *ngIf="day.isGraceUsed" class="status-icon grace">G</span>
                <span *ngIf="!day.isCompleted && !day.isPartiallyCompleted && !day.isGraceUsed && isPast(day.date)" class="status-icon missed">✗</span>
              </div>
            </div>

            <!-- Task List -->
            <div class="task-list" *ngIf="day.isCurrentMonth">
              <!-- Task Count -->
              <div class="task-count" *ngIf="day.tasks.length > 0">
                {{ day.completedHabits }}/{{ day.totalHabits }}
              </div>
              
              <!-- Individual Tasks -->
              <div class="task-items">
                <div 
                  *ngFor="let task of day.tasks" 
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
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 50px;
      text-align: center;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(100, 181, 246, 0.3);
      border-top: 3px solid #64b5f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .retry-btn {
      background: rgba(244, 67, 54, 0.2);
      border: 1px solid rgba(244, 67, 54, 0.4);
      color: #f44336;
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
      background: rgba(30, 30, 60, 0.4);
      border: 1px solid rgba(100, 181, 246, 0.3);
      border-radius: 10px;
      padding: 20px;
      text-align: center;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #64b5f6;
      margin-bottom: 5px;
    }

    .stat-label {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.9rem;
    }

    .calendar-container {
      background: rgba(30, 30, 60, 0.2);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(100, 181, 246, 0.2);
    }

    .calendar-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      margin-bottom: 15px;
    }

    .day-header {
      text-align: center;
      font-weight: 600;
      color: #64b5f6;
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
    .status-icon.missed { color: #f44336; }

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

  constructor(
    private disciplineService: DisciplineService,
    private habitService: HabitService
  ) {
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

      return {
        date: dateStr,
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
      
/*       return this.disciplineService.getDay(dateStr)
        .pipe(
          map((disciplineDay: any) => this.mapToMonthlyDayData(disciplineDay, date)),
          catchError(error => {
            console.error(`Error fetching data for ${dateStr}:`, error);
            return of(this.createEmptyDayData(date));
          }),
          takeUntil(this.destroy$)
        ); */
    });

    forkJoin(dayRequests).subscribe({
      next: (days) => {
        this.calendarDays = days;
        this.monthlyStats = this.calculateStats();
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
      date: dateStr,
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
      rewards: disciplineDay.rewards?.map((r: any) => r.description) || []
    };
  }

  private createEmptyDayData(date: Date): MonthlyDayData {
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    
    return {
      date: dateStr,
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

    // Calculate longest streak
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
    };
  }

  getCalendarGrid(): MonthlyDayData[] {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const grid: MonthlyDayData[] = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const dateStr = `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}-${current.getDate().toString().padStart(2, '0')}`;
      
      const existingDay = this.calendarDays.find(d => d.date === dateStr);
      if (existingDay) {
        existingDay.isCurrentMonth = current.getMonth() === this.currentMonth;
        grid.push(existingDay);
      } else {
        grid.push({
          date: dateStr,
          dayNumber: current.getDate(),
          isCurrentMonth: current.getMonth() === this.currentMonth,
          isToday: this.isToday(current),
          isCompleted: false,
          isPartiallyCompleted: false,
          isGraceUsed: false,
          completedHabits: 0,
          totalHabits: 0,
          tasks: [],
          completedTasks: [],
          hasWarnings: false,
          rewards: []
        });
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return grid;
  }

  toggleTask(taskName: string, date: string, event: Event): void {
    event.stopPropagation();
    
    const day = this.calendarDays.find(d => d.date === date);
    if (!day || this.isFutureDate(date)) {
      return;
    }

    const isCurrentlyCompleted = day.completedTasks.includes(taskName);
    const newCompletionState = !isCurrentlyCompleted;
    
    // Optimistically update UI
    if (newCompletionState) {
      if (!day.completedTasks.includes(taskName)) {
        day.completedTasks.push(taskName);
      }
    } else {
      day.completedTasks = day.completedTasks.filter(t => t !== taskName);
    }
    
    day.completedHabits = day.completedTasks.length;
    day.isCompleted = day.completedHabits === day.totalHabits;
    
    // Save to server
    this.saveTaskCompletion(taskName, date, newCompletionState);
  }

  private saveTaskCompletion(taskName: string, date: string, isCompleted: boolean): void {
    const taskToHabitId: { [key: string]: number } = {
      'Phone Lock Box': 1,
      'Clean Dishes': 2,
      'Gym Workout': 3,
      'Vacuum & Sweep': 4,
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

    if (isCompleted) {
      this.habitService.completeHabit({
        habitId: habitId,
        date: date,
        notes: `Completed via monthly calendar`
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log(`Successfully saved ${taskName} for ${date}`);
        },
        error: (error) => {
          console.error(`Error saving ${taskName} for ${date}:`, error);
          this.revertTaskCompletion(taskName, date);
          alert('Failed to save. Please try again.');
        }
      });
    } else {
      console.log(`Cannot uncomplete habit ${taskName} - API doesn't support uncompleting`);
      alert('Habit completion cannot be undone through this interface');
      // Revert the UI change
      this.revertTaskCompletion(taskName, date);
    }
  }

  private revertTaskCompletion(taskName: string, date: string): void {
    const day = this.calendarDays.find(d => d.date === date);
    if (day) {
      const taskIndex = day.completedTasks.indexOf(taskName);
      if (taskIndex > -1) {
        day.completedTasks.splice(taskIndex, 1);
      } else {
        day.completedTasks.push(taskName);
      }
      day.completedHabits = day.completedTasks.length;
      day.isCompleted = day.completedHabits === day.totalHabits;
    }
  }

  getTaskInitial(taskName: string): string {
    return taskName.charAt(0);
  }

  isFutureDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  }

  isPast(dateStr: string): boolean {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
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