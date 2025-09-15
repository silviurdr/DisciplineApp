import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DisciplineService } from '../../services/discipline.services'; // Fixed import
import { 
  MonthlyStats, 
  ProjectedReward, 
  StreakInfo,
  DayData,
  HabitWithFlexibility 
} from '../../models/discipline.models'; // Updated imports

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
  requiredHabitsCount: number;
  completedRequiredCount: number;
  tasks: HabitWithFlexibility[]; // Updated to use flexible tasks
  completionPercentage: number;
  isFuture: boolean;
  projectedReward?: ProjectedReward;
  flexibilityUsage?: FlexibilityDayInfo;
}

interface FlexibilityDayInfo {
  totalDeferrals: number;
  criticalTasks: number;
  urgentTasks: number;
  tasksSavedByFlexibility: number;
}

interface RewardTier {
  tier: 1 | 2 | 3 | 4;
  icon: string;
  name: string;
  color: string;
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
  projectedRewards: ProjectedReward[] = [];
  loading = false;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  // Define reward tiers
  private rewardTiers: Record<number, RewardTier> = {
    1: { tier: 1, icon: '☕', name: 'Coffee Reward', color: '#8D6E63' },
    2: { tier: 2, icon: '📚', name: 'Book Reward', color: '#5C6BC0' },
    3: { tier: 3, icon: '👕', name: 'Clothing Reward', color: '#66BB6A' },
    4: { tier: 4, icon: '🎾', name: 'Tennis Reward', color: '#FFA726' }
  };

  // Define reward schedule with flexibility for 90+ days
  private rewardSchedule = [
    { day: 7, tier: 1 },    // Coffee
    { day: 14, tier: 2 },   // Book  
    { day: 30, tier: 3 },   // Clothing
    { day: 60, tier: 4 },   // Extended milestone
    { day: 90, tier: 4 },   // Tennis racket/Headphones (3 months)
    { day: 120, tier: 4 },  // Additional milestone
    { day: 180, tier: 4 },  // Music festival (6 months)
    { day: 365, tier: 4 }   // Trip (1 year)
  ];

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

  // ===================================
  // DATA LOADING METHODS
  // ===================================

loadMonthData(): void {
  this.loading = true;
  this.error = null;

  // Use the same approach as weekly view for current data
  const today = new Date();
  const isCurrentMonth = today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear;

  if (isCurrentMonth) {
    // For current month, get real-time data using the weekly endpoint
    this.loadCurrentMonthWithRealTimeData();
  } else {
    // For past/future months, use the month endpoint
    this.loadHistoricalMonthData();
  }
}

private loadCurrentMonthWithRealTimeData(): void {
  // Get the current week data (which has real-time info)
  this.disciplineService.getCurrentWeek()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (weekData) => {
        // Extract today's real-time data
        const today = new Date();
        const todayData = weekData.days.find(day => 
          new Date(day.date).toDateString() === today.toDateString()
        );

        // Now get the month data and merge with real-time today data
        this.disciplineService.getMonthData(this.currentYear, this.currentMonth + 1)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (monthData: DayData[]) => {
              // Replace today's data with real-time data from weekly view
              if (todayData) {
                const todayString = today.toISOString().split('T')[0];
                const todayIndex = monthData.findIndex(day => day.date.split('T')[0] === todayString);
                
                if (todayIndex !== -1) {
                  // Replace with real-time data
                  monthData[todayIndex] = {
                    ...monthData[todayIndex],
                    isCompleted: todayData.isCompleted,
                    isPartiallyCompleted: todayData.isPartiallyCompleted,
                    completedHabits: todayData.completedHabits,
                    totalHabits: todayData.totalHabits,
                    requiredHabitsCount: todayData.requiredHabitsCount || 0,
                    completedRequiredCount: todayData.completedRequiredCount || 0,
                    allHabits: todayData.allHabits || []
                  };
                }
              }

              this.processMonthData(monthData);
              this.calculateProjectedRewards();
              this.loading = false;
            },
            error: (error) => {
              console.error('Error loading month data:', error);
              this.error = 'Failed to load month data. Please try again.';
              this.loading = false;
            }
          });
      },
      error: (error) => {
        console.error('Error loading current week data:', error);
        // Fallback to month data only
        this.loadHistoricalMonthData();
      }
    });
}

