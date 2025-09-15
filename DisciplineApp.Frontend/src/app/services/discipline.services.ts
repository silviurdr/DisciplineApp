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
  ScheduledHabit,
  HabitWithFlexibility,
  StreakInfo
} from '../models/discipline.models';

import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

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
// REPLACE getCurrentWeek() method with this:
getCurrentWeek(): Observable<WeekData> {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // JS months are 0-based
  const day = today.getDate();

  return this.http.get<any>(`${this.baseUrl}/week/${year}/${month}/${day}`)
    .pipe(
      map(response => ({
        weekNumber: response.weekNumber ?? this.getWeekNumber(today),
        year: response.year ?? year,
        weekStartDate: response.weekStartDate,
        weekEndDate: response.weekEndDate,
        days: [response.currentDay], // Transform to match your interface
        weeklyStats: {
          totalDays: 7,
          completedDays: 0,
          partialDays: 0,
          incompleteDays: 0,
          completionRate: 0,
          graceUsed: 0,
          graceRemaining: 1
        }
      })),
      catchError(this.handleError)
    );
}

/**
 * Utility to get ISO week number from a date
 */
private getWeekNumber(date: Date): number {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

// REPLACE getWeeklyProgress() method with this:
getWeeklyProgress(): Observable<WeeklyProgress> {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  return this.http.get<any>(`${this.baseUrl}/week/${year}/${month}/${day}`)
    .pipe(
      map(response => ({
        overallProgress: 75, // Calculate from response data
        graceRemaining: 1,
        graceUsed: 0,
        habitProgress: response.weeklyProgress || [],
        weekStart: response.weekStartDate,
        weekEnd: response.weekEndDate,
        isCurrentWeek: true
      })),
      catchError(this.handleError)
    );
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

// Add this method to your DisciplineService
getMonthData(year: number, month: number): Observable<DayData[]> {
  // Since you don't have a month endpoint, we can call the week endpoint for each week in the month
  // Or return mock data for now
  
  const mockMonthData: DayData[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    mockMonthData.push({
      date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      isCompleted: Math.random() > 0.5, // Random completion for demo
      isPartiallyCompleted: Math.random() > 0.7,
      completedHabits: Math.floor(Math.random() * 5),
      totalHabits: 5,
      requiredHabitsCount: 3,
      completedRequiredCount: Math.floor(Math.random() * 3),
      optionalHabitsCount: 2,
      completedOptionalCount: Math.floor(Math.random() * 2),
      canUseGrace: false,
      usedGrace: false,
      allHabits: [],
      warnings: [],
      recommendations: [],
      dayOfWeek: new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: false,
      isFuture: new Date(year, month - 1, day) > new Date(),
      isPast: new Date(year, month - 1, day) < new Date()
    });
  }
  
  return of(mockMonthData).pipe(
    delay(500), // Simulate API delay
    catchError(this.handleError)
  );
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