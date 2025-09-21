// Updated monthly-view.component.ts - DailyStats Integration
// This version preserves your existing structure and patterns while integrating DailyStats

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DisciplineService } from '../../services/discipline.services'; // Keep your existing import path
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
  // New properties for DailyStats integration
  streakDayNumber?: number;
  isInFirst7Days?: boolean;
  completionRules?: string;
  dataSource?: string;
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

  // Keep your existing reward tiers
  private rewardTiers: Record<number, RewardTier> = {
    1: { tier: 1, icon: '☕', name: 'Coffee Reward', color: '#8D6E63' },
    2: { tier: 2, icon: '📚', name: 'Book Reward', color: '#5C6BC0' },
    3: { tier: 3, icon: '👕', name: 'Clothing Reward', color: '#66BB6A' },
    4: { tier: 4, icon: '🎧', name: 'Head Phones', color: '#FFA726' },
    5: { tier: 5, icon: '🎾', name: 'Tennis Reward', color: '#FFA726' },
    6: { tier: 6, icon: '🎫', name: 'Concert Ticket', color: '#FFA726' }
  };

  // Keep your existing reward schedule
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

  constructor(
    private disciplineService: DisciplineService,   
    private loadingService: LoadingService
  ) {
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
  }

  ngOnInit(): void {
    this.loadingService.show();
    this.initializeMonthlyView();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================================
  // UPDATED INITIALIZATION METHOD
  // ===================================

  private async initializeMonthlyView(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.loadingService.show();

    try {
      // ALWAYS try the DailyStats approach first - this should show historical data
      console.log(`🗓️ Loading month data for ${this.currentYear}-${this.currentMonth + 1}`);
      await this.loadMonthDataFromDailyStats();
    } catch (error) {
      console.error('Error loading monthly view:', error);
      this.error = 'Failed to load monthly data. Please try again.';
    } finally {
      this.loading = false;
      this.loadingService.hide();
    }
  }

  // ===================================
  // NEW METHOD: Load from DailyStats
  // ===================================

  async loadMonthDataFromDailyStats(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if the getMonthData method exists on the service
      if (!this.disciplineService.getMonthData) {
        console.log('📅 getMonthData method not found on service, falling back to existing approach');
        this.loadMonthDataAsPromise().then(resolve).catch(reject);
        return;
      }

      console.log(`📅 Attempting to call getMonthData(${this.currentYear}, ${this.currentMonth + 1})`);
      
      this.disciplineService.getMonthData(this.currentYear, this.currentMonth + 1)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            console.log(`✅ DailyStats month data received successfully:`, response);
            
            // Verify we got the expected data structure
            if (response && response.days && Array.isArray(response.days)) {
              console.log(`📊 Processing ${response.days.length} days from DailyStats API`);
              this.processMonthDataFromDailyStats(response);
              resolve();
            } else {
              console.error('❌ Invalid response structure from getMonthData, falling back');
              this.loadMonthDataAsPromise().then(resolve).catch(reject);
            }
          },
          error: (error) => {
            console.error('❌ Error calling getMonthData API:', error);
            console.error('Error details:', error.message, error.status);
            
            // Check if it's a 404 (endpoint not implemented)
            if (error.status === 404) {
              console.log('📅 Month data endpoint not implemented yet, falling back to getCurrentWeek approach');
            } else {
              console.log('📅 API error occurred, falling back to getCurrentWeek approach');
            }
            
            this.loadMonthDataAsPromise().then(resolve).catch(reject);
          }
        });
    });
  }

  private processMonthDataFromDailyStats(response: any): void {
    console.log(`📅 Processing DailyStats: ${response.totalDaysWithStoredStats}/${response.totalDaysInResponse} days from stored stats`);
    
    // Store monthly statistics from API
    if (response.monthlyStats) {
      this.monthlyStats = {
        totalDays: response.monthlyStats.totalDays,
        completedDays: response.monthlyStats.completedDays,
        completionRate: response.monthlyStats.completionRate,
        currentStreak: response.monthlyStats.currentStreak || 0,
        totalHabits: response.monthlyStats.totalTasks || 0
      };
    }
    
    // ✅ DEBUG: Show what we received from API
    console.log(`🔍 API RESPONSE ANALYSIS:`);
    console.log(`Total days in response: ${response.days.length}`);
    
    const completedDays = response.days.filter((d: any) => d.isCompleted);
    const partialDays = response.days.filter((d: any) => d.isPartiallyCompleted);
    const incompleteDays = response.days.filter((d: any) => !d.isCompleted && !d.isPartiallyCompleted);
    
    console.log(`✅ Completed days (${completedDays.length}):`, completedDays.map((d: any) => d.date));
    console.log(`🟡 Partial days (${partialDays.length}):`, partialDays.map((d: any) => d.date));
    console.log(`❌ Incomplete days (${incompleteDays.length}):`, incompleteDays.map((d: any) => d.date));
    
    // Build calendar grid from API data
    this.buildCalendarGridFromDailyStats(response.days);
    
    // ✅ DEBUG: Check what happened after building calendar
    const calendarCompleted = this.calendarDays.filter(d => d.isCompleted && d.isCurrentMonth);
    const calendarPartial = this.calendarDays.filter(d => d.isPartiallyCompleted && d.isCurrentMonth);
    const calendarIncomplete = this.calendarDays.filter(d => !d.isCompleted && !d.isPartiallyCompleted && d.isCurrentMonth && !d.isFuture);
    
    console.log(`🔍 CALENDAR AFTER PROCESSING:`);
    console.log(`✅ Calendar completed days (${calendarCompleted.length}):`, calendarCompleted.map(d => d.dayNumber));
    console.log(`🟡 Calendar partial days (${calendarPartial.length}):`, calendarPartial.map(d => d.dayNumber));
    console.log(`❌ Calendar incomplete days (${calendarIncomplete.length}):`, calendarIncomplete.map(d => d.dayNumber));
    
    // IMPORTANT: Calculate projected rewards AFTER we have monthly stats
    this.calculateProjectedRewards();
    
    console.log(`✅ Calendar generated with ${this.calendarDays.length} days using DailyStats`);
    console.log(`🏆 Current streak: ${this.monthlyStats?.currentStreak}, Projected rewards: ${this.projectedRewards.length}`);
  }

  private buildCalendarGridFromDailyStats(apiDays: any[]): void {
    const today = new Date();
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    
    console.log(`📅 Building calendar grid for ${this.currentYear}-${this.currentMonth + 1}`);
    console.log(`📊 API provided ${apiDays.length} days of data`);
    
    // Calculate calendar grid boundaries
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    startDate.setDate(firstDay.getDate() + mondayOffset);

    const endDate = new Date(lastDay);
    const endDayOfWeek = lastDay.getDay();
    const sundayOffset = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
    endDate.setDate(lastDay.getDate() + sundayOffset);

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    this.calendarDays = [];

    let daysFromDailyStats = 0;
    let daysProjected = 0;
    let daysEmpty = 0;

    // Generate calendar grid
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // ✅ Use consistent date string generation (no timezone offset)
      const dateString = currentDate.toISOString().split('T')[0];
      const isCurrentMonth = currentDate.getMonth() === this.currentMonth;
      const isToday = currentDate.toDateString() === today.toDateString();
      const isFuture = currentDate > today;

      // Find corresponding API data
      const apiDay = apiDays.find(day => day.date === dateString);

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

      if (apiDay) {
        // ✅ CRITICAL FIX: Use data from DailyStats API for ANY day that has data
        // This should work for ALL historical days, not just current week
        dayData.isCompleted = apiDay.isCompleted || false;
        dayData.isPartiallyCompleted = apiDay.isPartiallyCompleted || false;
        dayData.completedHabits = apiDay.completedHabits || 0;
        dayData.totalHabits = apiDay.totalHabits || 0;
        dayData.requiredHabitsCount = apiDay.requiredHabitsCount || 0;
        dayData.completedRequiredCount = apiDay.completedRequiredCount || 0;
        dayData.completionPercentage = apiDay.completionPercentage || 0;
        dayData.streakDayNumber = apiDay.streakDayNumber || 0;
        dayData.isInFirst7Days = apiDay.isInFirst7Days || false;
        dayData.completionRules = apiDay.completionRules || '';
        dayData.dataSource = apiDay.dataSource || 'daily_stats';
        
        daysFromDailyStats++;
        
        // ✅ DETAILED debugging for specific days that should show formatting
        if (dayData.dayNumber >= 15 && dayData.dayNumber <= 21 && dayData.isCurrentMonth) {
          console.log(`🔍 CRITICAL DAY ${dayData.dayNumber} (${dateString}) ANALYSIS:`);
          console.log(`   📊 API Data:`, {
            apiCompleted: apiDay.isCompleted,
            apiPartial: apiDay.isPartiallyCompleted,
            apiCompletedHabits: apiDay.completedHabits,
            apiTotalHabits: apiDay.totalHabits
          });
          console.log(`   📅 Calendar Data:`, {
            calendarCompleted: dayData.isCompleted,
            calendarPartial: dayData.isPartiallyCompleted,
            calendarCompletedHabits: dayData.completedHabits,
            calendarTotalHabits: dayData.totalHabits,
            isCurrentMonth: dayData.isCurrentMonth,
            cssClass: this.getDayCompletionClass(dayData)
          });
        }

        // ✅ ALSO debug early September days (1-14) 
        if (dayData.dayNumber >= 1 && dayData.dayNumber <= 14 && dayData.isCurrentMonth) {
          console.log(`🔍 EARLY SEPTEMBER DAY ${dayData.dayNumber} (${dateString}) ANALYSIS:`);
          console.log(`   📊 API Data:`, {
            apiCompleted: apiDay.isCompleted,
            apiPartial: apiDay.isPartiallyCompleted,
            apiCompletedHabits: apiDay.completedHabits,
            apiTotalHabits: apiDay.totalHabits
          });
          console.log(`   📅 Calendar Data:`, {
            calendarCompleted: dayData.isCompleted,
            calendarPartial: dayData.isPartiallyCompleted,
            calendarCompletedHabits: dayData.completedHabits,
            calendarTotalHabits: dayData.totalHabits,
            isCurrentMonth: dayData.isCurrentMonth,
            cssClass: this.getDayCompletionClass(dayData)
          });
        }
        
      } else if (isFuture && isCurrentMonth) {
        // Project future tasks
        dayData.totalHabits = this.projectTasksForDay(currentDate);
        dayData.dataSource = 'projected';
        daysProjected++;
      } else {
        // Empty day (no data available)
        dayData.dataSource = 'empty';
        daysEmpty++;
      }

      this.calendarDays.push(dayData);
    }
    
    console.log(`📊 Calendar built: ${daysFromDailyStats} from DailyStats, ${daysProjected} projected, ${daysEmpty} empty`);
    
    // ✅ Debug: Check a few specific days that should have formatting
    const daysWith15To21 = this.calendarDays.filter(d => d.dayNumber >= 15 && d.dayNumber <= 21 && d.isCurrentMonth);
    const daysWith1To14 = this.calendarDays.filter(d => d.dayNumber >= 1 && d.dayNumber <= 14 && d.isCurrentMonth);
    
    console.log(`🔍 Days 15-21 (should have formatting):`, daysWith15To21.map(d => ({ 
      day: d.dayNumber, 
      completed: d.isCompleted, 
      partial: d.isPartiallyCompleted,
      dataSource: d.dataSource 
    })));
    
    console.log(`🔍 Days 1-14 (should ALSO have formatting):`, daysWith1To14.map(d => ({ 
      day: d.dayNumber, 
      completed: d.isCompleted, 
      partial: d.isPartiallyCompleted,
      dataSource: d.dataSource 
    })));
  }

  // ===================================
  // EXISTING FALLBACK METHOD (preserved)
  // ===================================

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
              resolve();
            },
            error: (error) => {
              console.error('Error loading week data:', error);
              this.generateCalendarWithTodayData(null);
              this.generateProjectedTasksForFutureDays();
              reject(error);
            }
          });
      } else {
        this.generateCalendarWithTodayData(null);
        this.generateProjectedTasksForFutureDays();
        resolve();
      }

      // Load monthly stats
      this.loadMonthlyStatsAsPromise().then(() => {
        console.log('Monthly stats loaded');
      }).catch(error => {
        console.error('Error loading monthly stats:', error);
      });
    });
  }

  // ===================================
  // KEEP ALL YOUR EXISTING METHODS
  // ===================================

  private loadMonthlyStatsAsPromise(): Promise<void> {
    return new Promise((resolve) => {
      if (this.monthlyStats) {
        // Already loaded from DailyStats API
        resolve();
        return;
      }

      // Calculate stats from calendar days (fallback)
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
        console.log(`📅 Updating day ${matchingDay.dayNumber} with CORRECT status from weekly API`);
        
        // ✅ CRITICAL: Use the EXACT completion status from the weekly API
        matchingDay.isCompleted = weekDay.isCompleted;
        matchingDay.isPartiallyCompleted = weekDay.isPartiallyCompleted;
        
        // Set the task counts (even if you don't care about them for now)
        matchingDay.completedHabits = weekDay.completedHabits || 0;
        matchingDay.totalHabits = weekDay.totalHabits || 0;
        matchingDay.requiredHabitsCount = weekDay.requiredHabitsCount || 0;
        matchingDay.completedRequiredCount = weekDay.completedRequiredCount || 0;
        
        // Calculate completion percentage based on REQUIRED tasks only
        matchingDay.completionPercentage = this.getRequiredTaskCompletionPercentage(matchingDay);
        
        // Mark data source for debugging
        matchingDay.dataSource = 'weekly_api_correct_status';
        
        console.log(`✅ Day ${matchingDay.dayNumber}: isCompleted=${matchingDay.isCompleted}, isPartial=${matchingDay.isPartiallyCompleted} (from weekly API)`);
      }
    });
    
    // Also update all PAST days in the current month with the weekly API logic
    // This ensures consistency across the entire month view
    this.syncPastDaysWithWeeklyLogic(weekData);
    
    // Recalculate stats after updating with real data
    this.loadMonthlyStats();
  }

  private syncPastDaysWithWeeklyLogic(weekData: WeekData): void {
    // For any past days in the current month that aren't in the current week,
    // we need to ensure they use the same completion logic as the weekly view
    
    const today = new Date();
    const weekDates = weekData.days.map(d => d.date);
    
    this.calendarDays.forEach(day => {
      if (day.isCurrentMonth && !day.isFuture && !day.isToday && !weekDates.includes(day.dateString)) {
        // This is a past day not in the current week
        // For now, we'll keep the existing status but mark it as needing sync
        console.log(`📅 Past day ${day.dayNumber} (${day.dateString}) not in current week - keeping existing status`);
        day.dataSource = 'past_day_needs_sync';
      }
    });
  }

  private generateCalendarWithTodayData(todayData: DayData | null): void {
    const calendar: MonthlyDayData[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const today = new Date();

    // Calculate the first Monday to display
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    startDate.setDate(firstDay.getDate() + mondayOffset);

    // Calculate the last Sunday to display
    const endDate = new Date(lastDay);
    const endDayOfWeek = lastDay.getDay();
    const sundayOffset = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
    endDate.setDate(lastDay.getDate() + sundayOffset);

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Generate the required number of days
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const dateString = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const isCurrentMonth = currentDate.getMonth() === this.currentMonth;
      const isToday = currentDate.toDateString() === today.toDateString();
      const isFuture = currentDate > today;

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
        isBeforeStreakStart: currentDate < this.streakStartDate,
        dataSource: 'initial_empty'
      };

      // If this is today and we have real data, use it
      if (isToday && todayData) {
        dayData.isCompleted = todayData.isCompleted || false;
        dayData.isPartiallyCompleted = todayData.isPartiallyCompleted || false;
        dayData.completedHabits = todayData.completedHabits || 0;
        dayData.totalHabits = todayData.totalHabits || 0;
        dayData.completionPercentage = dayData.totalHabits > 0 ? 
          Math.round((dayData.completedHabits / dayData.totalHabits) * 100) : 0;
        dayData.dataSource = 'today_data';
      }
      // ✅ REMOVED: No more mock data generation for past days!
      // The weekly API will provide the correct status for current week days
      // Past days outside current week will remain empty until we get proper historical data

      calendar.push(dayData);
    }

    this.calendarDays = calendar;
    console.log(`📅 Generated base calendar with ${calendar.length} days (no mock past data)`);
  }

  private generateProjectedTasksForFutureDays(): void {
    this.calendarDays.forEach(day => {
      if (day.isFuture && day.isCurrentMonth) {
        day.totalHabits = this.projectTasksForDay(day.date);
        day.completedHabits = 0;
        day.completionPercentage = 0;
        day.isCompleted = false;
        day.isPartiallyCompleted = false;
      }
    });
  }

  private projectTasksForDay(date: Date): number {
    const dayOfWeek = date.getDay();
    let projectedTasks = 0;
    
    // Daily habits
    projectedTasks += 4; // Phone Lock, Clean Eating, Reading, Brushing Teeth
    
    // Weekly habits
    if ([1, 3, 5].includes(dayOfWeek)) projectedTasks += 1; // Gym
    if (dayOfWeek === 6) projectedTasks += 1; // Gym Saturday
    if ([2, 4].includes(dayOfWeek)) projectedTasks += 1; // Vacuum/Sweep
    if (dayOfWeek === 0) projectedTasks += 1; // Clean Bathroom
    
    // Every two days habits
    if ([0, 2, 4, 6].includes(dayOfWeek)) projectedTasks += 1; // Clean Dishes
    
    // Monthly habits
    const dayOfMonth = date.getDate();
    if (dayOfMonth === 15) projectedTasks += 1; // Kitchen Deep Clean
    
    return projectedTasks;
  }

  // Keep all your existing utility methods...
  private calculateProjectedRewards(): void {
    // Clear previous projected rewards
    this.projectedRewards = [];
    
    const currentStreak = this.monthlyStats?.currentStreak || 0;
    
    // Find the next upcoming reward milestones (not every day!)
    const upcomingRewards = this.rewardSchedule.filter(reward => reward.day > currentStreak);
    
    // Only show the next 3-4 upcoming rewards to avoid clutter
    const nextRewards = upcomingRewards.slice(0, 4);
    
    this.calendarDays.forEach(day => {
      if (day.isFuture && day.isCurrentMonth) {
        const futureDaysFromToday = Math.ceil((day.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const projectedStreak = currentStreak + futureDaysFromToday;
        
        // Only show reward if this day is EXACTLY a milestone day (not every day)
        const exactReward = this.rewardSchedule.find(r => r.day === projectedStreak);
        
        if (exactReward) {
          const tier = this.rewardTiers[exactReward.tier];
          day.projectedReward = {
            day: exactReward.day,
            daysUntil: futureDaysFromToday,
            tier: exactReward.tier,
            icon: tier.icon,
            name: tier.name,
            color: tier.color,
            isAchievable: true,
            description: `${tier.name} milestone!`
          };
        } else {
          // Clear any previous reward assignment for non-milestone days
          day.projectedReward = undefined;
        }
      }
    });
    
    // Generate the projected rewards list for the progress section
    nextRewards.forEach(reward => {
      const tier = this.rewardTiers[reward.tier];
      const daysUntil = reward.day - currentStreak;
      
      if (daysUntil > 0) {
        this.projectedRewards.push({
          day: reward.day,
          daysUntil: daysUntil,
          tier: reward.tier,
          icon: tier.icon,
          name: tier.name,
          color: tier.color,
          isAchievable: daysUntil <= 30, // Only mark as achievable if within 30 days
          description: `${tier.name} in ${daysUntil} days`
        });
      }
    });
    
    console.log(`🏆 Calculated ${this.projectedRewards.length} projected rewards for progress section`);
  }

  // Keep all existing utility methods unchanged
  getRequiredTaskCompletionPercentage(day: MonthlyDayData): number {
    const requiredCount = day.requiredHabitsCount || 0;
    const completedRequired = day.completedRequiredCount || 0;
    
    if (requiredCount === 0) return 100;
    return Math.round((completedRequired / requiredCount) * 100);
  }

  private calculateCurrentStreak(): number {
    let streak = 0;
    const today = new Date();
    
    // Find consecutive completed days working backwards from today
    for (let i = 0; i < this.calendarDays.length; i++) {
      const day = this.calendarDays.find(d => 
        d.isCurrentMonth && 
        d.date.toDateString() === new Date(today.getTime() - (i * 24 * 60 * 60 * 1000)).toDateString()
      );
      
      if (day && day.isCompleted) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private loadMonthlyStats(): void {
    this.loadMonthlyStatsAsPromise();
  }

  // ===================================
  // NAVIGATION METHODS (unchanged)
  // ===================================

  nextMonth(): void {
    if (this.loading) return;
    
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.initializeMonthlyView();
  }

  previousMonth(): void {
    if (this.loading) return;
    
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.initializeMonthlyView();
  }

  goToToday(): void {
    if (this.loading) return;
    
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.initializeMonthlyView();
  }

  // ===================================
  // UTILITY METHODS (unchanged)
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
    // ✅ CRITICAL FIX: Remove the isCurrentMonth restriction that was blocking historical days
    // The old logic only showed formatting for current month days, but we want ALL days with data
    
    if (day.isCompleted) {
      console.log(`✅ Day ${day.dayNumber} - returning 'completed' class`);
      return 'completed';
    }
    if (day.isPartiallyCompleted) {
      console.log(`🟡 Day ${day.dayNumber} - returning 'partial' class`);
      return 'partial';
    }
    if (!day.isCurrentMonth) {
      console.log(`📅 Day ${day.dayNumber} - returning 'other-month' class (not current month)`);
      return 'other-month';
    }
    if (day.totalHabits === 0 && !day.isFuture) {
      console.log(`⚪ Day ${day.dayNumber} - returning 'free' class (no tasks)`);
      return 'free';
    }
    if (day.isFuture) {
      console.log(`🔮 Day ${day.dayNumber} - returning 'future' class`);
      return 'future';
    }
    
    console.log(`❌ Day ${day.dayNumber} - returning 'incomplete' class`);
    return 'incomplete';
  }

  onDayClick(day: MonthlyDayData): void {
    if (day.isFuture || !day.isCurrentMonth) return;
    
    this.loadingService.show();
    
    setTimeout(() => {
      console.log('Day clicked:', day);
      console.log('Data source:', day.dataSource);
      if (day.dataSource === 'daily_stats') {
        console.log('DailyStats data:', {
          streakDay: day.streakDayNumber,
          first7Days: day.isInFirst7Days,
          completionRules: day.completionRules
        });
      }
      this.loadingService.hide();
    }, 300);
  }
}