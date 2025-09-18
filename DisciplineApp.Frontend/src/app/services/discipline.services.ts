// ===================================
// UPDATED DISCIPLINE.SERVICE.TS
// ===================================

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  WeekData, 
  DayData, 
  WeeklyProgress, 
  HabitWithFlexibility,
  StreakInfo
} from '../models/discipline.models';

import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DisciplineService {
  private baseUrl =  'https://localhost:7025/api/discipline';

  constructor(private http: HttpClient) {}

  // ===================================
  // EXISTING METHODS (Enhanced)
  // ===================================

  /**
   * Get current week data
   */
getCurrentWeek(): Observable<WeekData> {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  return this.http.get<any>(`${this.baseUrl}/week/${year}/${month}/${day}`)
    .pipe(
      map(response => {
        const weekStart = new Date(response.weekStartDate);
        const days: DayData[] = [];
        const todayString = today.toISOString().split('T')[0];
        
        // Use the complete week data from backend instead of creating mock data
        if (response.allDays && response.allDays.length === 7) {
          // Map each day from the backend response
          response.allDays.forEach((apiDay: any) => {
            const dayDate = new Date(apiDay.date);
            const dateString = apiDay.date;
            const isToday = dateString === todayString;
            const isFuture = dayDate > today;
            const isPast = dayDate < today && !isToday;
            
            days.push({
              date: dateString,
              isCompleted: apiDay.isCompleted || false,
              isPartiallyCompleted: apiDay.isPartiallyCompleted || false,
              completedHabits: apiDay.completedHabits || 0,
              totalHabits: apiDay.totalHabits || 0,
              requiredHabitsCount: apiDay.requiredHabitsCount || 0,
              completedRequiredCount: apiDay.completedRequiredCount || 0,
              optionalHabitsCount: (apiDay.totalHabits || 0) - (apiDay.requiredHabitsCount || 0),
              completedOptionalCount: (apiDay.completedHabits || 0) - (apiDay.completedRequiredCount || 0),
              canUseGrace: false,
              usedGrace: false,
              allHabits: apiDay.allHabits || [],
              warnings: apiDay.warnings || [],
              recommendations: apiDay.recommendations || [],
              dayOfWeek: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
              isToday: isToday,
              isFuture: isFuture,
              isPast: isPast
            });
          });
        } else {
          // Fallback: if backend doesn't return allDays, create basic structure
          console.warn('Backend did not return complete week data, using fallback');
          
          for (let i = 0; i < 7; i++) {
            const currentDate = new Date(weekStart);
            currentDate.setDate(weekStart.getDate() + i);
            const dateString = currentDate.toISOString().split('T')[0];
            const isFuture = currentDate > today;
            const isToday = dateString === todayString;
            
            if (isToday && response.currentDay) {
              // Use real data for today
              const todayData = { ...response.currentDay };
              
              // Calculate the correct values from allHabits array
              if (todayData.allHabits && todayData.allHabits.length > 0) {
                todayData.totalHabits = todayData.allHabits.length;
                todayData.completedHabits = todayData.allHabits.filter((habit: any) => habit.isCompleted).length;
                
                const requiredHabits = todayData.allHabits.filter((h: any) => h.isRequired);
                const completedRequired = requiredHabits.filter((h: any) => h.isCompleted);
                
                todayData.requiredHabitsCount = requiredHabits.length;
                todayData.completedRequiredCount = completedRequired.length;
                
                todayData.isCompleted = todayData.completedHabits === todayData.totalHabits;
                todayData.isPartiallyCompleted = todayData.completedHabits > 0 && !todayData.isCompleted;
              }
              
              days.push({
                ...todayData,
                dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
                isToday: true,
                isFuture: false,
                isPast: false
              });
            } else {
              // For other days, create empty structure
              days.push({
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
                isToday: false,
                isFuture: isFuture,
                isPast: !isFuture && !isToday
              });
            }
          }
        }
        
        return {
          weekStartDate: response.weekStartDate,
          weekEndDate: response.weekEndDate,
          weekNumber: this.getWeekNumber(weekStart),
          year: weekStart.getFullYear(),
          days: days,
          weeklyStats: {
            totalDays: 7,
            completedDays: days.filter(d => d.isCompleted).length,
            partialDays: days.filter(d => d.isPartiallyCompleted).length,
            incompleteDays: days.filter(d => !d.isCompleted && !d.isPartiallyCompleted).length,
            completionRate: Math.round((days.filter(d => d.isCompleted).length / 7) * 100),
            graceUsed: 0,
            graceRemaining: 1
          }
        };
      }),
      catchError(this.handleError)
    );
}
getWeeklyProgress(): Observable<WeeklyProgress> {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  return this.http.get<any>(`${this.baseUrl}/week/${year}/${month}/${day}`)
    .pipe(
      map(response => ({
        overallProgress: 75,
        graceRemaining: 1,
        graceUsed: 0,
        habitProgress: response.weeklyProgress?.map((habit: any) => ({
          habitId: habit.habitId || 0,
          habitName: habit.name || 'Unknown Habit',
          completedCount: habit.completions || 0,
          requiredCount: habit.target || 7,
          urgency: 'normal',
          remainingDays: 7,
          isAchievable: true,
          isOnTrack: (habit.completions || 0) >= (habit.target || 7) * 0.5,
          frequency: 'daily'
        })) || [],
        weekStart: response.weekStartDate,
        weekEnd: response.weekEndDate,
        isCurrentWeek: true
      })),
      catchError(this.handleError)
    );
}

// Add this helper method
private getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((dayOfYear + firstDayOfYear.getDay() + 1) / 7);
}


  /**
   * Complete or uncomplete a habit
   */
  completeHabit(request: { 
    habitId: number; 
    date: string; 
    isCompleted: boolean; 
    adHocId?: number 
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/complete-habit`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  getMonthData(year: number, month: number): Observable<DayData[]> {
  return this.http.get<any>(`${this.baseUrl}/month/${year}/${month}`)
    .pipe(
      map(response => {
        // Map the API response to DayData array
        if (response.days && Array.isArray(response.days)) {
          return response.days.map((apiDay: any) => {
            const dayDate = new Date(apiDay.date);
            const today = new Date();
            const isToday = dayDate.toDateString() === today.toDateString();
            const isFuture = dayDate > today;
            const isPast = dayDate < today && !isToday;

            return {
              date: apiDay.date,
              isCompleted: apiDay.isCompleted || false,
              isPartiallyCompleted: apiDay.isPartiallyCompleted || false,
              completedHabits: apiDay.completedHabits || 0,
              totalHabits: apiDay.totalHabits || 0,
              requiredHabitsCount: apiDay.requiredHabitsCount || 0,
              completedRequiredCount: apiDay.completedRequiredCount || 0,
              optionalHabitsCount: (apiDay.totalHabits || 0) - (apiDay.requiredHabitsCount || 0),
              completedOptionalCount: (apiDay.completedHabits || 0) - (apiDay.completedRequiredCount || 0),
              canUseGrace: false,
              usedGrace: false,
              allHabits: apiDay.allHabits || [],
              warnings: apiDay.warnings || [],
              recommendations: apiDay.recommendations || [],
              dayOfWeek: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
              isToday: isToday,
              isFuture: isFuture,
              isPast: isPast
            } as DayData;
          });
        }
        return [];
      }),
      catchError(this.handleError)
    );
}

/**
 * Get monthly statistics
 */
getMonthlyStats(year: number, month: number): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}/month/${year}/${month}`)
    .pipe(
      map(response => response.monthlyStats || {}),
      catchError(this.handleError)
    );
}

  /**
   * Use grace day
   */
  useGraceDay(request: { date: string; reason: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/use-grace-day`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Add ad-hoc task
   */
  addAdHocTask(request: { 
    name: string; 
    description: string; 
    date: string
    deadlineDate?: string
    deadlineTime?: string 
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/add-adhoc-task`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Edit ad-hoc task
   */
  editAdHocTask(request: { 
    adHocId: number; 
    name: string; 
    description: string 
  }): Observable<any> {
    return this.http.put(`${this.baseUrl}/edit-adhoc-task`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  // ===================================
  // NEW FLEXIBLE TASK METHODS
  // ===================================

  /**
   * Get flexible tasks for a specific day
   */
  getFlexibleTasksForDay(date: string): Observable<HabitWithFlexibility[]> {
    return this.http.get<HabitWithFlexibility[]>(`${this.baseUrl}/day/${date}/flexible-tasks`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Defer a task to tomorrow
   */
  deferTask(habitId: number, fromDate: string, reason?: string): Observable<HabitWithFlexibility> {
    const request = {
      habitId,
      fromDate,
      reason: reason || 'User requested'
    };

    return this.http.post<HabitWithFlexibility>(`${this.baseUrl}/defer-task`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Check if a task can be deferred
   */
  canDeferTask(habitId: number, fromDate: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.baseUrl}/task/${habitId}/can-defer?fromDate=${fromDate}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get deferral status for a habit
   */
  getDeferralStatus(habitId: number, date: string): Observable<{
    deferralsUsed: number;
    maxDeferrals: number;
    canStillDefer: boolean;
    urgencyLevel: string;
  }> {
    return this.http.get<any>(`${this.baseUrl}/task/${habitId}/deferral-status?date=${date}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // ===================================
  // ENHANCED EXISTING METHODS
  // ===================================

  /**
   * Move task to tomorrow (enhanced with flexibility support)
   */
  moveTaskToTomorrow(request: { 
    habitId: number; 
    currentDate: string; 
    reason?: string 
  }): Observable<any> {
    // First check if we should use the new flexible system
    return this.canDeferTask(request.habitId, request.currentDate)
      .pipe(
        switchMap((canDefer) => {
          if (canDefer) {
            // Use new flexible deferral system
            return this.deferTask(request.habitId, request.currentDate, request.reason);
          } else {
            // Fall back to original system
            return this.http.post(`${this.baseUrl}/move-task-tomorrow`, request);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
 * Get current day real-time data - same as used by weekly view
 */
getCurrentDayData(): Observable<DayData> {
  return this.getCurrentWeek().pipe(
    map(weekData => {
      const today = new Date();
      const todayData = weekData.days.find(day => 
        new Date(day.date).toDateString() === today.toDateString()
      );
      
      if (!todayData) {
        throw new Error('Today data not found in week response');
      }
      
      return todayData;
    }),
    catchError(this.handleError)
  );
}

/**
 * Get month data with real-time current day
 */
getMonthDataWithRealTimeToday(year: number, month: number): Observable<DayData[]> {
  const today = new Date();
  const isCurrentMonth = today.getMonth() === (month - 1) && today.getFullYear() === year;

  if (!isCurrentMonth) {
    // For non-current months, return historical data
    return this.getMonthData(year, month);
  }

  // For current month, merge historical data with real-time today
  return forkJoin({
    monthData: this.getMonthData(year, month),
    todayData: this.getCurrentDayData()
  }).pipe(
    map(({ monthData, todayData }) => {
      const todayString = today.toISOString().split('T')[0];
      const todayIndex = monthData.findIndex(day => day.date.split('T')[0] === todayString);
      
      if (todayIndex !== -1) {
        // Replace today's data with real-time data
        monthData[todayIndex] = {
          ...monthData[todayIndex],
          ...todayData,
          date: monthData[todayIndex].date // Keep original date format
        };
      }
      
      return monthData;
    }),
    catchError(this.handleError)
  );
}

  // ===================================
  // HABIT MANAGEMENT METHODS
  // ===================================

  /**
   * Get all habits with their flexibility settings
   */
  getAllHabitsWithFlexibility(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/habits/with-flexibility`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Update habit flexibility settings
   */
  updateHabitFlexibility(habitId: number, maxDeferrals: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/habits/${habitId}/flexibility`, { maxDeferrals })
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get habit completion history with deferral info
   */
  getHabitHistory(habitId: number, fromDate?: string, toDate?: string): Observable<any[]> {
    let url = `${this.baseUrl}/habits/${habitId}/history`;
    const params = new URLSearchParams();
    
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return this.http.get<any[]>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  // ===================================
  // ANALYTICS AND REPORTING
  // ===================================

  /**
   * Get flexibility usage analytics
   */
  getFlexibilityAnalytics(period: 'week' | 'month' | 'year' = 'month'): Observable<{
    totalDeferrals: number;
    deferralsPerHabit: { habitName: string; count: number }[];
    avgDeferralsPerTask: number;
    mostDeferredDay: string;
    flexibilityUsageRate: number;
  }> {
    return this.http.get<any>(`${this.baseUrl}/analytics/flexibility?period=${period}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get completion rate with flexibility impact
   */
  getCompletionRateAnalytics(): Observable<{
    overallCompletionRate: number;
    completionRateWithFlexibility: number;
    improvementFromFlexibility: number;
    tasksSavedByFlexibility: number;
  }> {
    return this.http.get<any>(`${this.baseUrl}/analytics/completion-rates`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // ===================================
  // BULK OPERATIONS
  // ===================================

  /**
   * Bulk defer multiple tasks
   */
  bulkDeferTasks(requests: { habitId: number; fromDate: string; reason?: string }[]): Observable<HabitWithFlexibility[]> {
    return this.http.post<HabitWithFlexibility[]>(`${this.baseUrl}/bulk-defer-tasks`, { tasks: requests })
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Reset all deferrals for a specific date
   */
  resetDeferrals(date: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/reset-deferrals`, { date })
      .pipe(
        catchError(this.handleError)
      );
  }

  smartDeferTask(habitId: number, fromDate: string, reason?: string): Observable<{
  success: boolean;
  message: string;
  newDueDate?: string;
  deferralsUsed?: number;
  remainingDeferrals?: number;
}> {
  const request = {
    habitId: habitId,
    fromDate: fromDate,
    reason: reason || 'User requested'
  };

  return this.http.post<any>(`${this.baseUrl}/smart-defer-task`, request)
    .pipe(
      catchError(this.handleError)
    );
}

  // ===================================
  // UTILITY METHODS
  // ===================================

  /**
   * Calculate urgency level based on deferral usage
   */
  calculateUrgencyLevel(deferralsUsed: number, maxDeferrals: number): 'safe' | 'warning' | 'urgent' | 'critical' {
    if (maxDeferrals === 0) return 'urgent'; // Daily tasks
    
    const remainingDeferrals = maxDeferrals - deferralsUsed;
    const usagePercentage = deferralsUsed / maxDeferrals;
    
    if (remainingDeferrals === 0) return 'critical';
    if (usagePercentage >= 0.66) return 'urgent';
    if (usagePercentage >= 0.33) return 'warning';
    return 'safe';
  }

  /**
   * Get flexibility info for display
   */
  getFlexibilityDisplayInfo(deferralsUsed: number, maxDeferrals: number): {
    icon: string;
    color: string;
    label: string;
    statusText: string;
  } {
    const urgency = this.calculateUrgencyLevel(deferralsUsed, maxDeferrals);
    const remainingDeferrals = maxDeferrals - deferralsUsed;
    
    switch (urgency) {
      case 'critical':
        return {
          icon: '🚨',
          color: '#dc3545',
          label: 'FINAL DAY',
          statusText: 'Must complete today - no more deferrals'
        };
      case 'urgent':
        return {
          icon: '🔥',
          color: '#fd7e14',
          label: `${remainingDeferrals} left`,
          statusText: remainingDeferrals === 1 ? 'Can move 1 more time' : `Can move ${remainingDeferrals} more times`
        };
      case 'warning':
        return {
          icon: '⚠️',
          color: '#ffc107',
          label: `${remainingDeferrals} left`,
          statusText: remainingDeferrals === 1 ? 'Can move 1 more time' : `Can move ${remainingDeferrals} more times`
        };
      case 'safe':
      default:
        return {
          icon: '✅',
          color: '#28a745',
          label: `${remainingDeferrals} left`,
          statusText: remainingDeferrals === 1 ? 'Can move 1 more time' : `Can move ${remainingDeferrals} more times`
        };
    }
  }

  /**
   * Validate if a habit can be deferred based on its frequency
   */
  canHabitBeDeferred(frequency: string): boolean {
    if (!frequency) return false;
    
    const freq = frequency.toLowerCase();
    // Daily habits cannot be deferred
    if (freq.includes('daily')) return false;
    
    // All other frequencies can be deferred
    return freq.includes('weekly') || 
           freq.includes('monthly') || 
           freq.includes('seasonal') ||
           freq.includes('every');
  }

  /**
   * Get max deferrals for a habit frequency
   */
  getMaxDeferralsForFrequency(frequency: string): number {
    if (!frequency) return 0;
    
    const freq = frequency.toLowerCase();
    if (freq.includes('daily')) return 0;
    if (freq.includes('weekly')) return 2;
    if (freq.includes('monthly') || freq.includes('seasonal')) return 6;
    if (freq.includes('every') && freq.includes('2')) return 1; // EveryTwoDays
    
    return 0;
  }


// Also add the getStreakInfo method if missing:
getStreakInfo(): Observable<StreakInfo> {
  // Mock data for now
  return of({
    currentStreak: 5,
    longestStreak: 15,
    totalDays: 45,
    weeklyRewards: 3,
    monthlyRewards: 1,
    nextMilestone: 7,
    lastUpdate: new Date().toISOString(),
    lastCompletedDate: new Date()
  }).pipe(
    catchError(this.handleError)
  );
}

completeAdHocTask(request: { 
  taskId: number; 
  isCompleted: boolean; 
  notes: string 
}): Observable<any> {
  return this.http.post(`${this.baseUrl}/complete-adhoc-task`, request)
    .pipe(
      catchError(this.handleError)
    );
}


  // ===================================
  // ERROR HANDLING
  // ===================================

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          errorMessage = error.error?.message || 'Bad request - please check your input';
          break;
        case 401:
          errorMessage = 'Unauthorized - please log in again';
          break;
        case 403:
          errorMessage = 'Forbidden - you don\'t have permission for this action';
          break;
        case 404:
          errorMessage = 'Resource not found';
          break;
        case 409:
          errorMessage = error.error?.message || 'Conflict - this action is not allowed';
          break;
        case 422:
          errorMessage = error.error?.message || 'Validation error - please check your input';
          break;
        case 500:
          errorMessage = 'Server error - please try again later';
          break;
        default:
          errorMessage = `Server Error: ${error.status} - ${error.error?.message || error.message}`;
      }
    }
    
    console.error('DisciplineService Error:', {
      status: error.status,
      message: errorMessage,
      fullError: error
    });
    
    return throwError(() => new Error(errorMessage));
  }
}

// ===================================
// ADDITIONAL IMPORTS NEEDED
// ===================================

import { switchMap } from 'rxjs/operators';

// ===================================
// ENVIRONMENT CONFIGURATION
// ===================================

// Make sure your environment.ts files have the correct API URL:
// 
// environment.ts:
// export const environment = {
//   production: false,
//   apiUrl: 'https://localhost:7025/api/discipline'
// };
//
// environment.prod.ts:
// export const environment = {
//   production: true,
//   apiUrl: 'https://your-production-api.com/api/discipline'
// };