// Updated monthly-view.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, map, catchError } from 'rxjs/operators';
import { DisciplineService } from '../../services/discipline.services';

interface MonthlyDayData {
  date: Date;
  dateString: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isCompleted: boolean;
  isPartiallyCompleted: boolean;
  completedHabits: number;
  totalHabits: number;
  tasks: any[];
  completionPercentage: number;
  isFuture: boolean;
}

interface MonthlyStats {
  completedDays: number;
  totalDays: number;
  completionRate: number;
  currentStreak: number;
  totalHabits: number;
}

@Component({
  selector: 'app-monthly-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monthly-view.html',
  styleUrls: ['./monthly-view.scss']
})
export class MonthlyViewComponent implements OnInit, OnDestroy {
  currentMonth: number;
  currentYear: number;
  
  calendarDays: MonthlyDayData[] = [];
  monthlyStats: MonthlyStats | null = null;
  loading = false;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(private disciplineService: DisciplineService) {
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

  async loadMonthData(): Promise<void> {
  this.loading = true;
  this.error = null;
  
  try {
    console.log('🚀 Loading month data...');
    
    // Generate calendar grid for the month
    this.calendarDays = this.generateCalendarGrid();
    console.log(`📅 Generated ${this.calendarDays.length} calendar days`);
    
    // Load data for each week that intersects with this month
    const weeksInMonth = this.getWeeksInMonth();
    console.log(`📊 Found ${weeksInMonth.length} weeks in month`);
    
    const weekPromises = weeksInMonth.map(async (weekStart, index) => {
      console.log(`📥 Loading week ${index + 1} starting: ${weekStart.toISOString().split('T')[0]}`);
      
      try {
        const weekData = await this.disciplineService.getWeekData(
          weekStart.getFullYear(),
          weekStart.getMonth() + 1,
          weekStart.getDate()
        ).toPromise();
        
        console.log(`✅ Week ${index + 1} loaded successfully:`, weekData);
        return weekData;
      } catch (error) {
        console.error(`❌ Failed to load week ${index + 1}:`, error);
        return null;
      }
    });

    const weekDataArray = await Promise.all(weekPromises);
    console.log(`📊 Loaded ${weekDataArray.filter(w => w !== null).length} weeks successfully`);
    
    // Process the week data to populate our calendar days
    this.processWeekData(weekDataArray.filter(w => w !== null));
    
    // Calculate monthly statistics
    this.calculateMonthlyStats();
    
    console.log('✅ Month data loading completed');
    
  } catch (error) {
    console.error('❌ Error loading month data:', error);
    this.error = 'Failed to load monthly data. Please try again.';
  } finally {
    this.loading = false;
  }
}


  private generateCalendarGrid(): MonthlyDayData[] {
    const days: MonthlyDayData[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    
    // Calculate start date (might be from previous month to fill the grid)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Generate 42 days (6 weeks × 7 days)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === this.currentMonth;
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      const isFuture = date > today;
      
      days.push({
        date: date,
        dateString: date.toISOString().split('T')[0],
        dayNumber: date.getDate(),
        isCurrentMonth,
        isToday,
        isCompleted: false,
        isPartiallyCompleted: false,
        completedHabits: 0,
        totalHabits: 0,
        tasks: [],
        completionPercentage: 0,
        isFuture
      });
    }
    
    return days;
  }

  private getWeeksInMonth(): Date[] {
    const weeks: Date[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    
    // Start from the Monday of the week containing the first day
    let weekStart = new Date(firstDay);
    const dayOfWeek = weekStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    
    // Collect all week starts that intersect with this month
    while (weekStart <= lastDay) {
      weeks.push(new Date(weekStart));
      weekStart.setDate(weekStart.getDate() + 7);
    }
    
    return weeks;
  }

  private processWeekData(weekDataArray: any[]): void {
    weekDataArray.forEach(weekData => {
      if (!weekData?.dayStatuses) return;
      
      weekData.dayStatuses.forEach((dayStatus: any) => {
        const dayData = this.calendarDays.find(d => d.dateString === dayStatus.date);
        if (dayData) {
          dayData.totalHabits = dayStatus.requiredHabitsCount || 0;
          dayData.completedHabits = dayStatus.completedRequiredCount || 0;
          dayData.isCompleted = dayStatus.isCompleted || false;
          dayData.isPartiallyCompleted = dayStatus.isPartiallyCompleted || false;
          dayData.completionPercentage = dayData.totalHabits > 0 
            ? Math.round((dayData.completedHabits / dayData.totalHabits) * 100)
            : 0;
        }
      });
      
      // Also process individual day data to get task lists
      if (weekData.currentDay && weekData.currentDay.allHabits) {
        const currentDayData = this.calendarDays.find(d => 
          d.dateString === weekData.currentDay.date
        );
        if (currentDayData) {
          currentDayData.tasks = weekData.currentDay.allHabits;
        }
      }
    });
  }

  private calculateMonthlyStats(): void {
    const currentMonthDays = this.calendarDays.filter(d => 
      d.isCurrentMonth && !d.isFuture
    );
    
    const completedDays = currentMonthDays.filter(d => d.isCompleted).length;
    const totalDays = currentMonthDays.length;
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
    
    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    for (let i = currentMonthDays.length - 1; i >= 0; i--) {
      const day = currentMonthDays[i];
      if (day.date > today) continue;
      
      if (day.isCompleted) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    const totalHabits = currentMonthDays.reduce((sum, day) => sum + day.totalHabits, 0);
    
    this.monthlyStats = {
      completedDays,
      totalDays,
      completionRate,
      currentStreak,
      totalHabits
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
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  }

  getDayStatusClass(day: MonthlyDayData): string {
    if (day.isFuture) return 'future';
    if (day.isCompleted) return 'completed';
    if (day.isPartiallyCompleted) return 'partial';
    if (day.totalHabits > 0 && day.completedHabits === 0) return 'missed';
    return '';
  }

  getStatusIcon(day: MonthlyDayData): string {
    if (day.isFuture) return '';
    if (day.isCompleted) return '✓';
    if (day.isPartiallyCompleted) return '◐';
    if (day.totalHabits > 0 && day.completedHabits === 0) return '✗';
    return '';
  }

  onDayClick(day: MonthlyDayData): void {
    if (!day.isCurrentMonth || day.isFuture) return;
    
    // You could implement day detail modal or navigation here
    console.log('Day clicked:', day);
  }
}