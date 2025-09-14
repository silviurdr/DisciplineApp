// Complete monthly-view.component.ts with projected rewards system
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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
  projectedReward?: ProjectedReward;
}

interface MonthlyStats {
  completedDays: number;
  totalDays: number;
  completionRate: number;
  currentStreak: number;
  totalHabits: number;
}

interface RewardTier {
  tier: 1 | 2 | 3 | 4;
  icon: string;
  name: string;
  color: string;
}

interface ProjectedReward {
  date: Date;
  dateString: string;
  streakDay: number;
  tier: RewardTier;
}

interface StreakInfo {
  currentStreak: number;
  lastCompletedDate: Date | null;
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
    3: { tier: 3, icon: '👕', name: 'Clothing Reward', color: '#42A5F5' },
    4: { tier: 4, icon: '🎾', name: 'Equipment Reward', color: '#66BB6A' }
  };

  // Reward schedule based on your requirements
  private rewardSchedule: Array<{day: number, tier: 1 | 2 | 3 | 4}> = [
    { day: 7, tier: 1 },   // Tier 1 at 7 days
    { day: 14, tier: 2 },  // Tier 2 at 14 days
    { day: 21, tier: 1 },  // Tier 1 at 21 days
    { day: 30, tier: 3 },  // Tier 3 at 30 days
    { day: 37, tier: 1 },  // Tier 1 at 37 days
    { day: 44, tier: 2 },  // Tier 2 at 44 days
    { day: 51, tier: 1 },  // Tier 1 at 51 days
    { day: 60, tier: 3 },  // Tier 3 at 60 days
    { day: 67, tier: 1 },  // Tier 1 at 67 days
    { day: 74, tier: 2 },  // Tier 2 at 74 days
    { day: 81, tier: 1 },  // Tier 1 at 81 days
    { day: 90, tier: 4 }   // Tier 4 at 90 days
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

  async loadMonthData(): Promise<void> {
    this.loading = true;
    this.error = null;
    
    try {
      // Generate calendar grid for the month
      this.calendarDays = this.generateCalendarGrid();
      
      // Load data for each week that intersects with this month
      const weekPromises = this.getWeeksInMonth().map(weekStart => 
        this.disciplineService.getWeekData(
          weekStart.getFullYear(),
          weekStart.getMonth() + 1,
          weekStart.getDate()
        ).toPromise()
      );

      const weekDataArray = await Promise.all(weekPromises);
      
      // Process the week data to populate our calendar days
      this.processWeekData(weekDataArray);
      
      // Get current streak information
      const streakInfo = await this.getCurrentStreakInfo();
      
      // Calculate projected rewards
      this.calculateProjectedRewards(streakInfo);
      
      // Apply projected rewards to calendar days
      this.applyProjectedRewardsToCalendar();
      
      // Calculate monthly statistics
      this.calculateMonthlyStats();
      
    } catch (error) {
      console.error('Error loading month data:', error);
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
      
      // Use consistent date string format (avoid timezone issues)
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      days.push({
        date: date,
        dateString: dateString,
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
    weekDataArray.forEach((weekData) => {
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

  // Mock method to get current streak info (replace with actual API call)
private async getCurrentStreakInfo(): Promise<StreakInfo> {
  // TODO: Replace this with actual API call to get current streak
  // For now, always return streak 0 to show upcoming rewards
  
  return {
    currentStreak: 1, // Always start from 0 to show all upcoming rewards
    lastCompletedDate: new Date() // Use today as the reference point
  };
}

  private calculateProjectedRewards(currentStreakInfo: StreakInfo): void {
    this.projectedRewards = [];
    
    if (!currentStreakInfo.lastCompletedDate || currentStreakInfo.currentStreak === 0) {
      return; // No streak to project from
    }

    const today = new Date();
    const startProjectionDate = new Date(today);
    startProjectionDate.setDate(today.getDate() + 1); // Start projecting from tomorrow

    // Find upcoming reward milestones
    const upcomingRewards = this.rewardSchedule.filter(reward => 
      reward.day > currentStreakInfo.currentStreak && 
      reward.day <= currentStreakInfo.currentStreak + 60 // Project up to 60 days ahead
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

    console.log('Projected rewards for current month:', this.projectedRewards);
  }

  private applyProjectedRewardsToCalendar(): void {
    this.projectedRewards.forEach(reward => {
      const dayData = this.calendarDays.find(d => d.dateString === reward.dateString);
      if (dayData) {
        dayData.projectedReward = reward;
      }
    });
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

  // Reward-related methods
  getProjectedReward(day: MonthlyDayData): ProjectedReward | null {
    return day.projectedReward || null;
  }

  getRewardDisplayText(reward: ProjectedReward): string {
    return `Day ${reward.streakDay} - ${reward.tier.name}`;
  }

  onDayClick(day: MonthlyDayData): void {
    if (!day.isCurrentMonth || day.isFuture) return;
    
    if (day.projectedReward) {
      console.log('Clicked reward day:', day.projectedReward);
      // You could implement a modal showing reward details here
    } else {
      console.log('Day clicked:', day);
      // You could implement day detail modal or navigation here
    }
  }

  debugRewardsSystem(): void {
  console.log('🔍 REWARDS DEBUG:');
  console.log('Current month:', this.currentMonth);
  console.log('Current year:', this.currentYear);
  console.log('Calendar days generated:', this.calendarDays.length);
  console.log('Projected rewards:', this.projectedRewards);
  console.log('Monthly stats:', this.monthlyStats);
  
  // Check if any calendar days have projected rewards
  const daysWithRewards = this.calendarDays.filter(d => d.projectedReward);
  console.log('Days with projected rewards:', daysWithRewards);
  
  // Check completed days
  const completedDays = this.calendarDays.filter(d => d.isCompleted);
  console.log('Completed days this month:', completedDays.length);
  
  // Mock a higher streak to test rewards
  this.testHigherStreak();
}

// Test method with artificial higher streak
async testHigherStreak(): Promise<void> {
  console.log('🧪 Testing with artificial streak...');
  
  const mockStreakInfo: StreakInfo = {
    currentStreak: 5, // Change this number to test different scenarios
    lastCompletedDate: new Date()
  };
  
  console.log('Mock streak info:', mockStreakInfo);
  
  this.calculateProjectedRewards(mockStreakInfo);
  this.applyProjectedRewardsToCalendar();
  
  console.log('After test calculation:');
  console.log('Projected rewards:', this.projectedRewards);
  console.log('Days with rewards:', this.calendarDays.filter(d => d.projectedReward));
}
}