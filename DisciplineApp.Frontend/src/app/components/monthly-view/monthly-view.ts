import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DisciplineService } from '../../services/discipline.services';
import { LoadingService } from '../../services/loading.service';
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
  tier: 1 | 2 | 3 | 4 | 5 | 6;
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
    4: { tier: 4, icon: '🎧', name: 'Head Phones', color: '#FFA726' },
    5: { tier: 5, icon: '🎾', name: 'Tennis Reward', color: '#FFA726' },
    6: { tier: 6, icon: '🎫', name: 'Concert Ticket', color: '#FFA726' }
  };

  // Define reward schedule with flexibility for 90+ days


  private rewardSchedule = [
    { day: 7, tier: 1 },   // Coffee
    { day: 14, tier: 2 },  // Book
    { day: 21, tier: 1 },  // New: Tier 1 prize
    { day: 30, tier: 3 },  // Clothing
    { day: 37, tier: 1 },  // New: Tier 1 prize
    { day: 44, tier: 2 },  // New: Tier 2 prize
    { day: 51, tier: 1 },  // New: Tier 1 prize
    { day: 60, tier: 4 },  // Headphones (2 months)
    { day: 67, tier: 1 },  // New: Tier 1 prize
    { day: 74, tier: 2 },  // New: Tier 2 prize
    { day: 81, tier: 1 },  // New: Tier 1 prize
    { day: 90, tier: 5 },   // Tennis racket/Headphones (3 months)
    { day: 120, tier: 6 },  // Additional milestone
    { day: 180, tier: 5 },  // Music festival (6 months)
    { day: 365, tier: 6 }   // Trip (1 year)
  ];

  constructor(private disciplineService: DisciplineService,   private loadingService: LoadingService) {
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    
  }

ngOnInit(): void {
  // Show loading immediately when component initializes
  this.loadingService.show();
  this.initializeMonthlyView();
}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
// Replace your existing initializeMonthlyView method with this:
private async initializeMonthlyView(): Promise<void> {
  try {
    await this.loadMonthDataAsPromise();
  } catch (error) {
    console.error('Error loading monthly view:', error);
    this.error = 'Failed to load monthly data. Please try again.';
  } finally {
    // CRITICAL: Always hide loading after data loading completes
    this.loadingService.hide();
  }
}
private loadMonthDataAsPromise(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.error = null;

    const today = new Date();
    const isCurrentMonth = today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear;

    if (isCurrentMonth) {
      // For current month, get real data for current week and generate projected data for future days
      this.disciplineService.getCurrentWeek()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (weekData: WeekData) => {
            this.generateCalendarWithRealData(weekData);
            this.generateProjectedTasksForFutureDays();
            this.calculateProjectedRewards();
            this.loading = false;
            resolve();
          },
          error: (error) => {
            console.error('Error loading week data:', error);
            this.generateCalendarWithTodayData(null);
            this.generateProjectedTasksForFutureDays();
            this.loading = false;
            reject(error);
          }
        });
    } else {
      this.generateCalendarWithTodayData(null);
      this.generateProjectedTasksForFutureDays();
      this.loading = false;
      resolve();
    }

    this.loadMonthlyStatsAsPromise().then(() => {
      // Monthly stats loaded
    }).catch(error => {
      console.error('Error loading monthly stats:', error);
    });
  });
}

private loadMonthlyStatsAsPromise(): Promise<void> {
  return new Promise((resolve) => {
    // Calculate stats from calendar days
    const totalDays = this.calendarDays.filter(d => d.isCurrentMonth && !d.isFuture).length;
    const completedDays = this.calendarDays.filter(d => d.isCurrentMonth && d.isCompleted).length;
    const currentStreak = this.calculateCurrentStreak();
    const totalHabits = this.calendarDays.reduce((sum, d) => sum + (d.totalHabits || 0), 0);

    this.monthlyStats = {
      totalDays,
      completedDays,
      completionRate: totalDays > 0 ? (completedDays / totalDays) * 100 : 0,
      currentStreak,
      totalHabits
    };
    resolve();
  });
}


  // ===================================
  // DATA LOADING METHODS
  // ===================================

loadMonthData(): void {
  this.loadingService.show();
  this.initializeMonthlyView();
}

