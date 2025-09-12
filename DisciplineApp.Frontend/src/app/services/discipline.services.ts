// src/app/services/discipline.service.ts - Fixed timezone handling

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  YearCalendar, 
  CalendarDay, 
  StreakInfo, 
  ToggleDayRequest, 
  UpdateDayRequest,
  DateUtils 
} from '../models/discipline.models';

@Injectable({
  providedIn: 'root'
})
export class DisciplineService {
  private readonly apiUrl = 'https://localhost:7001/api/discipline';

  constructor(private http: HttpClient) {}

  /**
   * Get calendar data for a specific year
   */
  getCalendar(year: number): Observable<YearCalendar> {
    return this.http.get<YearCalendar>(`${this.apiUrl}/calendar/${year}`)
      .pipe(
        map(calendar => this.normalizeCalendarDates(calendar)),
        catchError(this.handleError)
      );
  }

  /**
   * Toggle completion status for a specific day
   * Uses proper date string format to avoid timezone issues
   */
  toggleDay(request: ToggleDayRequest): Observable<CalendarDay> {
    // Ensure date is in correct format
    const normalizedRequest = {
      date: this.normalizeDateString(request.date)
    };

    return this.http.post<CalendarDay>(`${this.apiUrl}/toggle`, normalizedRequest)
      .pipe(
        map(day => this.normalizeCalendarDay(day)),
        catchError(this.handleError)
      );
  }

  /**
   * Update a specific day's completion status and notes
   */
  updateDay(request: UpdateDayRequest): Observable<CalendarDay> {
    // Ensure date is in correct format
    const normalizedRequest = {
      ...request,
      date: this.normalizeDateString(request.date)
    };

    return this.http.put<CalendarDay>(`${this.apiUrl}/day`, normalizedRequest)
      .pipe(
        map(day => this.normalizeCalendarDay(day)),
        catchError(this.handleError)
      );
  }

  /**
   * Get current streak information
   */
  getStreakInfo(): Observable<StreakInfo> {
    return this.http.get<StreakInfo>(`${this.apiUrl}/streak`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get details for a specific day
   */
  getDay(dateString: string): Observable<CalendarDay> {
    const normalizedDate = this.normalizeDateString(dateString);
    
    return this.http.get<CalendarDay>(`${this.apiUrl}/day/${normalizedDate}`)
      .pipe(
        map(day => this.normalizeCalendarDay(day)),
        catchError(this.handleError)
      );
  }

  /**
   * Get today's completion status
   */
  getToday(): Observable<CalendarDay> {
    return this.http.get<CalendarDay>(`${this.apiUrl}/today`)
      .pipe(
        map(day => this.normalizeCalendarDay(day)),
        catchError(this.handleError)
      );
  }

  /**
   * Mark today as completed (quick action)
   */
  completeToday(): Observable<CalendarDay> {
    return this.http.post<CalendarDay>(`${this.apiUrl}/complete-today`, {})
      .pipe(
        map(day => this.normalizeCalendarDay(day)),
        catchError(this.handleError)
      );
  }

  /**
   * Toggle day by Date object (convenience method)
   */
  toggleDayByDate(date: Date): Observable<CalendarDay> {
    const dateString = DateUtils.toDateString(date);
    return this.toggleDay({ date: dateString });
  }

  /**
   * Update day by Date object (convenience method)
   */
  updateDayByDate(date: Date, isCompleted: boolean, notes?: string): Observable<CalendarDay> {
    const dateString = DateUtils.toDateString(date);
    return this.updateDay({ date: dateString, isCompleted, notes });
  }

  /**
   * Health check endpoint
   */
  healthCheck(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`)
      .pipe(catchError(this.handleError));
  }

  // Private helper methods

  /**
   * Normalizes a date string to ensure it's in YYYY-MM-DD format
   * This prevents timezone conversion issues
   */
  private normalizeDateString(dateInput: string | Date): string {
    if (typeof dateInput === 'string') {
      // If it's already a string, validate and return
      if (DateUtils.isValidDateString(dateInput)) {
        return dateInput;
      }
      
      // Try to parse as Date and convert
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        return DateUtils.toDateString(date);
      }
      
      throw new Error(`Invalid date format: ${dateInput}`);
    }
    
    // If it's a Date object
    return DateUtils.toDateString(dateInput);
  }

  /**
   * Normalizes calendar day dates to ensure consistency
   */
  private normalizeCalendarDay(day: CalendarDay): CalendarDay {
    return {
      ...day,
      date: this.normalizeDateString(day.date)
    };
  }

  /**
   * Normalizes all dates in a calendar response
   */
  private normalizeCalendarDates(calendar: YearCalendar): YearCalendar {
    return {
      ...calendar,
      months: calendar.months.map(month => ({
        ...month,
        days: month.days.map(day => this.normalizeCalendarDay(day))
      }))
    };
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
      
      if (error.error && typeof error.error === 'string') {
        errorMessage += ` - ${error.error}`;
      }
    }
    
    console.error('DisciplineService Error:', errorMessage, error);
    return throwError(() => errorMessage);
  };
}