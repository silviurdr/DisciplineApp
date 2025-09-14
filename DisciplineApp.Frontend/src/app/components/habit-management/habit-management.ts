// Updated habit-management.component.ts - Connected to Real API
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interface matching your backend Habit model
interface Habit {
  id: number;
  name: string;
  description: string;
  frequency: 'Daily' | 'EveryTwoDays' | 'Weekly' | 'Monthly' | 'Seasonal';
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
  frequency: string;
  weeklyTarget?: number;
  monthlyTarget?: number;
  seasonalTarget?: number;
  hasDeadline?: boolean;
  deadlineTime?: string;
}

interface UpdateHabitRequest {
  name: string;
  description: string;
  frequency: string;
  weeklyTarget?: number;
  monthlyTarget?: number;
  seasonalTarget?: number;
  isActive: boolean;
  hasDeadline?: boolean;
  deadlineTime?: string;
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
      weeklyTarget: [1, [Validators.min(1), Validators.max(7)]],
      monthlyTarget: [1, [Validators.min(1), Validators.max(31)]],
      seasonalTarget: [1, [Validators.min(1), Validators.max(90)]],
      hasDeadline: [false],
      deadlineTime: ['']
    });
  }

  // API Methods
  loadHabits(): void {
    this.loading = true;
    this.error = null;
    
    this.getAllHabits().subscribe({
      next: (habits) => {
        this.habits = habits;
        this.loading = false;
        console.log('Loaded habits:', habits);
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
    this.habitForm.patchValue({
      name: habit.name,
      description: habit.description,
      frequency: habit.frequency,
      weeklyTarget: habit.weeklyTarget,
      monthlyTarget: habit.monthlyTarget,
      seasonalTarget: habit.seasonalTarget,
      hasDeadline: habit.hasDeadline,
      deadlineTime: habit.deadlineTime || ''
    });
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
        frequency: formValue.frequency,
        weeklyTarget: formValue.weeklyTarget,
        monthlyTarget: formValue.monthlyTarget,
        seasonalTarget: formValue.seasonalTarget,
        isActive: this.editingHabit.isActive,
        hasDeadline: formValue.hasDeadline,
        deadlineTime: formValue.hasDeadline ? formValue.deadlineTime : null
      };

      this.updateHabit(this.editingHabit.id, updateRequest).subscribe({
        next: (updatedHabit) => {
          const index = this.habits.findIndex(h => h.id === this.editingHabit!.id);
          if (index !== -1) {
            this.habits[index] = updatedHabit;
          }
          this.closeForm();
          this.loading = false;
          console.log('Habit updated successfully');
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
        frequency: formValue.frequency,
        weeklyTarget: formValue.weeklyTarget,
        monthlyTarget: formValue.monthlyTarget,
        seasonalTarget: formValue.seasonalTarget,
        hasDeadline: formValue.hasDeadline,
        deadlineTime: formValue.hasDeadline ? formValue.deadlineTime : null
      };

      this.createHabit(createRequest).subscribe({
        next: (newHabit) => {
          this.habits.push(newHabit);
          this.closeForm();
          this.loading = false;
          console.log('Habit created successfully');
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
      frequency: habit.frequency,
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
        console.log(`Habit ${habit.isActive ? 'deactivated' : 'activated'}`);
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
          console.log('Habit deleted successfully');
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
    return this.habits.filter(h => h.frequency === 'Daily');
  }

  getRollingHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === 'EveryTwoDays');
  }

  getWeeklyHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === 'Weekly');
  }

  getMonthlyHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === 'Monthly');
  }

  getSeasonalHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === 'Seasonal');
  }

  getFrequencyDisplayName(frequency: string): string {
    switch (frequency) {
      case 'Daily': return 'Every day';
      case 'EveryTwoDays': return 'Every 2 days';
      case 'Weekly': return 'Weekly';
      case 'Monthly': return 'Monthly';
      case 'Seasonal': return 'Seasonal';
      default: return frequency;
    }
  }

  getFrequencyDetails(habit: Habit): string {
    switch (habit.frequency) {
      case 'Weekly':
        return `${habit.weeklyTarget}x per week`;
      case 'Monthly':
        return `${habit.monthlyTarget}x per month`;
      case 'Seasonal':
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
}