private generateProjectedTasksForFutureDays(): void {
  this.calendarDays.forEach(day => {
    if (day.isFuture && day.isCurrentMonth) {
      // Generate consistent task counts for future days based on your habit schedule
      // This should match your actual weekly scheduling logic
      
      const dayOfWeek = day.date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      let projectedTasks = 0;
      
      // Daily habits (always present)
      projectedTasks += 4; // Phone Lock, Clean Eating, Reading, Brushing Teeth
      
      // Weekly habits (based on day of week)
      if ([1, 3, 5].includes(dayOfWeek)) { // Mon, Wed, Fri
        projectedTasks += 1; // Gym (4x per week, distributed)
      }
      if (dayOfWeek === 6) { // Saturday
        projectedTasks += 1; // Gym (4th session)
      }
      if ([2, 4].includes(dayOfWeek)) { // Tue, Thu
        projectedTasks += 1; // Vacuum/Sweep (2x per week)
      }
      if (dayOfWeek === 0) { // Sunday
        projectedTasks += 1; // Clean Bathroom (1x per week)
      }
      
      // Every two days habits
      if ([0, 2, 4, 6].includes(dayOfWeek)) { // Rolling schedule
        projectedTasks += 1; // Clean Dishes
      }
      
      // Monthly habits (spread throughout month)
      const dayOfMonth = day.date.getDate();
      if (dayOfMonth === 15) {
        projectedTasks += 1; // Kitchen Deep Clean
      }
      
      // Update the day with projected data
      day.totalHabits = projectedTasks;
      day.completedHabits = 0; // Future days start with 0 completed
      day.completionPercentage = 0;
      day.isCompleted = false;
      day.isPartiallyCompleted = false;
    }
  });
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
      return calendarDateStr === weekDayDateStr;
    });
    
    if (matchingDay && matchingDay.isCurrentMonth) {
      console.log(`Updating day ${matchingDay.dayNumber} with real data: ${weekDay.completedHabits}/${weekDay.totalHabits}`);
      
      // ✅ UPDATED: Set real data from backend
      matchingDay.completedHabits = weekDay.completedHabits || 0;
      matchingDay.totalHabits = weekDay.totalHabits || 0;
      matchingDay.requiredHabitsCount = weekDay.requiredHabitsCount || 0;
      matchingDay.completedRequiredCount = weekDay.completedRequiredCount || 0;
      
      // ✅ UPDATED: Calculate completion percentage based on REQUIRED tasks only
      matchingDay.completionPercentage = this.getRequiredTaskCompletionPercentage(matchingDay);
      
      // ✅ UPDATED: Day completion status based on REQUIRED tasks only
      if (matchingDay.isToday) {
        // Today: Show as in progress if there are tasks
        matchingDay.isCompleted = false;
        matchingDay.isPartiallyCompleted = weekDay.totalHabits > 0;
      } else if (!matchingDay.isFuture) {
        // ✅ UPDATED: Past days completion based on REQUIRED tasks only
        const requiredCount = weekDay.requiredHabitsCount || 0;
        const completedRequired = weekDay.completedRequiredCount || 0;
        
        if (requiredCount > 0) {
          matchingDay.isCompleted = (completedRequired === requiredCount);
          matchingDay.isPartiallyCompleted = false;
        } else {
          matchingDay.isCompleted = true; // No required tasks = completed day
          matchingDay.isPartiallyCompleted = false;
        }
      }
    }
  });
  
  // ✅ IMPORTANT: Recalculate stats after updating with real data
  this.loadMonthlyStats();
}

getRequiredTasksCount(day: MonthlyDayData): number {
  return day.requiredHabitsCount || 0;
}

getCompletedRequiredTasksCount(day: MonthlyDayData): number {
  return day.completedRequiredCount || 0;
}

getTotalTasksCount(day: MonthlyDayData): number {
  return day.totalHabits || 0;
}

getCompletedTotalTasksCount(day: MonthlyDayData): number {
  return day.completedHabits || 0;
}

// Calculate required task completion percentage
getRequiredTaskCompletionPercentage(day: MonthlyDayData): number {
  const requiredCount = this.getRequiredTasksCount(day);
  const completedRequired = this.getCompletedRequiredTasksCount(day);
  
  if (requiredCount === 0) return 100; // No required tasks = 100% complete
  return Math.round((completedRequired / requiredCount) * 100);
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
      
      const dateString = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
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

  private getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

private loadMonthlyStats(): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Only calculate stats from PAST days (exclude current day and future days)
  const pastDaysOnly = this.calendarDays.filter(day => 
    day.isCurrentMonth && 
    !day.isBeforeStreakStart && 
    day.date < today
  );
  
  console.log(`Calculating stats from ${pastDaysOnly.length} past days (excluding today)`);
  
  const completedDays = pastDaysOnly.filter(day => day.isCompleted).length;
  const totalPastDays = pastDaysOnly.length;
  
  const daysWithRealData = pastDaysOnly.filter(day => day.totalHabits > 0);
  const totalHabits = daysWithRealData.reduce((sum, day) => sum + day.totalHabits, 0);
  const completedHabits = daysWithRealData.reduce((sum, day) => sum + day.completedHabits, 0);

  this.monthlyStats = {
    completionRate: totalPastDays > 0 ? Math.round((completedDays / totalPastDays) * 100) : 0,
    completedDays,
    totalDays: totalPastDays,
    currentStreak: this.calculateCurrentStreakFixed(), // Use fixed calculation
    totalHabits: totalHabits,
    averageCompletionRate: totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0
  };
  
  console.log('Monthly stats (excluding today):', this.monthlyStats);
  console.log(`Current streak: ${this.monthlyStats.currentStreak}`);
  
  // ✅ IMPORTANT: Recalculate rewards after updating stats
  this.calculateProjectedRewards();
  this.updateCalendarWithRewards();
}



