// src/app/services/habit.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError  } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';

// API Models (matching your backend)
export interface ApiDayStatus {
  date: string;
  isCompleted: boolean;
  isPartiallyCompleted: boolean;
  isGraceUsed: boolean;
  canUseGrace: boolean;
  requiredHabits: ApiHabitStatus[];
  optionalHabits: ApiHabitStatus[];
  warnings: string[];
  recommendations: string[];
  streakDay?: number;
  rewards?: string[];
}

export interface ApiHabitStatus {
  habitId: string;
  habitName: string;
  isCompleted: boolean;
  isRequired: boolean;
  description: string;
  urgencyLevel: 'Normal' | 'Urgent' | 'Critical';
}

export interface ApiWeeklyProgress {
  weekStart: string;
  weekEnd: string;
  graceRemaining: number;
  graceUsed: number;
  overallProgress: number;
  habitProgress: ApiHabitProgress[];
}

export interface ApiHabitProgress {
  habitName: string;
  completedCount: number;
  requiredCount: number;
  urgency: string;
  remainingDays: number;
  isAchievable: boolean;
  isOnTrack?: boolean;
}

export interface CompleteHabitRequest {
  habitId: number;
  date: string;
  notes?: string;
}

export interface StreakInfo {
  currentStreak: number;
  bestStreak: number;
  totalDays: number;
}

@Injectable({
  providedIn: 'root'
})
export class HabitService {
  private readonly apiUrl = 'https://localhost:7025/api/habittracking'; // Update with your API URL
  
  // State management
  private weeklyProgressSubject = new BehaviorSubject<ApiWeeklyProgress | null>(null);
  public weeklyProgress$ = this.weeklyProgressSubject.asObservable();

  private currentWeekDaysSubject = new BehaviorSubject<ApiDayStatus[]>([]);
  public currentWeekDays$ = this.currentWeekDaysSubject.asObservable();

  constructor(private http: HttpClient) {}



  completeHabit(request: CompleteHabitRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/complete`, request)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get day status for a specific date
   */
 getDayStatus(date: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/day/${date}`)
      .pipe(catchError(this.handleError));
  }

  getTodayStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/today`)
      .pipe(catchError(this.handleError));
  }

  getWeekStatus(date: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/week/${date}`)
      .pipe(catchError(this.handleError));
  }

  healthCheck(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`)
      .pipe(catchError(this.handleError));
  }


  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
      if (error.error && typeof error.error === 'string') {
        errorMessage += ` - ${error.error}`;
      }
    }
    
    console.error('HabitService Error:', errorMessage, error);
    
    // ✅ FIX: Use the factory function syntax for throwError
    return throwError(() => new Error(errorMessage));
  };
  /**
   * Load data for the current week (September 11-17, 2025)
   */
  loadCurrentWeek(): Observable<{days: ApiDayStatus[], progress: ApiWeeklyProgress}> {
    const currentDate = new Date('2025-09-11'); // Your current week start
    
    // Load weekly progress
    const weeklyProgress$ = this.getWeeklyProgress(currentDate);

    // Load each day's status
    const weekDays: Observable<ApiDayStatus>[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      
      weekDays.push(this.getDayStatus(date.toISOString().split('T')[0]));
    }

    // Combine all requests
    return new Observable(observer => {
      Promise.all([
        Promise.all(weekDays.map(day$ => day$.toPromise())),
        weeklyProgress$.toPromise()
      ]).then(([days, progress]) => {
        const result = { 
          days: days.filter(day => day !== undefined) as ApiDayStatus[], 
          progress: progress || this.getMockWeeklyProgress() 
        };
        
        this.currentWeekDaysSubject.next(result.days);
        this.weeklyProgressSubject.next(result.progress);
        
        observer.next(result);
        observer.complete();
      }).catch(error => {
        console.error('Error loading week data:', error);
        // Fallback to mock data
        const mockResult = this.getMockWeekData();
        this.currentWeekDaysSubject.next(mockResult.days);
        this.weeklyProgressSubject.next(mockResult.progress);
        observer.next(mockResult);
        observer.complete();
      });
    });
  }

  /**
   * Get weekly progress for the week containing the specified date
   */
  getWeeklyProgress(date: Date): Observable<ApiWeeklyProgress> {
    return this.http.get<ApiWeeklyProgress>(
      `${this.apiUrl}/habittracking/week/${date.toISOString()}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching weekly progress:', error);
        return of(this.getMockWeeklyProgress());
      })
    );
  }

  /**
   * Toggle habit completion for a specific date
   */
