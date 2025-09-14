import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface ScheduledHabit {
  habitId: number;
  name: string;
  description: string;
  isCompleted: boolean;
  isRequired: boolean;
  reason: string;
  priority: string;
  isLocked: boolean;
  completedAt?: string;
  hasDeadline: boolean;
  deadlineTime?: string; // Format: "18:00" for 6 PM
  timeRemaining?: string; // e.g., "2 hours 30 minutes remaining"
  isOverdue?: boolean;
  isAdHoc?: boolean; // New property to distinguish ad-hoc tasks
  adHocId?: number;
}

export interface DayData {
  date: string;
  allHabits: ScheduledHabit[];
  warnings: string[];
  recommendations: string[];
  canUseGrace: boolean;
  isCompleted: boolean;
  isPartiallyCompleted: boolean;
}

export interface WeeklyProgress {
  habitId: number;
  name: string;
  completions: number;
  target: number;
  percentage: number;
}

export interface DayStatus {
  date: string;
  isCompleted: boolean;
  isPartiallyCompleted: boolean;
  canUseGrace: boolean;
  requiredHabitsCount: number;
  completedRequiredCount: number;
}

export interface WeekDataResponse {
  weekStartDate: string;
  weekEndDate: string;
  currentDay: DayData;
  weeklyHabitProgress: WeeklyProgress[];
  dayStatuses: DayStatus[];
}

export interface CompleteHabitRequest {
  habitId: number;
  date: string;
  isCompleted: boolean;
  notes?: string;
}

export interface UseGraceRequest {
  date: string;
  reason?: string;
}

export interface MoveTaskRequest {
  habitId: number;
  currentDate: string;
  reason?: string;
}

export interface AdHocTask {
  id: number;
  name: string;
  description: string;
  date: string;
  isCompleted: boolean;
  completedAt?: string;
  notes: string;
  createdAt: string;
}

export interface AddAdHocTaskRequest {
  name: string;
  description?: string;
  date: string;
}

