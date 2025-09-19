import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interfaces
interface Habit {
  id: number;
  name: string;
  description: string;
  frequency: number; // Backend returns number (enum)
  weeklyTarget: number;
  monthlyTarget: number;
  seasonalTarget: number;
  isActive: boolean;
  isLocked: boolean;
  hasDeadline: boolean;
  deadlineTime?: string;
  createdAt: string;
  isOptional?: boolean;
}

interface CreateHabitRequest {
  name: string;
  description: string;
  frequency: string; // Backend expects string
  weeklyTarget?: number;
  monthlyTarget?: number;
  seasonalTarget?: number;
  hasDeadline?: boolean;
  deadlineTime?: string;
  isOptional?: boolean;
}

interface UpdateHabitRequest {
  name: string;
  description: string;
  frequency: string; // Backend expects string
  weeklyTarget?: number;
  monthlyTarget?: number;
  seasonalTarget?: number;
  isActive: boolean;
  hasDeadline?: boolean;
  deadlineTime?: string;
  isOptional?: boolean;
}

enum HabitFrequency {
  Daily = 0,
  EveryTwoDays = 1,
  Weekly = 2,
  Monthly = 3,
  Seasonal = 4
}

@Component({
  selector: 'app-habit-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './habit-management.html',
  styleUrls: ['./habit-management.scss']
})
export class HabitManagementComponent implements OnInit {
  // Data Properties
  habits: Habit[] = [];
  loading = false;
  error: string | null = null;
  
  // Form Properties
  showAddForm = false;
  editingHabit: Habit | null = null;
  habitForm: FormGroup;
  
  // Delete Confirmation
  habitToDelete: Habit | null = null;
  