private calculateCurrentStreakFixed(): number {
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get only past days (excluding today), sorted by date (newest first)
  const pastDays = this.calendarDays
    .filter(day => 
      day.isCurrentMonth && 
      !day.isBeforeStreakStart && 
      day.date < today // ✅ Exclude current day
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  
  console.log(`Calculating streak from ${pastDays.length} past days (excluding today)`);
  
  // Start from most recent past day and work backwards
  for (const day of pastDays) {
    console.log(`Day ${day.dayNumber}: completed=${day.isCompleted}`);
    
    if (day.isCompleted) {
      streak++;
    } else {
      // First incomplete day breaks the streak
      break;
    }
  }
  
  console.log('Current streak calculated:', streak);
  return streak;
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
      if (!day.isCompleted && streak > 0) break;
      
      streak++;
    }
    
    return streak;
  }

  // ===================================
  // REWARD CALCULATION METHODS
  // ===================================

private calculateProjectedRewards(): void {
  this.projectedRewards = [];
  
  // ✅ Use the current streak from monthlyStats (which uses the fixed calculation)
  const currentStreak = this.monthlyStats?.currentStreak || 0;
  console.log(`Calculating rewards from current streak: ${currentStreak}`);
  
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
  
  console.log('Projected rewards calculated:', this.projectedRewards);
}

private calculateProjectedRewardForDay(date: Date): ProjectedReward | undefined {
  const currentStreak = this.monthlyStats?.currentStreak || 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysFromToday = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const projectedStreak = currentStreak + daysFromToday;
  
  console.log(`Day ${date.getDate()}: currentStreak=${currentStreak}, daysFromToday=${daysFromToday}, projectedStreak=${projectedStreak}`);
  
  // Check if this projected streak hits any reward milestones
  const rewardMilestone = this.rewardSchedule.find(r => r.day === projectedStreak);
  if (rewardMilestone) {
    const rewardType = this.rewardTiers[rewardMilestone.tier];
    if (rewardType) {
      console.log(`Found reward for day ${date.getDate()}: ${rewardType.name} at streak ${projectedStreak}`);
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

// ✅ ADD: New method to update calendar with reward icons after stats calculation
private updateCalendarWithRewards(): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Update future days with projected rewards
  this.calendarDays.forEach(day => {
    if (day.isCurrentMonth && day.isFuture) {
      day.projectedReward = this.calculateProjectedRewardForDay(day.date);
    }
  });
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

nextMonth(): void {
  if (this.loading) return; // Prevent multiple clicks
  
  this.currentMonth++;
  if (this.currentMonth > 11) {
    this.currentMonth = 0;
    this.currentYear++;
  }
  // Don't call loadingService.show() here - initializeMonthlyView will handle it
  this.initializeMonthlyView();
}

previousMonth(): void {
  if (this.loading) return; // Prevent multiple clicks
  
  this.currentMonth--;
  if (this.currentMonth < 0) {
    this.currentMonth = 11;
    this.currentYear--;
  }
  // Don't call loadingService.show() here - initializeMonthlyView will handle it
  this.initializeMonthlyView();
}

goToToday(): void {
  if (this.loading) return; // Prevent multiple clicks
  
  const today = new Date();
  this.currentMonth = today.getMonth();
  this.currentYear = today.getFullYear();
  // Don't call loadingService.show() here - initializeMonthlyView will handle it
  this.initializeMonthlyView();
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
  if (day.isFuture || !day.isCurrentMonth) return;
  
  // Add subtle loading for day interactions
  this.loadingService.show();
  
  // Simulate day detail loading
  setTimeout(() => {
    console.log('Day clicked:', day);
    // You can add day detail modal or navigation here
    this.loadingService.hide();
  }, 300);
}
}