export interface CompleteAdHocTaskRequest {
  taskId: number;
  isCompleted: boolean;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DisciplineService {
  private readonly apiUrl = 'https://localhost:7025/api/discipline';

  constructor(private http: HttpClient) { }

  /**
   * Get smart schedule data for a specific week
   */
  getWeekData(year: number, month: number, day: number): Observable<WeekDataResponse> {
    return this.http.get<WeekDataResponse>(`${this.apiUrl}/week/${year}/${month}/${day}`)
      .pipe(
        map(response => this.normalizeWeekData(response)),
        catchError(this.handleError)
      );
  }

  /**
   * Complete or uncomplete a habit for a specific date
   */
  completeHabit(request: CompleteHabitRequest): Observable<DayData> {
    return this.http.post<DayData>(`${this.apiUrl}/complete-habit`, request)
      .pipe(
        map(response => this.normalizeDayData(response)),
        catchError(this.handleError)
      );
  }

  /**
   * Use a grace day to maintain streak
   */
  useGraceDay(request: UseGraceRequest): Observable<DayData> {
    return this.http.post<DayData>(`${this.apiUrl}/use-grace`, request)
      .pipe(
        map(response => this.normalizeDayData(response)),
        catchError(this.handleError)
      );
  }

  addAdHocTask(request: AddAdHocTaskRequest): Observable<any> {
  return this.http.post(`${this.apiUrl}/add-adhoc-task`, request);
}

  completeAdHocTask(request: CompleteAdHocTaskRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/complete-adhoc-task`, request);
  }

  /**
   * Get current week data (convenience method)
   */
  getCurrentWeekData(): Observable<WeekDataResponse> {
    const today = new Date();
    return this.getWeekData(
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate()
    );
  }

  /**
   * Get today's smart schedule data
   */
  getTodayData(): Observable<DayData> {
    return this.getCurrentWeekData().pipe(
      map(weekData => weekData.currentDay)
    );
  }

  /**
   * Check API health
   */
  checkHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Normalize week data from API response
   */
  private normalizeWeekData(data: any): WeekDataResponse {
    return {
      weekStartDate: data.weekStartDate || '',
      weekEndDate: data.weekEndDate || '',
      currentDay: this.normalizeDayData(data.currentDay || {}),
      weeklyHabitProgress: this.normalizeWeeklyProgress(data.weeklyHabitProgress || []),
      dayStatuses: this.normalizeDayStatuses(data.dayStatuses || [])
    };
  }

  /**
   * Normalize day data from API response
   */
  private normalizeDayData(data: any): DayData {
    return {
      date: data.date || new Date().toISOString().split('T')[0],
      allHabits: this.normalizeHabits(data.allHabits || []),
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      canUseGrace: Boolean(data.canUseGrace),
      isCompleted: Boolean(data.isCompleted),
      isPartiallyCompleted: Boolean(data.isPartiallyCompleted)
    };
  }

  /**
   * Normalize habits array from API response
   */
private normalizeHabits(habits: any[]): ScheduledHabit[] {
  return habits.map(habit => ({
    habitId: habit.habitId || 0,
    name: habit.name || '',
    description: habit.description || '',
    isCompleted: Boolean(habit.isCompleted),
    isRequired: Boolean(habit.isRequired),
    isLocked: habit.isLocked || false,
    reason: habit.reason || '',
    priority: habit.priority || 'Normal',
    completedAt: habit.completedAt || undefined,
    hasDeadline: Boolean(habit.hasDeadline),
    deadlineTime: habit.deadlineTime || undefined,
    
    // ✅ FIX: Only calculate timeRemaining and isOverdue for habits with deadlines
    timeRemaining: habit.hasDeadline ? this.calculateTimeRemaining(habit.deadlineTime) : undefined,
    isOverdue: habit.hasDeadline ? this.isOverdue(habit.deadlineTime, habit.isCompleted) : false
  }));
}

  /**
   * Calculate time remaining until deadline
   */
  private calculateTimeRemaining(deadlineTime?: string): string | undefined {
    if (!deadlineTime) return undefined;
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const deadlineDateTime = new Date(`${today}T${deadlineTime}`);
    
    // If deadline has passed, return undefined
    if (now > deadlineDateTime) return undefined;
    
    const diffMs = deadlineDateTime.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }

  /**
   * Check if a habit is overdue
   */
public isOverdue(deadlineTime?: string, isCompleted?: boolean): boolean {
  // ✅ If no deadline time or already completed, cannot be overdue
  if (!deadlineTime || isCompleted) {
    return false;
  }
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const deadlineDateTime = new Date(`${today}T${deadlineTime}`);
  
  return now > deadlineDateTime;
}
  /**
   * Normalize weekly progress from API response
   */
  private normalizeWeeklyProgress(progress: any[]): WeeklyProgress[] {
    return progress.map(item => ({
      habitId: item.habitId || 0,
      name: item.name || '',
      completions: Number(item.completions) || 0,
      target: Number(item.target) || 0,
      percentage: Number(item.percentage) || 0
    }));
  }

  /**
   * Normalize day statuses from API response
   */
  private normalizeDayStatuses(statuses: any[]): DayStatus[] {
    return statuses.map(status => ({
      date: status.date || '',
      isCompleted: Boolean(status.isCompleted),
      isPartiallyCompleted: Boolean(status.isPartiallyCompleted),
      canUseGrace: Boolean(status.canUseGrace),
      requiredHabitsCount: Number(status.requiredHabitsCount) || 0,
      completedRequiredCount: Number(status.completedRequiredCount) || 0
    }));
  }

  moveTaskToTomorrow(request: MoveTaskRequest): Observable<any> {
  return this.http.post(`${this.apiUrl}/move-task-tomorrow`, request);
}

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error ${error.status}: ${error.message}`;
      
      if (error.status === 0) {
        errorMessage = 'Unable to connect to the server. Please check if the API is running.';
      } else if (error.status === 404) {
        errorMessage = 'API endpoint not found. Please check the server configuration.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
    }

    console.error('DisciplineService Error:', error);
    return throwError(() => new Error(errorMessage));
  }

  // Utility methods for date handling
  static toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static fromDateString(dateString: string): Date {
    return new Date(dateString + 'T00:00:00');
  }

  static isToday(dateString: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  }

  static isFuture(dateString: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateString > today;
  }

  static formatDisplayDate(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  static getDayName(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }

  static getDayNumber(dateString: string): number {
    const date = new Date(dateString + 'T00:00:00');
    return date.getDate();
  }
}