  private apiUrl = 'https://localhost:7025/api';

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.habitForm = this.createHabitForm();
  }

  ngOnInit(): void {
    this.loadHabits();
  }

  // ===================================
  // FORM MANAGEMENT
  // ===================================

  private createHabitForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      frequency: ['Daily', Validators.required],
      weeklyTarget: [1],
      monthlyTarget: [1],
      seasonalTarget: [1],
      hasDeadline: [false],
      deadlineTime: [''],
      isOptional: [false]
    });
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.editingHabit = null;
    this.habitForm.reset({
      name: '',
      description: '',
      frequency: 'Daily',
      weeklyTarget: 1,
      monthlyTarget: 1,
      seasonalTarget: 1,
      hasDeadline: false,
      deadlineTime: '',
      isOptional: this.habitForm.get('isOptional')?.value || false
    });
  }

  openEditForm(habit: Habit): void {
    this.editingHabit = habit;
    this.showAddForm = true;
    
    const frequencyString = this.getFrequencyString(habit.frequency);
    
    this.habitForm.patchValue({
      name: habit.name,
      description: habit.description,
      frequency: frequencyString,
      weeklyTarget: habit.weeklyTarget || 1,
      monthlyTarget: habit.monthlyTarget || 1,
      seasonalTarget: habit.seasonalTarget || 1,
      hasDeadline: habit.hasDeadline,
      deadlineTime: habit.deadlineTime || '',
      isOptional: habit.isOptional || false
    });
  }

  cancelForm(): void {
    this.showAddForm = false;
    this.editingHabit = null;
    this.habitForm.reset();
  }

  onFrequencyChange(): void {
    const frequency = this.habitForm.get('frequency')?.value;
    
    // Reset targets when frequency changes
    this.habitForm.patchValue({
      weeklyTarget: frequency === 'Weekly' ? 1 : 1,
      monthlyTarget: frequency === 'Monthly' ? 1 : 1,
      seasonalTarget: frequency === 'Seasonal' ? 1 : 1
    });
  }

  // ===================================
  // DATA LOADING AND SAVING
  // ===================================

  loadHabits(): void {
    this.loading = true;
    this.error = null;

    this.http.get<Habit[]>(`${this.apiUrl}/habits`).subscribe({
      next: (habits) => {
        this.habits = habits;
        this.loading = false;
        console.log('Habits loaded:', habits);
      },
      error: (error) => {
        console.error('Error loading habits:', error);
        this.error = 'Failed to load habits. Please try again.';
        this.loading = false;
      }
    });
  }

  saveHabit(): void {
    if (this.habitForm.invalid) {
      this.habitForm.markAllAsTouched();
      return;
    }

    const formValue = this.habitForm.value;
    
    if (this.editingHabit) {
      // Update existing habit
      const updateRequest: UpdateHabitRequest = {
        name: formValue.name.trim(),
        description: formValue.description?.trim() || '',
        frequency: formValue.frequency,
        weeklyTarget: formValue.weeklyTarget,
        monthlyTarget: formValue.monthlyTarget,
        seasonalTarget: formValue.seasonalTarget,
        isActive: this.editingHabit.isActive,
        hasDeadline: formValue.hasDeadline,
        deadlineTime: formValue.hasDeadline ? formValue.deadlineTime : undefined,
        isOptional: formValue.isOptional || false
      };

      this.http.put(`${this.apiUrl}/habits/${this.editingHabit.id}`, updateRequest).subscribe({
        next: () => {
          console.log('Habit updated successfully');
          this.loadHabits();
          this.cancelForm();
        },
        error: (error) => {
          console.error('Error updating habit:', error);
          this.error = 'Failed to update habit. Please try again.';
        }
      });
    } else {
      // Create new habit
      const createRequest: CreateHabitRequest = {
        name: formValue.name.trim(),
        description: formValue.description?.trim() || '',
        frequency: formValue.frequency,
        weeklyTarget: formValue.weeklyTarget,
        monthlyTarget: formValue.monthlyTarget,
        seasonalTarget: formValue.seasonalTarget,
        hasDeadline: formValue.hasDeadline,
        deadlineTime: formValue.hasDeadline ? formValue.deadlineTime : undefined,
        isOptional: formValue.isOptional || false
      };

      this.http.post(`${this.apiUrl}/habits`, createRequest).subscribe({
        next: () => {
          console.log('Habit created successfully');
          this.loadHabits();
          this.cancelForm();
        },
        error: (error) => {
          console.error('Error creating habit:', error);
          this.error = 'Failed to create habit. Please try again.';
        }
      });
    }
  }

  // ===================================
  // HABIT ACTIONS
  // ===================================

  toggleHabitActive(habit: Habit): void {
    const updateRequest: UpdateHabitRequest = {
      name: habit.name,
      description: habit.description,
      frequency: this.getFrequencyString(habit.frequency),
      weeklyTarget: habit.weeklyTarget,
      monthlyTarget: habit.monthlyTarget,
      seasonalTarget: habit.seasonalTarget,
      isActive: !habit.isActive,
      hasDeadline: habit.hasDeadline,
      deadlineTime: habit.deadlineTime
    };

    this.http.put(`${this.apiUrl}/habits/${habit.id}`, updateRequest).subscribe({
      next: () => {
        console.log(`Habit ${habit.isActive ? 'paused' : 'activated'} successfully`);
        this.loadHabits();
      },
      error: (error) => {
        console.error('Error toggling habit:', error);
        this.error = 'Failed to update habit status. Please try again.';
      }
    });
  }

  confirmDeleteHabit(habit: Habit): void {
    this.habitToDelete = habit;
  }

  cancelDelete(): void {
    this.habitToDelete = null;
  }

  deleteHabit(): void {
    if (!this.habitToDelete) return;

    this.http.delete(`${this.apiUrl}/habits/${this.habitToDelete.id}`).subscribe({
      next: () => {
        console.log('Habit deleted successfully');
        this.loadHabits();
        this.cancelDelete();
      },
      error: (error) => {
        console.error('Error deleting habit:', error);
        this.error = 'Failed to delete habit. Please try again.';
        this.cancelDelete();
      }
    });
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  getDailyHabits(): Habit[] {
    return this.habits.filter(habit => habit.frequency === HabitFrequency.Daily);
  }

  getRollingHabits(): Habit[] {
    return this.habits.filter(habit => habit.frequency === HabitFrequency.EveryTwoDays);
  }

  getWeeklyHabits(): Habit[] {
    return this.habits.filter(habit => habit.frequency === HabitFrequency.Weekly);
  }

  getMonthlyHabits(): Habit[] {
    return this.habits.filter(habit => habit.frequency === HabitFrequency.Monthly);
  }

  getSeasonalHabits(): Habit[] {
    return this.habits.filter(habit => habit.frequency === HabitFrequency.Seasonal);
  }

  private getFrequencyString(frequency: number): string {
    switch (frequency) {
      case HabitFrequency.Daily:
        return 'Daily';
      case HabitFrequency.EveryTwoDays:
        return 'EveryTwoDays';
      case HabitFrequency.Weekly:
        return 'Weekly';
      case HabitFrequency.Monthly:
        return 'Monthly';
      case HabitFrequency.Seasonal:
        return 'Seasonal';
      default:
        return 'Daily';
    }
  }

  getFrequencyDetails(habit: Habit): string {
    switch (habit.frequency) {
      case HabitFrequency.Daily:
        return 'Every day';
      case HabitFrequency.EveryTwoDays:
        return 'Every 2 days';
      case HabitFrequency.Weekly:
        return `${habit.weeklyTarget || 1}x per week`;
      case HabitFrequency.Monthly:
        return `${habit.monthlyTarget || 1}x per month`;
      case HabitFrequency.Seasonal:
        return `${habit.seasonalTarget || 1}x per season`;
      default:
        return 'Unknown';
    }
  }
}