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
   * Toggle completion status for a specific day
   */
  toggleDay(request: ToggleDayRequest): Observable<CalendarDay> {
    return this.http.post<CalendarDay>(`${this.apiUrl}/toggle`, request)
      .pipe(
        tap(data => console.log('Day toggled:', data)),
        catchError(this.handleError)
      );
  }

  /**
   * Update notes for a specific day
   */
  updateNotes(request: UpdateNotesRequest): Observable<CalendarDay> {
    return this.http.put<CalendarDay>(`${this.apiUrl}/notes`, request)
      .pipe(
        tap(data => console.log('Notes updated:', data)),
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
   * Health check
   */
  healthCheck(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`)
      .pipe(
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