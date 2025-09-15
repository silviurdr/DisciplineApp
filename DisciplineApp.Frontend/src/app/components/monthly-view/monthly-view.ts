import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DisciplineService } from '../../services/discipline.services'; // Correct import with 's'
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
  isBeforeStreakStart?: boolean; // ADD THIS LINE
}

interface ProjectedReward {
  day: number;
  daysUntil: number;  // This property was missing
  tier: number;       // This should be number, not RewardTier
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
  private streakStartDate = new Date('2025-09-14'); // September 15th, 2025

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

    // Get today's real-time data and use mock data for other days
    const today = new Date();
    const isCurrentMonth = today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear;

    if (isCurrentMonth) {
      // Get today's real-time data from the weekly view API
      this.disciplineService.getCurrentWeek()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (weekData: WeekData) => {
            // Find today's data in the week response
            const todayData = weekData.days.find(day => 
              new Date(day.date).toDateString() === today.toDateString()
            );

            // Generate the calendar grid with today's real data
            this.generateCalendarWithTodayData(todayData || null);
            this.calculateProjectedRewards();
            this.loading = false;
          },
          error: (error) => {
            console.error('Error loading today data:', error);
            // Fallback to generating calendar without real-time data
            this.generateCalendarWithTodayData(null);
            this.loading = false;
          }
        });
    } else {
      // For past/future months, generate calendar without real-time data
      this.generateCalendarWithTodayData(null);
      this.loading = false;
    }

    // Load monthly stats
    this.loadMonthlyStats();
  }

private generateCalendarWithTodayData(todayData: DayData | null): void {
  const calendar: MonthlyDayData[] = [];
  const firstDay = new Date(this.currentYear, this.currentMonth, 1);
  const today = new Date();

  // Calculate the first Monday to display (may be from previous month)
  const startDate = new Date(firstDay);
  const dayOfWeek = firstDay.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startDate.setDate(firstDay.getDate() - mondayOffset);

  // Generate 42 days (6 weeks) for the calendar grid
  for (let i = 0; i < 42; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    const dateString = currentDate.toISOString().split('T')[0];
    const isCurrentMonth = currentDate.getMonth() === this.currentMonth;
    const isToday = currentDate.toDateString() === today.toDateString();
    const isFuture = currentDate > today;
    const isBeforeStreakStart = currentDate < this.streakStartDate;

    let dayData: DayData;

    // Use real data for today, mock data for other days
    if (isToday && todayData) {
      dayData = todayData;
    } else {
      // Create mock/empty data for other days
      dayData = {
        date: dateString,
        isCompleted: false,
        isPartiallyCompleted: false,
        completedHabits: 0,
        totalHabits: 0,
        requiredHabitsCount: 0,
        completedRequiredCount: 0,
        optionalHabitsCount: 0,
        completedOptionalCount: 0,
        canUseGrace: false,
        usedGrace: false,
        allHabits: [],
        warnings: [],
        recommendations: [],
        dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: isToday,
        isFuture: isFuture,
        isPast: currentDate < today && !isToday
      };
    }

    // Calculate completion metrics
    const completedHabits = dayData.completedHabits || 0;
    const totalHabits = dayData.totalHabits || 0;
    const requiredHabitsCount = dayData.requiredHabitsCount || 0;
    const completedRequiredCount = dayData.completedRequiredCount || 0;

    const completionPercentage = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;
    
    // MODIFIED: Determine completion status - ignore days before streak start
    let isCompleted: boolean;
    if (isBeforeStreakStart) {
      isCompleted = false; // Days before streak start are never "completed"
    } else {
      isCompleted = requiredHabitsCount > 0 ? 
        completedRequiredCount === requiredHabitsCount : 
        completedHabits === totalHabits;
    }
    
    const isPartiallyCompleted = completedHabits > 0 && !isCompleted && !isBeforeStreakStart;

    calendar.push({
      date: currentDate,
      dateString,
      dayNumber: currentDate.getDate(),
      isCurrentMonth,
      isToday,
      isCompleted,
      isPartiallyCompleted,
      completedHabits,
      totalHabits,
      requiredHabitsCount,
      completedRequiredCount,
      tasks: dayData.allHabits || [],
      completionPercentage: isBeforeStreakStart ? 0 : Math.round(completionPercentage),
      isFuture,
      projectedReward: undefined,
      flexibilityUsage: this.calculateFlexibilityUsage(dayData.allHabits || []),
      isBeforeStreakStart // ADD THIS PROPERTY
    });
  }

  this.calendarDays = calendar;
  this.calculateMonthlyStats();
}

  private calculateFlexibilityUsage(tasks: ScheduledHabit[]): FlexibilityDayInfo {
    return {
      totalDeferrals: 0, // You can calculate this from tasks if needed
      criticalTasks: tasks.filter(task => task.priority === 'Critical').length,
      urgentTasks: tasks.filter(task => task.priority === 'Urgent').length,
      tasksSavedByFlexibility: 0 // You can calculate this from tasks if needed
    };
  }

  private loadMonthlyStats(): void {
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

  // ===================================
  // STATISTICS CALCULATION METHODS
  // ===================================

private calculateMonthlyStats(): void {
  // Filter out days before streak start, future days, and non-current month days
  const currentMonthDays = this.calendarDays.filter(day => 
    day.isCurrentMonth && !day.isFuture && !day.isBeforeStreakStart
  );
  
  const completedDays = currentMonthDays.filter(day => day.isCompleted).length;
  const totalDays = currentMonthDays.length;
  
  const totalHabits = currentMonthDays.reduce((sum, day) => sum + day.totalHabits, 0);
  const completedHabits = currentMonthDays.reduce((sum, day) => sum + day.completedHabits, 0);
  
  this.monthlyStats = {
    completedDays,
    totalDays,
    completionRate: totalDays > 0 ? (completedDays / totalDays) * 100 : 0,
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
        daysUntil: daysUntilReward, // Make sure this property exists in ProjectedReward interface
        tier: reward.tier, // Use reward.tier (number) instead of rewardTier.tier
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
  // UI INTERACTION METHODS
  // ===================================

  onDayClick(day: MonthlyDayData): void {
    if (day.isFuture || !day.isCurrentMonth) return;
    
    console.log('Day clicked:', day);
    // You can implement day detail modal or navigation here
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  getMonthName(): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[this.currentMonth];
  }

getDayCompletionClass(day: MonthlyDayData): string {
  if (!day.isCurrentMonth) return 'other-month';
  if (day.isBeforeStreakStart) return 'ignored-day'; // NEW: Special class for pre-streak days
  if (day.isFuture) return 'future-day';
  if (day.isToday) return day.isCompleted ? 'today completed' : 'today';
  if (day.isCompleted) return 'completed';
  if (day.isPartiallyCompleted) return 'partial';
  return 'incomplete';
}

  getCompletionPercentage(day: MonthlyDayData): number {
    return Math.round(day.completionPercentage);
  }

  // Week day headers
  getWeekDays(): string[] {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }

  // Helper methods for projected rewards
  getProjectedReward(day: MonthlyDayData): ProjectedReward | undefined {
    return day.projectedReward;
  }

  // Helper method for checking if day is today
  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }
}