private loadHistoricalMonthData(): void {
  // Use original month endpoint for non-current months
  this.disciplineService.getMonthData(this.currentYear, this.currentMonth + 1)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (monthData: DayData[]) => {
        this.processMonthData(monthData);
        this.calculateProjectedRewards();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading month data:', error);
        this.error = 'Failed to load month data. Please try again.';
        this.loading = false;
      }
    });

  // Load monthly stats
  this.disciplineService.getMonthlyStats(this.currentYear, this.currentMonth + 1)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (stats) => {
        this.monthlyStats = {
          completedDays: stats.completedDays || 0,
          totalDays: stats.totalDays || 0,
          completionRate: stats.completionRate || 0,
          currentStreak: stats.currentStreak || 0,
          totalHabits: stats.totalTasks || 0,
          averageCompletionRate: stats.taskCompletionRate || 0
        };
      },
      error: (error) => {
        console.error('Error loading monthly stats:', error);
      }
    });
}

  private processMonthData(monthData: DayData[]): void {
    this.calendarDays = this.generateCalendarGrid(monthData);
    this.calculateMonthlyStats();
  }

  private generateCalendarGrid(monthData: DayData[]): MonthlyDayData[] {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    
    // Adjust to start on Sunday
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: MonthlyDayData[] = [];
    const currentDate = new Date(startDate);
    
    // Generate 42 days (6 weeks) for a complete calendar grid
    for (let i = 0; i < 42; i++) {
      const dateString = currentDate.toISOString().split('T')[0];
      const isCurrentMonth = currentDate.getMonth() === this.currentMonth;
      
      // Find matching day data
      const dayData = monthData.find(d => d.date === dateString);
      
      days.push({
        date: new Date(currentDate),
        dateString,
        dayNumber: currentDate.getDate(),
        isCurrentMonth,
        isToday: this.isToday(currentDate),
        isCompleted: dayData?.isCompleted || false,
        isPartiallyCompleted: dayData?.isPartiallyCompleted || false,
        completedHabits: dayData?.completedHabits || 0,
        totalHabits: dayData?.totalHabits || 0,
        requiredHabitsCount: dayData?.requiredHabitsCount || 0,
        completedRequiredCount: dayData?.completedRequiredCount || 0,
        tasks: [], // Will be populated with flexible tasks if needed
        completionPercentage: this.calculateCompletionPercentage(dayData),
        isFuture: currentDate > new Date(),
        flexibilityUsage: this.calculateFlexibilityUsage(dayData)
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }

  private calculateCompletionPercentage(dayData: DayData | undefined): number {
    if (!dayData || dayData.totalHabits === 0) return 0;
    return Math.round((dayData.completedHabits / dayData.totalHabits) * 100);
  }

  private calculateFlexibilityUsage(dayData: DayData | undefined): FlexibilityDayInfo {
    if (!dayData || !dayData.allHabits) {
      return {
        totalDeferrals: 0,
        criticalTasks: 0,
        urgentTasks: 0,
        tasksSavedByFlexibility: 0
      };
    }

    const flexibleTasks = dayData.allHabits.filter(h => h.maxDeferrals && h.maxDeferrals > 0);
    
    return {
      totalDeferrals: flexibleTasks.reduce((sum, task) => sum + (task.deferralsUsed || 0), 0),
      criticalTasks: flexibleTasks.filter(task => 
        task.deferralsUsed === task.maxDeferrals
      ).length,
      urgentTasks: flexibleTasks.filter(task => 
        task.deferralsUsed && task.maxDeferrals && 
        (task.deferralsUsed / task.maxDeferrals) >= 0.66
      ).length,
      tasksSavedByFlexibility: flexibleTasks.filter(task => 
        task.deferralsUsed && task.deferralsUsed > 0 && task.isCompleted
      ).length
    };
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

  // ===================================
  // PROJECTED REWARDS CALCULATION
  // ===================================

  private async calculateProjectedRewards(): Promise<void> {
    try {
      const currentStreakInfo = await this.getCurrentStreakInfo();
      this.projectedRewards = [];
      
      if (!currentStreakInfo.lastCompletedDate || currentStreakInfo.currentStreak === 0) {
        return;
      }

      const today = new Date();
      const startProjectionDate = new Date(today);
      startProjectionDate.setDate(today.getDate() + 1);

      // Find upcoming reward milestones - INCREASED TO 120 DAYS
      const upcomingRewards = this.rewardSchedule.filter(reward => 
        reward.day > currentStreakInfo.currentStreak && 
        reward.day <= currentStreakInfo.currentStreak + 120 // Extended range
      );

      upcomingRewards.forEach(reward => {
        const daysUntilReward = reward.day - currentStreakInfo.currentStreak;
        const rewardDate = new Date(startProjectionDate);
        rewardDate.setDate(startProjectionDate.getDate() + daysUntilReward - 1);

        // Only show rewards within the current month view
        if (rewardDate.getMonth() === this.currentMonth && rewardDate.getFullYear() === this.currentYear) {
          this.projectedRewards.push({
            date: rewardDate,
            dateString: rewardDate.toISOString().split('T')[0],
            streakDay: reward.day,
            tier: this.rewardTiers[reward.tier]
          });
        }
      });

      this.applyProjectedRewardsToCalendar();
    } catch (error) {
      console.error('Error calculating projected rewards:', error);
    }
  }

private async getCurrentStreakInfo(): Promise<StreakInfo> {
  return new Promise((resolve) => {
    this.disciplineService.getStreakInfo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (streakInfo) => {
          resolve({
            currentStreak: streakInfo.currentStreak || 1,
            longestStreak: streakInfo.longestStreak || 0,
            totalDays: streakInfo.totalDays || 0,
            weeklyRewards: streakInfo.weeklyRewards || 0,
            monthlyRewards: streakInfo.monthlyRewards || 0,
            nextMilestone: streakInfo.nextMilestone,
            lastUpdate: streakInfo.lastUpdate,
            lastCompletedDate: new Date()
          });
        },
        error: () => {
          // Fallback object that matches StreakInfo interface
          resolve({
            currentStreak: 1,
            longestStreak: 0,
            totalDays: 0,
            weeklyRewards: 0,
            monthlyRewards: 0,
            lastCompletedDate: new Date()
          });
        }
      });
  });
}

  private applyProjectedRewardsToCalendar(): void {
    this.projectedRewards.forEach(reward => {
      const dayData = this.calendarDays.find(d => d.dateString === reward.dateString);
      if (dayData) {
        dayData.projectedReward = reward;
      }
    });
  }

  // ===================================
  // NAVIGATION METHODS
  // ===================================

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

  // ===================================
  // UTILITY METHODS
  // ===================================

  getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  }

  getDayStatusClass(day: MonthlyDayData): string {
    const classes = [];
    
    if (day.isFuture) classes.push('future');
    if (day.isCompleted) classes.push('completed');
    if (day.isPartiallyCompleted) classes.push('partial');
    if (day.totalHabits > 0 && day.completedHabits === 0) classes.push('missed');
    
    // Add flexibility classes
    if (day.flexibilityUsage) {
      if (day.flexibilityUsage.criticalTasks > 0) classes.push('has-critical-tasks');
      if (day.flexibilityUsage.urgentTasks > 0) classes.push('has-urgent-tasks');
      if (day.flexibilityUsage.tasksSavedByFlexibility > 0) classes.push('flexibility-saved');
    }
    
    return classes.join(' ');
  }

  getStatusIcon(day: MonthlyDayData): string {
    if (day.isFuture) return '';
    if (day.isCompleted) return '✓';
    if (day.isPartiallyCompleted) return '◐';
    if (day.totalHabits > 0 && day.completedHabits === 0) return '✗';
    return '';
  }

  getProjectedReward(day: MonthlyDayData): ProjectedReward | null {
    return day.projectedReward || null;
  }

  getRewardDisplayText(reward: ProjectedReward): string {
    return `Day ${reward.streakDay} - ${reward.tier.name}`;
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  }

  // ===================================
  // EVENT HANDLERS
  // ===================================

  onDayClick(day: MonthlyDayData): void {
    if (!day.isCurrentMonth || day.isFuture) return;
    
    if (day.projectedReward) {
      console.log('Clicked reward day:', day.projectedReward);
    } else {
      console.log('Day clicked:', day);
    }
  }

  // ===================================
  // DEBUG METHODS
  // ===================================

  debugRewardsSystem(): void {
    console.log('🔍 REWARDS DEBUG:');
    console.log('Current month:', this.currentMonth);
    console.log('Current year:', this.currentYear);
    console.log('Calendar days generated:', this.calendarDays.length);
    console.log('Projected rewards:', this.projectedRewards);
    console.log('Monthly stats:', this.monthlyStats);
    
    const daysWithRewards = this.calendarDays.filter(d => d.projectedReward);
    console.log('Days with projected rewards:', daysWithRewards);
    
    const completedDays = this.calendarDays.filter(d => d.isCompleted);
    console.log('Completed days this month:', completedDays.length);
  }
}