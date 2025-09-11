import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeeklyProgress } from '../../services/discipline.services';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  // providers: [HabitService],
  template: `
    <div class="calendar-container">
      <!-- Title -->
      <h1 class="calendar-title">2025 Discipline Calendar</h1>
      
      <!-- Smart Reminders Panel -->
      <div *ngIf="reminders.length > 0" class="reminders-panel">
        <h3>Smart Reminders</h3>
        <div *ngFor="let reminder of reminders" class="reminder-item">
          {{ reminder }}
        </div>
      </div>
      
      <!-- Loading State -->
      <div *ngIf="loading" class="loading">
        <div class="loading-spinner"></div>
        <p>Loading your discipline calendar...</p>
      </div>
      
      <!-- Error State -->
      <div *ngIf="error" class="error">
        <p>{{ error }}</p>
        <button (click)="loadCalendar()" class="retry-btn">Try Again</button>
      </div>
      
      <!-- Calendar Grid -->
      <div *ngIf="monthsData.length > 0 && !loading" class="year-grid">
        <div *ngFor="let month of monthsData; let monthIndex = index" class="month-container">
          <h3 class="month-title">{{ getMonthName(monthIndex + 1) }}</h3>
          
          <!-- Day Headers -->
          <div class="day-headers">
            <span class="day-header">MON</span>
            <span class="day-header">TUE</span>
            <span class="day-header">WED</span>
            <span class="day-header">THU</span>
            <span class="day-header">FRI</span>
            <span class="day-header">SAT</span>
            <span class="day-header">SUN</span>
          </div>
          
          <!-- Month Grid -->
          <div class="month-grid">
            <!-- Empty cells for proper week alignment -->
            <div *ngFor="let empty of getEmptyCells(monthIndex + 1)" class="empty-cell"></div>
            
            <!-- Day cells -->
            <div 
              *ngFor="let day of month" 
              class="day-cell"
              [class.completed]="day.isCompleted"
              [class.grace-used]="day.isGraceUsed"
              [class.has-warnings]="day.warnings.length > 0"
              (click)="onDayClicked(day)"
              [title]="getDayTooltip(day)">
              
              <span class="day-number">{{ getDayNumber(day.date) }}</span>
              
              <!-- Status indicators -->
              <div class="status-indicators">
                <span *ngIf="day.isCompleted && !day.isGraceUsed" class="status-complete">✓</span>
                <span *ngIf="day.isGraceUsed" class="status-grace">G</span>
                <span *ngIf="day.warnings.length > 0" class="status-warning">!</span>
              </div>
              
              <!-- Progress bar for partial completion -->
              <div class="progress-bar" *ngIf="!day.isCompleted">
                <div class="progress-fill" [style.width.%]="getCompletionPercentage(day)"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Day Detail Modal -->
      <div *ngIf="selectedDay" class="day-detail-modal" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ formatDate(selectedDay.date) }}</h3>
            <button class="close-btn" (click)="closeModal()">&times;</button>
          </div>
          
          <div class="modal-body">
            <!-- Day Status -->
            <div class="day-status">
              <span *ngIf="selectedDay.isCompleted" class="status-badge completed">Day Completed</span>
              <span *ngIf="selectedDay.isGraceUsed" class="status-badge grace">Grace Day Used</span>
              <span *ngIf="!selectedDay.isCompleted && !selectedDay.isGraceUsed" class="status-badge incomplete">Incomplete</span>
            </div>
            
            <!-- Warnings -->
            <div *ngIf="selectedDay.warnings.length > 0" class="warnings">
              <h4>Warnings</h4>
              <div *ngFor="let warning of selectedDay.warnings" class="warning-item">
                {{ warning }}
              </div>
            </div>
            
            <!-- Recommendations -->
            <div *ngIf="selectedDay.recommendations.length > 0" class="recommendations">
              <h4>Recommendations</h4>
              <div *ngFor="let rec of selectedDay.recommendations" class="recommendation-item">
                {{ rec }}
              </div>
            </div>
            
            <!-- Habit List -->
            <div class="habits-list">
              <h4>Habits for This Day</h4>
              <div *ngFor="let habit of selectedDay.habitStatuses" class="habit-item">
                <div class="habit-header">
                  <span class="habit-name">{{ habit.habitName }}</span>
                  <span class="habit-status" [class]="habit.status.toLowerCase().replace(' ', '-')">
                    {{ habit.status }}
                  </span>
                </div>
                
                <div class="habit-details">
                  <span *ngIf="habit.isRequired" class="required-badge">Required</span>
                  <span *ngIf="!habit.isRequired" class="optional-badge">Optional</span>
                  
                  <span *ngIf="habit.currentWindowCount > 0" class="progress-info">
                    {{ habit.currentWindowCount }}/{{ habit.requiredWindowCount }}
                  </span>
                  
                  <button 
                    *ngIf="!habit.isCompleted" 
                    class="complete-btn"
                    (click)="completeHabit(habit.habitId, selectedDay.date)">
                    Mark Complete
                  </button>
                  
                  <span *ngIf="habit.isCompleted" class="completed-badge">✓ Done</span>
                </div>
              </div>
            </div>
            
            <!-- Grace Day Option -->
            <div *ngIf="selectedDay.canUseGrace && !selectedDay.isCompleted" class="grace-option">
              <button class="grace-btn" (click)="useGraceDay(selectedDay.date)">
                Use Weekly Grace Day
              </button>
              <small>Grace days remaining this week: {{ weeklyProgress?.graceRemaining || 0 }}</small>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Weekly Progress Panel -->
      <div *ngIf="weeklyProgress && !loading" class="weekly-progress">
        <h2 class="section-title">Weekly Progress</h2>
        <div class="progress-stats">
          <div class="stat-card">
            <div class="stat-number">{{ weeklyProgress.graceRemaining }}</div>
            <div class="stat-label">Grace Days Left</div>
          </div>
          
          <div *ngFor="let habit of weeklyProgress.habitProgress" class="habit-progress-card">
            <div class="habit-name">{{ habit.habitName }}</div>
            <div class="progress-bar-container">
              <div class="progress-bar">
                <div class="progress-fill" 
                     [style.width.%]="(habit.completedCount / habit.requiredCount) * 100"
                     [class.urgent]="habit.urgency === 'Urgent'"
                     [class.critical]="habit.urgency === 'Critical'"></div>
              </div>
              <span class="progress-text">{{ habit.completedCount }}/{{ habit.requiredCount }}</span>
            </div>
            <div class="urgency-badge" [class]="habit.urgency.toLowerCase()">
              {{ habit.urgency }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #0f0f23, #1a1a2e);
      color: #e0e0e0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 20px;
    }

    .calendar-title {
      text-align: center;
      font-size: 3.5rem;
      font-weight: 300;
      margin-bottom: 40px;
      background: linear-gradient(45deg, #64b5f6, #42a5f5, #2196f3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-transform: uppercase;
    }

    .reminders-panel {
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 30px;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .reminder-item {
      background: rgba(255, 193, 7, 0.2);
      padding: 10px;
      margin: 5px 0;
      border-radius: 5px;
      border-left: 4px solid #ffc107;
    }

    .year-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 30px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .month-container {
      background: rgba(20, 20, 40, 0.5);
      border-radius: 15px;
      padding: 20px;
      border: 1px solid rgba(100, 150, 255, 0.2);
      backdrop-filter: blur(10px);
    }

    .month-title {
      text-align: center;
      font-size: 1.4rem;
      font-weight: 600;
      margin-bottom: 15px;
      color: #64b5f6;
    }

    .day-headers {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
      margin-bottom: 5px;
    }

    .day-header {
      text-align: center;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 8px 4px;
      color: #90caf9;
    }

    .month-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
    }

    .empty-cell {
      width: 35px;
      height: 35px;
    }

    .day-cell {
      width: 35px;
      height: 35px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
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
      background: rgba(76, 175, 80, 0.3);
      border-color: rgba(76, 175, 80, 0.6);
    }

    .day-cell.grace-used {
      background: rgba(255, 193, 7, 0.3);
      border-color: rgba(255, 193, 7, 0.6);
    }

    .day-cell.has-warnings {
      border-color: rgba(255, 87, 34, 0.6);
    }

    .day-number {
      font-size: 12px;
      font-weight: 500;
      z-index: 1;
    }

    .status-indicators {
      position: absolute;
      top: 2px;
      right: 2px;
      display: flex;
      gap: 1px;
    }

    .status-complete { color: #4caf50; font-size: 8px; }
    .status-grace { color: #ffc107; font-size: 7px; font-weight: bold; }
    .status-warning { color: #ff5722; font-size: 8px; }

    .progress-bar {
      position: absolute;
      bottom: 2px;
      left: 2px;
      right: 2px;
      height: 2px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 1px;
    }

    .progress-fill {
      height: 100%;
      background: #64b5f6;
      border-radius: 1px;
      transition: width 0.3s ease;
    }

    .progress-fill.urgent { background: #ff9800; }
    .progress-fill.critical { background: #f44336; }

    /* Modal Styles */
    .day-detail-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: #1e1e3c;
      border-radius: 15px;
      padding: 0;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      border: 1px solid rgba(100, 150, 255, 0.3);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid rgba(100, 150, 255, 0.2);
    }

    .close-btn {
      background: none;
      border: none;
      color: #90caf9;
      font-size: 24px;
      cursor: pointer;
    }

    .modal-body {
      padding: 20px;
    }

          .day-status {
            margin-bottom: 20px;
          }
        `]
    })
    export class CalendarComponent implements OnInit {
      // Properties
      reminders: string[] = [];
      loading: boolean = false;
      error: string | null = null;
      monthsData: any[] = [];
      selectedDay: any = null;
      weeklyProgress?: WeeklyProgress;
    
      constructor() {}
    
      ngOnInit(): void {
        this.loadCalendar();
      }
    
      // Methods
      loadCalendar(): void {
        this.loading = true;
        this.error = null;
    
        // Simulate loading data (replace with actual service call)
        setTimeout(() => {
          this.loading = false;
          this.monthsData = this.generateMockMonthsData();
          this.reminders = ['Drink water', 'Exercise', 'Read a book'];
          this.weeklyProgress = {
            weekStart: '2025-01-06',
            weekEnd: '2025-01-12',
            graceRemaining: 2,
            graceUsed: 0,
            habitProgress: [
              { habitId: 1, habitName: 'Exercise', completedCount: 3, requiredCount: 5, urgency: 'Urgent', remainingDays: 2, isAchievable: true },
              { habitId: 2, habitName: 'Meditation', completedCount: 2, requiredCount: 7, urgency: 'Critical', remainingDays: 5, isAchievable: false },
            ],
          };
        }, 1000);
      }
    
      getMonthName(monthIndex: number): string {
        const monthNames = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        return monthNames[monthIndex - 1];
      }
    
      getEmptyCells(monthIndex: number): number[] {
        // Simulate empty cells for alignment (replace with actual logic)
        return Array.from({ length: monthIndex % 7 });
      }
    
      onDayClicked(day: any): void {
        this.selectedDay = day;
      }
    
      getDayTooltip(day: any): string {
        return `Day: ${day.date}, Completed: ${day.isCompleted}`;
      }
    
      getDayNumber(date: string): number {
        return new Date(date).getDate();
      }
    
      getCompletionPercentage(day: any): number {
        return (day.completedTasks / day.totalTasks) * 100;
      }
    
      formatDate(date: string): string {
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(date).toLocaleDateString(undefined, options);
      }
    
      closeModal(): void {
        this.selectedDay = null;
      }
    
      completeHabit(habitId: string, date: string): void {
        console.log(`Habit ${habitId} completed on ${date}`);
      }
    
      useGraceDay(date: string): void {
        console.log(`Grace day used on ${date}`);
      }
    
      private generateMockMonthsData(): any[] {
        // Simulate mock data for months (replace with actual data)
        return Array.from({ length: 12 }, (_, monthIndex) => {
          return Array.from({ length: 30 }, (_, dayIndex) => ({
            date: `2025-${monthIndex + 1}-${dayIndex + 1}`,
            isCompleted: Math.random() > 0.7,
            isGraceUsed: Math.random() > 0.9,
            warnings: Math.random() > 0.8 ? ['Warning 1', 'Warning 2'] : [],
            completedTasks: Math.floor(Math.random() * 10),
            totalTasks: 10,
          }));
        });
      }
    }