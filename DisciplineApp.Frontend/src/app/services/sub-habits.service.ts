// src/app/services/sub-habits.service.ts - NEW FILE

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SubHabit,
  CreateSubHabitRequest,
  UpdateSubHabitRequest,
  CompleteSubHabitRequest,
  CompleteAllSubHabitsRequest,
  SubHabitCompletionResponse,
  CompleteAllSubHabitsResponse,
  SubHabitsWithCompletionsResponse
} from '../models/discipline.models';

@Injectable({
  providedIn: 'root'
})
export class SubHabitsService {
  private readonly apiUrl = 'https://localhost:7025/api/subhabits';

  constructor(private http: HttpClient) {}

  // Get all sub-habits for a habit
  getSubHabitsByHabit(habitId: number): Observable<SubHabit[]> {
    return this.http.get<SubHabit[]>(`${this.apiUrl}/habit/${habitId}`);
  }

  // Get sub-habits with completion status for a specific date
  getSubHabitsWithCompletions(habitId: number, date: string): Observable<SubHabitsWithCompletionsResponse> {
    return this.http.get<SubHabitsWithCompletionsResponse>(`${this.apiUrl}/habit/${habitId}/date/${date}`);
  }

  // Create a new sub-habit
  createSubHabit(request: CreateSubHabitRequest): Observable<SubHabit> {
    return this.http.post<SubHabit>(this.apiUrl, request);
  }

  // Update an existing sub-habit
  updateSubHabit(id: number, request: UpdateSubHabitRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, request);
  }

  // Complete/uncomplete a specific sub-habit
  completeSubHabit(id: number, request: CompleteSubHabitRequest): Observable<SubHabitCompletionResponse> {
    return this.http.post<SubHabitCompletionResponse>(`${this.apiUrl}/${id}/complete`, request);
  }

  // Complete all sub-habits for a habit (quick-complete)
  completeAllSubHabits(habitId: number, request: CompleteAllSubHabitsRequest): Observable<CompleteAllSubHabitsResponse> {
    return this.http.post<CompleteAllSubHabitsResponse>(`${this.apiUrl}/habit/${habitId}/complete-all`, request);
  }

  // Delete a sub-habit
  deleteSubHabit(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Get a specific sub-habit by ID
  getSubHabitById(id: number): Observable<SubHabit> {
    return this.http.get<SubHabit>(`${this.apiUrl}/${id}`);
  }
}