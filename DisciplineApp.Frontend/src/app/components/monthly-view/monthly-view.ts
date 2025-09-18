import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DisciplineService } from '../../services/discipline.services';
import { 
  MonthlyStats,  
  StreakInfo,
  DayData,
  HabitWithFlexibility,
  ScheduledHabit,
  WeekData
} from '../../models/discipline.models';

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
  tasks: ScheduledHabit[];
  completionPercentage: number;
  isFuture: boolean;
  projectedReward?: ProjectedReward;
  flexibilityUsage?: FlexibilityDayInfo;
  isBeforeStreakStart?: boolean;
}

interface ProjectedReward {
  day: number;
  daysUntil: number;
  tier: number;
  icon: string;
  name: string;
  color: string;
  isAchievable: boolean;
  description: string;
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
  private streakStartDate = new Date('2025-09-14');

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

  // Get today's real-time data and real historical data for past days
  const today = new Date();
  const isCurrentMonth = today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear;

  if (isCurrentMonth) {
    // Get the entire current week's real data (includes today and recent past days)
    this.disciplineService.getCurrentWeek()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (weekData: WeekData) => {
          // Generate calendar with real week data
          this.generateCalendarWithRealData(weekData);
          this.calculateProjectedRewards();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading week data:', error);
          this.generateCalendarWithTodayData(null);
          this.loading = false;
        }
      });
  } else {
    // For other months, generate calendar without real-time data
    this.generateCalendarWithTodayData(null);
    this.loading = false;
  }

  

  this.loadMonthlyStats();
}

// Update the generateCalendarWithRealData method:

private generateCalendarWithRealData(weekData: WeekData): void {
  // First generate the calendar structure
  this.generateCalendarWithTodayData(null);
  
  // Then update with real data from the week API
  weekData.days.forEach(weekDay => {
    const matchingDay = this.calendarDays.find(calDay => {
      const calendarDateStr = calDay.dateString;
      const weekDayDateStr = weekDay.date;
      
      console.log(`Comparing: Calendar[${calendarDateStr}] vs Week[${weekDayDateStr}]`);
      return calendarDateStr === weekDayDateStr;
    });
    
    if (matchingDay && matchingDay.isCurrentMonth) {
      console.log(`Updating day ${matchingDay.dayNumber} with real data: ${weekDay.completedHabits}/${weekDay.totalHabits}`);
      
      // Update with real completion data
      matchingDay.completedHabits = weekDay.completedHabits || 0;
      matchingDay.totalHabits = weekDay.totalHabits || 0;
      matchingDay.completionPercentage = matchingDay.totalHabits > 0 ? 
        Math.round((matchingDay.completedHabits / matchingDay.totalHabits) * 100) : 0;
      
      // 🔥 CRITICAL: TODAY is always IN-PROGRESS, past days are binary complete/fail
      if (matchingDay.isToday) {
        // Today: Show progress (partial diamond) regardless of completion
        matchingDay.isCompleted = false;
        matchingDay.isPartiallyCompleted = matchingDay.totalHabits > 0;
      } else if (!matchingDay.isFuture) {
        // Past days: Binary complete/fail logic
        if (matchingDay.totalHabits > 0) {
          matchingDay.isCompleted = (matchingDay.completedHabits === matchingDay.totalHabits);
          matchingDay.isPartiallyCompleted = false;
        } else {
          matchingDay.isCompleted = true; // Free days are complete
          matchingDay.isPartiallyCompleted = false;
        }
      }
      // Future days keep their default false values
    }
  });
}

  private generateCalendarWithTodayData(todayData: DayData | null): void {
    const calendar: MonthlyDayData[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0); // Last day of current month
    const today = new Date();

    // Calculate the first Monday to display (may be from previous month)
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    startDate.setDate(firstDay.getDate() + mondayOffset);

    // Calculate the last Sunday to display (may be from next month)
    const endDate = new Date(lastDay);
    const endDayOfWeek = lastDay.getDay();
    const sundayOffset = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
    endDate.setDate(lastDay.getDate() + sundayOffset);

    // Calculate total days needed (this will be 28, 35, or 42 depending on the month)
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Generate the required number of days
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const dateString = currentDate.toISOString().split('T')[0];
      const isCurrentMonth = currentDate.getMonth() === this.currentMonth;
      const isToday = currentDate.toDateString() === today.toDateString();
      const isFuture = currentDate > today;

      // Initialize day data
      let dayData: MonthlyDayData = {
        date: currentDate,
        dateString: dateString,
        dayNumber: currentDate.getDate(),
        isCurrentMonth: isCurrentMonth,
        isToday: isToday,
        isCompleted: false,
        isPartiallyCompleted: false,
        completedHabits: 0,
        totalHabits: 0,
        requiredHabitsCount: 0,
        completedRequiredCount: 0,
        tasks: [],
        completionPercentage: 0,
        isFuture: isFuture,
        projectedReward: undefined,
        flexibilityUsage: undefined,
        isBeforeStreakStart: currentDate < this.streakStartDate
      };

      // If this is today and we have real data, use it
      if (isToday && todayData) {
        dayData.isCompleted = todayData.isCompleted || false;
        dayData.isPartiallyCompleted = todayData.isPartiallyCompleted || false;
        dayData.completedHabits = todayData.completedHabits || 0;
        dayData.totalHabits = todayData.totalHabits || 0;
        dayData.completionPercentage = dayData.totalHabits > 0 ? 
          Math.round((dayData.completedHabits / dayData.totalHabits) * 100) : 0;
      } else if (isCurrentMonth && !isFuture && !dayData.isBeforeStreakStart) {
        // For past days in current month, generate mock data
        const dayOfYear = this.getDayOfYear(currentDate);
        const seed = dayOfYear;
        
        const totalTasks = 4 + (seed % 4); // 4-7 tasks per day
        const completionRate = 0.6 + ((seed % 40) / 100); // 60-99% completion rate
        const completedTasks = Math.floor(totalTasks * completionRate);
        
        dayData.totalHabits = totalTasks;
        dayData.completedHabits = completedTasks;
        dayData.completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        dayData.isCompleted = completedTasks === totalTasks;
        dayData.isPartiallyCompleted = completedTasks > 0 && completedTasks < totalTasks;
      }

      // Calculate projected rewards for current month days
      if (isCurrentMonth && isFuture) {
        dayData.projectedReward = this.calculateProjectedRewardForDay(currentDate);
      }

      calendar.push(dayData);
    }

    this.calendarDays = calendar;
  }

  private loadMonthlyStats(): void {
    // Calculate monthly stats based on actual calendar data
    const currentMonthDays = this.calendarDays.filter(day => 
      day.isCurrentMonth && !day.isFuture && !day.isBeforeStreakStart
    );
    
    const completedDays = currentMonthDays.filter(day => day.isCompleted).length;
    const totalDays = currentMonthDays.length;
    const totalHabits = currentMonthDays.reduce((sum, day) => sum + day.totalHabits, 0);
    const completedHabits = currentMonthDays.reduce((sum, day) => sum + day.completedHabits, 0);

    this.monthlyStats = {
      completionRate: totalDays > 0 ? (completedDays / totalDays) * 100 : 0,
      completedDays,
      totalDays,
      currentStreak: this.calculateCurrentStreak(),
      totalHabits,
      averageCompletionRate: totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0
    };
  }

  private calculateCurrentStreak(): number {
    let streak = 0;
    const today = new Date();
    
    // Start from today and work backwards, but only count days from streak start
    for (let i = this.calendarDays.length - 1; i >= 0; i--) {
      const day = this.calendarDays[i];
      
      // Skip days that are not current month, future days, or before streak start
      if (day.date > today || !day.isCurrentMonth || day.isBeforeStreakStart) continue;
      
      // If day is not completed, break the streak
      if (!day.isCompleted) break;
      
      streak++;
    }
    
    return streak;
  }

  // ===================================
  // REWARD CALCULATION METHODS
  // ===================================

  private calculateProjectedRewards(): void {
    this.projectedRewards = [];
    const currentStreak = this.calculateCurrentStreak();
    
    for (const reward of this.rewardSchedule) {
      if (currentStreak < reward.day) {
        const daysUntilReward = reward.day - currentStreak;
        const rewardTier = this.rewardTiers[reward.tier];
        
        this.projectedRewards.push({
          day: reward.day,
          daysUntil: daysUntilReward,
          tier: reward.tier,
          icon: rewardTier.icon,
          name: rewardTier.name,
          color: rewardTier.color,
          isAchievable: daysUntilReward <= 31, // Within current month
          description: this.getRewardDescription(reward.day, rewardTier.name)
        });
      }
    }
    
    // Sort by days until reward
    this.projectedRewards.sort((a, b) => a.daysUntil - b.daysUntil);
    
    // Take only the next 3 rewards
    this.projectedRewards = this.projectedRewards.slice(0, 3);
  }

  private calculateProjectedRewardForDay(date: Date): ProjectedReward | undefined {
    const currentStreak = this.monthlyStats?.currentStreak || 0;
    const today = new Date();
    const daysFromToday = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const projectedStreak = currentStreak + daysFromToday;
    
    // Check if this projected streak hits any reward milestones
    const rewardMilestone = this.rewardSchedule.find(r => r.day === projectedStreak);
    if (rewardMilestone) {
      const rewardType = this.rewardTiers[rewardMilestone.tier];
      if (rewardType) {
        return {
          day: projectedStreak,
          daysUntil: daysFromToday,
          tier: rewardMilestone.tier,
          icon: rewardType.icon,
          name: rewardType.name,
          color: rewardType.color,
          isAchievable: true,
          description: `${rewardType.name} in ${daysFromToday} days`
        };
      }
    }
    
    return undefined;
  }

  private getRewardDescription(day: number, rewardName: string): string {
    const descriptions: Record<number, string> = {
      7: 'Enjoy a premium coffee or tea of your choice',
      14: 'Pick out a new book or audiobook to enjoy',
      30: 'Treat yourself to some new clothes or accessories',
      60: 'A bigger milestone reward - something you\'ve been wanting',
      90: 'Tennis racket, quality headphones, or similar hobby item',
      120: 'Another significant milestone reward',
      180: 'Music festival, concert, or entertainment experience',
      365: 'A special trip or major experience reward'
    };
    
    return descriptions[day] || `Enjoy your ${rewardName}!`;
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

  getMonthName(): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[this.currentMonth];
  }

  getWeekDays(): string[] {
    return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  }

  getDayCompletionClass(day: MonthlyDayData): string {
    if (day.isCompleted) return 'completed';
    if (day.isPartiallyCompleted) return 'partial';
    if (day.totalHabits === 0) return 'free';
    return 'incomplete';
  }

  onDayClick(day: MonthlyDayData): void {
    if (!day.isCurrentMonth || day.isFuture) {
      return;
    }
    
    console.log('Day clicked:', day);
    // Handle day click - could open a modal, navigate to daily view, etc.
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}