toggleHabitCompletion(habitId: string, date: string, isCompleted: boolean): Observable<any> {
  const numericHabitId = parseInt(habitId, 10);
  
  if (isNaN(numericHabitId)) {
    console.error(`Invalid habit ID: ${habitId}`);
    return of(null);
  }

  // Your backend expects a direct CompleteHabitRequest object (not wrapped)
  const request = {
    habitId: numericHabitId,
    date: date,
    isCompleted: isCompleted
  };

  console.log('Sending habit completion request:', request);

  return this.http.post<any>(
    `${this.apiUrl}/habittracking/complete`,
    request  // Send direct request, not wrapped
  ).pipe(
    tap(response => {
      console.log('Habit completion response:', response);
    }),
    catchError(error => {
      console.error('Error toggling habit completion:', error);
      console.error('Error details:', error.error);
      return of({ error: true, message: error.message });
    })
  );
}

private mapApiResponseToFrontend(apiResponse: any): any {
  // Transform the API response to match your frontend DayStatus format
  return {
    date: apiResponse.date || apiResponse.Date,
    isCompleted: apiResponse.isCompleted || apiResponse.IsCompleted,
    isPartiallyCompleted: apiResponse.isPartiallyCompleted || apiResponse.IsPartiallyCompleted,
    isGraceUsed: apiResponse.isGraceUsed || apiResponse.IsGraceUsed,
    canUseGrace: apiResponse.canUseGrace || apiResponse.CanUseGrace,
    requiredHabits: apiResponse.requiredHabits || apiResponse.RequiredHabits || [],
    optionalHabits: apiResponse.optionalHabits || apiResponse.OptionalHabits || [],
    warnings: apiResponse.warnings || apiResponse.Warnings || [],
    recommendations: apiResponse.recommendations || apiResponse.Recommendations || [],
    streakDay: apiResponse.streakDay || apiResponse.StreakDay,
    rewards: apiResponse.rewards || apiResponse.Rewards || []
  };
}
  /**
   * Use a grace day for a specific date
   */
  useGraceDay(date: string): Observable<ApiDayStatus> {
    return this.http.post<ApiDayStatus>(
      `${this.apiUrl}/habittracking/grace`,
      { date }
    ).pipe(
      tap(updatedDay => {
        // Update local state
        const currentDays = this.currentWeekDaysSubject.value;
        const dayIndex = currentDays.findIndex(d => d.date === date);
        if (dayIndex !== -1) {
          currentDays[dayIndex] = updatedDay;
          this.currentWeekDaysSubject.next([...currentDays]);
        }
        
        // Refresh weekly progress
        this.refreshWeeklyProgress();
      }),
      catchError(error => {
        console.error('Error using grace day:', error);
        return of(this.getMockDayStatus(date));
      })
    );
  }

  /**
   * Get smart reminders for current progress
   */
  getSmartReminders(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/habittracking/reminders`)
      .pipe(
        catchError(error => {
          console.error('Error fetching reminders:', error);
          return of([
            'Complete your phone lock habit for today',
            'You need to clean dishes soon (rolling habit)',
            'Vacuum scheduled for tomorrow'
          ]);
        })
      );
  }

  /**
   * Get current streak information
   */
  getStreakInfo(): Observable<StreakInfo> {
    return this.http.get<StreakInfo>(`${this.apiUrl}/habittracking/streak`)
      .pipe(
        catchError(error => {
          console.error('Error fetching streak info:', error);
          return of({
            currentStreak: 0,
            bestStreak: 0,
            totalDays: 0
          });
        })
      );
  }

  /**
   * Refresh weekly progress from server
   */
  private refreshWeeklyProgress(): void {
    const currentDate = new Date('2025-09-11');
    this.getWeeklyProgress(currentDate).subscribe(progress => {
      this.weeklyProgressSubject.next(progress);
    });
  }

  // Mock data methods for fallback when API is not available
  private getMockDayStatus(date: string): ApiDayStatus {
    const today = new Date().toISOString().split('T')[0];
    const isFuture = date > today;
    
    if (isFuture) {
      return {
        date,
        isCompleted: false,
        isPartiallyCompleted: false,
        isGraceUsed: false,
        canUseGrace: true,
        requiredHabits: this.getMockHabitsForDay(date, false),
        optionalHabits: [],
        warnings: [],
        recommendations: []
      };
    }

    const completedHabits = Math.floor(Math.random() * 4);
    const habits = this.getMockHabitsForDay(date, completedHabits > 0);
    const isCompleted = habits.every(h => h.isCompleted);
    const isPartiallyCompleted = habits.some(h => h.isCompleted) && !isCompleted;

    return {
      date,
      isCompleted,
      isPartiallyCompleted,
      isGraceUsed: !isCompleted && !isPartiallyCompleted && Math.random() > 0.8,
      canUseGrace: !isCompleted,
      requiredHabits: habits,
      optionalHabits: [],
      warnings: isCompleted ? [] : ['Some habits not completed'],
      recommendations: isCompleted ? [] : ['Focus on completing remaining habits'],
      streakDay: isCompleted ? Math.floor(Math.random() * 30) + 1 : undefined,
      rewards: isCompleted && Math.random() > 0.7 ? ['Coffee'] : []
    };
  }

  private getMockHabitsForDay(date: string, shouldHaveCompletions: boolean): ApiHabitStatus[] {
    const baseHabits = [
      {
        habitId: 'phone-lock',
        habitName: 'Phone Lock Box',
        isCompleted: shouldHaveCompletions && Math.random() > 0.2,
        isRequired: true,
        description: 'Lock iPhone in the lock box for the day',
        urgencyLevel: 'Normal' as const
      },
      {
        habitId: 'dishes',
        habitName: 'Clean Dishes',
        isCompleted: shouldHaveCompletions && Math.random() > 0.3,
        isRequired: this.shouldCleanDishes(date),
        description: 'Ensure sink is clean, no dishes left',
        urgencyLevel: 'Normal' as const
      }
    ];

    // Add weekly habits based on day
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 1 || dayOfWeek === 4) { // Monday or Thursday
      baseHabits.push({
        habitId: 'vacuum',
        habitName: 'Vacuum & Sweep',
        isCompleted: shouldHaveCompletions && Math.random() > 0.4,
        isRequired: true,
        description: 'Vacuum and sweep all floors',
        urgencyLevel: 'Normal' as const
      });
    }

    if (dayOfWeek === 0) { // Sunday
      baseHabits.push({
        habitId: 'bathroom',
        habitName: 'Clean Bathroom',
        isCompleted: shouldHaveCompletions && Math.random() > 0.5,
        isRequired: true,
        description: 'Full bathroom cleaning',
        urgencyLevel: 'Normal' as const
      });
    }

    return baseHabits;
  }

  private shouldCleanDishes(date: string): boolean {
    const daysSinceEpoch = Math.floor(new Date(date).getTime() / (1000 * 60 * 60 * 24));
    return daysSinceEpoch % 2 === 0;
  }

  private getMockWeeklyProgress(): ApiWeeklyProgress {
    return {
      weekStart: '2025-09-11',
      weekEnd: '2025-09-17',
      graceRemaining: 1,
      graceUsed: 0,
      overallProgress: 0,
      habitProgress: [
        {
          habitName: 'Phone Lock',
          completedCount: 0,
          requiredCount: 7,
          urgency: 'Normal',
          remainingDays: 7,
          isAchievable: true,
          isOnTrack: true
        },
        {
          habitName: 'Dishes',
          completedCount: 0,
          requiredCount: 4,
          urgency: 'Normal',
          remainingDays: 4,
          isAchievable: true,
          isOnTrack: true
        },
        {
          habitName: 'Vacuum',
          completedCount: 0,
          requiredCount: 2,
          urgency: 'Normal',
          remainingDays: 2,
          isAchievable: true,
          isOnTrack: true
        },
        {
          habitName: 'Bathroom',
          completedCount: 0,
          requiredCount: 1,
          urgency: 'Normal',
          remainingDays: 1,
          isAchievable: true,
          isOnTrack: true
        }
      ]
    };
  }

  private getMockWeekData(): {days: ApiDayStatus[], progress: ApiWeeklyProgress} {
    const days: ApiDayStatus[] = [];
    const currentDate = new Date('2025-09-11');
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      days.push(this.getMockDayStatus(date.toISOString().split('T')[0]));
    }

    return {
      days,
      progress: this.getMockWeeklyProgress()
    };
  }
}