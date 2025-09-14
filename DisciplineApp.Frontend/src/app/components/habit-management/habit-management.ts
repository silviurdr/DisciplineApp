// Fixed habit-management.component.ts - Complete working version
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  habits: Habit[] = [];
  loading = false;
  error: string | null = null;
  
  showAddForm = false;
  editingHabit: Habit | null = null;
  habitForm: FormGroup;
  
  private apiUrl = 'https://localhost:7025/api';

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.habitForm = this.createHabitForm();
  }

  ngOnInit(): void {
    this.loadHabits();
  }

private createHabitForm(): FormGroup {
  return this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    frequency: ['Daily', Validators.required],
    weeklyTarget: [1], // Remove validators initially
    monthlyTarget: [1], // Remove validators initially  
    seasonalTarget: [1], // Remove validators initially
    hasDeadline: [false],
    deadlineTime: ['']
  });
}

private updateValidatorsForFrequency(frequency: string): void {
  const weeklyControl = this.habitForm.get('weeklyTarget');
  const monthlyControl = this.habitForm.get('monthlyTarget');
  const seasonalControl = this.habitForm.get('seasonalTarget');

  // Clear all validators first
  weeklyControl?.clearValidators();
  monthlyControl?.clearValidators();
  seasonalControl?.clearValidators();

  // Add validators only for the relevant frequency type
  switch (frequency) {
    case 'Weekly':
      weeklyControl?.setValidators([Validators.min(1), Validators.max(7)]);
      break;
    case 'Monthly':
      monthlyControl?.setValidators([Validators.min(1), Validators.max(31)]);
      break;
    case 'Seasonal':
      seasonalControl?.setValidators([Validators.min(1), Validators.max(90)]);
      break;
    // Daily and EveryTwoDays don't need target validators
  }

  // Update validation status
  weeklyControl?.updateValueAndValidity();
  monthlyControl?.updateValueAndValidity();
  seasonalControl?.updateValueAndValidity();
}

  // Helper method to convert numeric frequency to string
  private getFrequencyString(frequency: number): string {
    switch (frequency) {
      case HabitFrequency.Daily: return 'Daily';
      case HabitFrequency.EveryTwoDays: return 'EveryTwoDays';
      case HabitFrequency.Weekly: return 'Weekly';
      case HabitFrequency.Monthly: return 'Monthly';
      case HabitFrequency.Seasonal: return 'Seasonal';
      default: return 'Daily';
    }
  }

  // API Methods
  loadHabits(): void {
    this.loading = true;
    this.error = null;
    
    this.getAllHabits().subscribe({
      next: (habits) => {
        this.habits = habits;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading habits:', error);
        this.error = 'Failed to load habits. Please try again.';
        this.loading = false;
      }
    });
  }

  private getAllHabits(): Observable<Habit[]> {
    return this.http.get<Habit[]>(`${this.apiUrl}/habits`);
  }

  private createHabit(habit: CreateHabitRequest): Observable<Habit> {
    return this.http.post<Habit>(`${this.apiUrl}/habits`, habit);
  }

  private updateHabit(id: number, habit: UpdateHabitRequest): Observable<Habit> {
    return this.http.put<Habit>(`${this.apiUrl}/habits/${id}`, habit);
  }

  private deleteHabit(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/habits/${id}`);
  }

  // Form Management
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
      deadlineTime: ''
    });
  }

openEditForm(habit: Habit): void {
  this.showAddForm = true;
  this.editingHabit = habit;
  
  const frequencyString = this.getFrequencyString(habit.frequency);
  
  this.habitForm.patchValue({
    name: habit.name,
    description: habit.description,
    frequency: frequencyString,
    weeklyTarget: habit.weeklyTarget,
    monthlyTarget: habit.monthlyTarget,
    seasonalTarget: habit.seasonalTarget,
    hasDeadline: habit.hasDeadline,
    deadlineTime: habit.deadlineTime || ''
  });
  
  // Update validators based on the frequency
  this.updateValidatorsForFrequency(frequencyString);
  
  // Force form validation update
  this.habitForm.updateValueAndValidity();
}

// Also add this to handle frequency changes in the form:
onFrequencyChange(): void {
  const frequency = this.habitForm.get('frequency')?.value;
  if (frequency) {
    this.updateValidatorsForFrequency(frequency);
  }
}

debugFormStatus(): void {
  console.log('🔍 FORM DEBUG:');
  console.log('Form valid:', this.habitForm.valid);
  console.log('Form invalid:', this.habitForm.invalid);
  console.log('Loading state:', this.loading);
  console.log('Button should be enabled:', !this.habitForm.invalid && !this.loading);
  
  console.log('Form errors:');
  Object.keys(this.habitForm.controls).forEach(key => {
    const control = this.habitForm.get(key);
    if (control?.errors) {
      console.log(`  ${key}:`, control.errors);
    }
  });
  
  console.log('Form values:');
  console.log(this.habitForm.value);
}

  closeForm(): void {
    this.showAddForm = false;
    this.editingHabit = null;
    this.habitForm.reset();
  }

  saveHabit(): void {
    if (this.habitForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    const formValue = this.habitForm.value;
    this.loading = true;

    if (this.editingHabit) {
      // Update existing habit
      const updateRequest: UpdateHabitRequest = {
        name: formValue.name,
        description: formValue.description,
        frequency: formValue.frequency, // String frequency
        weeklyTarget: formValue.weeklyTarget,
        monthlyTarget: formValue.monthlyTarget,
        seasonalTarget: formValue.seasonalTarget,
        isActive: this.editingHabit.isActive,
        hasDeadline: formValue.hasDeadline,
        deadlineTime: formValue.hasDeadline ? formValue.deadlineTime : undefined
      };

      this.updateHabit(this.editingHabit.id, updateRequest).subscribe({
        next: (updatedHabit) => {
          const index = this.habits.findIndex(h => h.id === this.editingHabit!.id);
          if (index !== -1) {
            this.habits[index] = updatedHabit;
          }
          this.closeForm();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error updating habit:', error);
          this.error = 'Failed to update habit. Please try again.';
          this.loading = false;
        }
      });
    } else {
      // Create new habit
      const createRequest: CreateHabitRequest = {
        name: formValue.name,
        description: formValue.description,
        frequency: formValue.frequency, // String frequency
        weeklyTarget: formValue.weeklyTarget,
        monthlyTarget: formValue.monthlyTarget,
        seasonalTarget: formValue.seasonalTarget,
        hasDeadline: formValue.hasDeadline,
        deadlineTime: formValue.hasDeadline ? formValue.deadlineTime : undefined
      };

      this.createHabit(createRequest).subscribe({
        next: (newHabit) => {
          this.habits.push(newHabit);
          this.closeForm();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error creating habit:', error);
          this.error = 'Failed to create habit. Please try again.';
          this.loading = false;
        }
      });
    }
  }

  toggleHabitActive(habit: Habit): void {
    const updateRequest: UpdateHabitRequest = {
      name: habit.name,
      description: habit.description,
      frequency: this.getFrequencyString(habit.frequency), // Convert to string
      weeklyTarget: habit.weeklyTarget,
      monthlyTarget: habit.monthlyTarget,
      seasonalTarget: habit.seasonalTarget,
      isActive: !habit.isActive,
      hasDeadline: habit.hasDeadline,
      deadlineTime: habit.deadlineTime
    };

    this.updateHabit(habit.id, updateRequest).subscribe({
      next: (updatedHabit) => {
        const index = this.habits.findIndex(h => h.id === habit.id);
        if (index !== -1) {
          this.habits[index] = updatedHabit;
        }
      },
      error: (error) => {
        console.error('Error toggling habit status:', error);
        this.error = 'Failed to update habit status. Please try again.';
      }
    });
  }

  confirmDeleteHabit(habit: Habit): void {
    if (confirm(`Are you sure you want to delete "${habit.name}"? This action cannot be undone.`)) {
      this.deleteHabit(habit.id).subscribe({
        next: () => {
          this.habits = this.habits.filter(h => h.id !== habit.id);
        },
        error: (error) => {
          console.error('Error deleting habit:', error);
          this.error = 'Failed to delete habit. Please try again.';
        }
      });
    }
  }

  // Helper Methods
  private markFormGroupTouched(): void {
    Object.keys(this.habitForm.controls).forEach(key => {
      this.habitForm.get(key)?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.habitForm.get(fieldName);
    if (field?.touched && field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['maxlength']) return `${fieldName} is too long`;
      if (field.errors['min']) return `Value too small`;
      if (field.errors['max']) return `Value too large`;
    }
    return '';
  }

  // Categorization
  getDailyHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === HabitFrequency.Daily);
  }

  getRollingHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === HabitFrequency.EveryTwoDays);
  }

  getWeeklyHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === HabitFrequency.Weekly);
  }

  getMonthlyHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === HabitFrequency.Monthly);
  }

  getSeasonalHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === HabitFrequency.Seasonal);
  }

  getFrequencyDisplayName(frequency: number): string {
    switch (frequency) {
      case HabitFrequency.Daily: return 'Every day';
      case HabitFrequency.EveryTwoDays: return 'Every 2 days';
      case HabitFrequency.Weekly: return 'Weekly';
      case HabitFrequency.Monthly: return 'Monthly';
      case HabitFrequency.Seasonal: return 'Seasonal';
      default: return `Unknown (${frequency})`;
    }
  }

  getFrequencyDetails(habit: Habit): string {
    switch (habit.frequency) {
      case HabitFrequency.Weekly:
        return `${habit.weeklyTarget}x per week`;
      case HabitFrequency.Monthly:
        return `${habit.monthlyTarget}x per month`;
      case HabitFrequency.Seasonal:
        return `${habit.seasonalTarget}x per season`;
      default:
        return this.getFrequencyDisplayName(habit.frequency);
    }
  }

  shouldShowTargetField(frequency: string, targetType: string): boolean {
    return (frequency === 'Weekly' && targetType === 'weekly') ||
           (frequency === 'Monthly' && targetType === 'monthly') ||
           (frequency === 'Seasonal' && targetType === 'seasonal');
  }

  trackByFn(index: number, item: Habit): number {
    return item.id;
  }
}