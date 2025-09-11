import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { 
  YearCalendar, 
  CalendarDay, 
  StreakInfo, 
  ToggleDayRequest, 
  UpdateNotesRequest 
} from '../models/discipline.models';

// Define the DayStatus interface
export interface DayStatus {
  date: string;
  isCompleted: boolean;
  isGraceUsed: boolean;
  habitStatuses: HabitStatus[];
  warnings: string[];
  recommendations: string[];
  canUseGrace: boolean;
}

// Define the HabitStatus interface
export interface HabitStatus {
  habitId: number;
  habitName: string;
  isRequired: boolean;
  isCompleted: boolean;
  currentWindowCount: number;
  requiredWindowCount: number;
  lastCompletedDate?: string;
  status: string;
}

// Define the WeeklyProgress interface
export interface WeeklyProgress {
  weekStart: string;
  weekEnd: string;
  graceUsed: number;
  graceRemaining: number;
  habitProgress: HabitWeeklyStatus[];
}

// Define the HabitWeeklyStatus interface
export interface HabitWeeklyStatus {
  habitId: number;
  habitName: string;
  completedCount: number;
  requiredCount: number;
  remainingDays: number;
  isAchievable: boolean;
  urgency: string; // "Normal", "Urgent", "Critical"
}

@Injectable({
  providedIn: 'root'
})
export class DisciplineService {
  private readonly apiUrl = 'https://localhost:7025/api/discipline'; // Update with your API URL

  constructor(private http: HttpClient) {}

  /**
   * Get calendar data for a specific year
   */
  getCalendar(year: number): Observable<YearCalendar> {
    return this.http.get<YearCalendar>(`${this.apiUrl}/calendar/${year}`)
      .pipe(
        tap(data => console.log('Calendar data loaded:', data)),
        catchError(this.handleError)
      );
  }

  /**
   * Get day status for a specific date
   */
  getDayStatus(date: string): Observable<DayStatus> {
    return this.http.get<DayStatus>(`${this.apiUrl}/day/${date}`)
      .pipe(
        tap(data => console.log('Day status loaded:', data)),
        catchError(this.handleError)
      );
  }

  /**
   * Get weekly progress for a specific date
   */
  getWeeklyProgress(date: string): Observable<WeeklyProgress> {
    return this.http.get<WeeklyProgress>(`${this.apiUrl}/week/${date}`)
      .pipe(
        tap(data => console.log('Weekly progress loaded:', data)),
        catchError(this.handleError)
      );
  }

  /**
   * Get streak statistics
   */
  getStreakInfo(): Observable<StreakInfo> {
    return this.http.get<StreakInfo>(`${this.apiUrl}/streaks`)
      .pipe(
        tap(data => console.log('Streak info loaded:', data)),
        catchError(this.handleError)
      );
  }

  /**
   * Get smart reminders
   */
  getSmartReminders(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/reminders`)
      .pipe(
        tap(data => console.log('Smart reminders loaded:', data)),
        catchError(this.handleError)
      );
  }

  /**
   * Complete a habit for a specific date
   */
  completeHabit(request: ToggleDayRequest): Observable<DayStatus> {
    return this.http.post<DayStatus>(`${this.apiUrl}/complete`, request)
      .pipe(
        tap(data => console.log('Habit completed:', data)),
        catchError(this.handleError)
      );
  }

  /**
   * Use a grace day for a specific date
   */
  useGraceDay(request: UpdateNotesRequest): Observable<DayStatus> {
    return this.http.post<DayStatus>(`${this.apiUrl}/grace`, request)
      .pipe(
        tap(data => console.log('Grace day used:', data)),
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.error?.message || error.message}`;
    }
    
    console.error('API Error:', errorMessage);
    return throwError(() => errorMessage);
  }
}