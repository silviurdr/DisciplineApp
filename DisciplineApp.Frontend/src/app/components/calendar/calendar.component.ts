import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisciplineService } from '../../services/discipline.services';
import { DayCellComponent } from '../day-cell/day-cell.component';
import { YearCalendar, CalendarDay, MonthData } from '../../models/discipline.models';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCoffee, faTshirt, faTableTennis } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, DayCellComponent, FontAwesomeModule],
  template: `
    <div class="calendar-container">
      <!-- Title -->
      <h1 class="calendar-title">{{ calendar?.year }} Discipline Calendar</h1>

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
      <div *ngIf="calendar && !loading" class="year-grid">
        <div *ngFor="let month of calendar.months" class="month-container">
          <h3 class="month-title">{{ month.monthName }}</h3>
          
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
            <div *ngFor="let empty of getEmptyCells(month)" class="empty-cell"></div>
            
            <!-- Day cells -->
            <app-day-cell 
              *ngFor="let day of month.days"
              [day]="day"
              (dayClicked)="onDayClicked($event)">
            </app-day-cell>
          </div>
        </div>
      </div>
      
      <!-- Streak Info Panel -->
      <div *ngIf="calendar?.streakInfo && !loading" class="streak-info">
        <h2 class="streak-title">Discipline Streaks</h2>
        <div class="streak-stats">
          <div class="stat-card">
            <div class="stat-number">{{ calendar?.streakInfo?.currentStreak }}</div>
            <div class="stat-label">Current Streak</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ calendar?.streakInfo?.longestStreak }}</div>
            <div class="stat-label">Best Streak</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ calendar?.streakInfo?.totalDays }}</div>
            <div class="stat-label">Total Days</div>
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

    .icons-section {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 20px;
    }

    .icon {
      font-size: 2rem;
      color: #ffd700;
    }

    .calendar-title {
      text-align: center;
      font-size: 2rem;
      font-weight: 300;
      margin-bottom: 40px;
      letter-spacing: 4px;
      background: linear-gradient(45deg, #64b5f6, #42a5f5, #2196f3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-transform: uppercase;
      overflow: visible; /* Ensure the title is not clipped */
      white-space: nowrap; /* Prevent text wrapping */
      height: 60px; /* Fixed height to prevent layout shift */
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(100, 181, 246, 0.3);
      border-radius: 50%;
      border-top-color: #64b5f6;
      animation: spin 1s ease-in-out infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      text-align: center;
      padding: 40px;
      color: #ff6b6b;
    }

    .retry-btn {
      background: #64b5f6;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      margin-top: 10px;
    }

    .retry-btn:hover {
      background: #42a5f5;
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
      letter-spacing: 2px;
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
      letter-spacing: 1px;
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

    .streak-info {
      margin-top: 40px;
      text-align: center;
      background: rgba(20, 20, 40, 0.7);
      border-radius: 15px;
      padding: 30px;
      border: 1px solid rgba(100, 150, 255, 0.2);
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .streak-title {
      font-size: 1.8rem;
      color: #64b5f6;
      margin-bottom: 30px;
      font-weight: 300;
    }

    .streak-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
    }

    .stat-card {
      background: rgba(100, 181, 246, 0.1);
      border: 1px solid rgba(100, 181, 246, 0.3);
      border-radius: 10px;
      padding: 20px;
    }

    .stat-number {
      font-size: 2.5rem;
      font-weight: 600;
      color: #ffd700;
      margin-bottom: 5px;
    }

    .stat-label {
      font-size: 1rem;
      color: #90caf9;
      font-weight: 500;
    }

    @media (max-width: 1200px) {
      .year-grid { grid-template-columns: repeat(3, 1fr); }
    }
    
    @media (max-width: 900px) {
      .year-grid { grid-template-columns: repeat(2, 1fr); }
      .streak-stats { grid-template-columns: repeat(2, 1fr); }
    }
    
    @media (max-width: 600px) {
      .year-grid { grid-template-columns: 1fr; }
      .streak-stats { grid-template-columns: 1fr; }
      .calendar-title { font-size: 2.5rem; }
    }
  `]
})
export class CalendarComponent implements OnInit {
  calendar: YearCalendar | null = null;
  loading = true;
  error: string | null = null;

  constructor(private disciplineService: DisciplineService, private library: FaIconLibrary) {
    library.addIcons(faCoffee, faTshirt, faTableTennis);
  }

  ngOnInit(): void {
    this.loadCalendar();
  }

  loadCalendar(): void {
    this.loading = true;
    this.error = null;

    this.disciplineService.getCalendar(2025).subscribe({
      next: (data) => {
        this.calendar = data;
        this.loading = false;
      },
      error: (error) => {
        this.error = error;
        this.loading = false;
      }
    });
  }

onDayClicked(day: CalendarDay): void {
  console.log('Day clicked:', day);
  
  // Convert date string to proper ISO format for API
  const dateToSend = new Date(day.date).toISOString();
  
  this.disciplineService.toggleDay({ 
    date: dateToSend
  }).subscribe({
    next: (updatedDay) => {
      // Update the day in the calendar
      this.updateDayInCalendar(updatedDay);
      
      // Refresh streak info
      this.refreshStreakInfo();
    },
    error: (error) => {
      console.error('Error toggling day:', error);
    }
  });
}

  private updateDayInCalendar(updatedDay: CalendarDay): void {
    if (!this.calendar) return;

    for (const month of this.calendar.months) {
      const dayIndex = month.days.findIndex(d => d.date === updatedDay.date);
      if (dayIndex !== -1) {
        month.days[dayIndex] = updatedDay;
        break;
      }
    }
  }

  private refreshStreakInfo(): void {
    this.disciplineService.getStreakInfo().subscribe({
      next: (streakInfo) => {
        if (this.calendar) {
          this.calendar.streakInfo = streakInfo;
        }
      },
      error: (error) => {
        console.error('Error refreshing streak info:', error);
      }
    });
  }

  getEmptyCells(month: MonthData): any[] {
    const firstDay = new Date(month.year, month.month - 1, 1);
    const dayOfWeek = firstDay.getDay();
    const mondayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday = 0
    return new Array(mondayIndex);
  }
}