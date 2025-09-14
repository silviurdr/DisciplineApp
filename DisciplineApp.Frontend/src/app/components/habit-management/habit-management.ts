// Fixed habit-management.component.ts - Remove UpdatedAt dependency
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interface matching your backend Habit model (WITHOUT UpdatedAt)
interface Habit {
  id: number;
  name: string;
  description: string;
  frequency: number; // Changed from string to number (enum value)
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
    console.log('🚀 HabitManagementComponent initialized');
    this.loadHabits();
  }

private createHabitForm(): FormGroup {
  return this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    frequency: [HabitFrequency.Daily, Validators.required], // Use numeric value
    weeklyTarget: [1, [Validators.min(1), Validators.max(7)]],
    monthlyTarget: [1, [Validators.min(1), Validators.max(31)]],
    seasonalTarget: [1, [Validators.min(1), Validators.max(90)]],
    hasDeadline: [false],
    deadlineTime: ['']
  });
}


  // API Methods
  loadHabits(): void {
    console.log('📥 Loading habits from API...');
    this.loading = true;
    this.error = null;
    
    this.getAllHabits().subscribe({
      next: (habits) => {
        console.log('✅ Habits loaded successfully:', habits);
        console.log('📊 Number of habits:', habits.length);
        console.log('📋 Habit details:', habits.map(h => `${h.name} (${h.frequency})`));
        
        this.habits = habits;
        this.loading = false;
        
        // Debug: Log categorized habits
        console.log('📅 Daily habits:', this.getDailyHabits().length);
        console.log('🔄 Rolling habits:', this.getRollingHabits().length);
        console.log('📊 Weekly habits:', this.getWeeklyHabits().length);
        console.log('📅 Monthly habits:', this.getMonthlyHabits().length);
        console.log('🌱 Seasonal habits:', this.getSeasonalHabits().length);
      },
      error: (error) => {
        console.error('❌ Error loading habits:', error);
        this.error = 'Failed to load habits. Please try again.';
        this.loading = false;
        
        // Debug: Check if API is reachable
        console.log('🔍 API URL:', `${this.apiUrl}/habits`);
        console.log('🔍 Full error:', error);
      }
    });
  }

  private getAllHabits(): Observable<Habit[]> {
    const url = `${this.apiUrl}/habits`;
    console.log('🌐 Making API call to:', url);
    return this.http.get<Habit[]>(url);
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
    console.log('➕ Opening add form');
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
    console.log('✏️ Opening edit form for:', habit.name);
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
    console.log('❌ Closing form');
    this.showAddForm = false;
    this.editingHabit = null;
    this.habitForm.reset();
  }

saveHabit(): void {
  if (this.habitForm.invalid) {
    console.log('❌ Form is invalid');
    this.markFormGroupTouched();
    return;
  }

  const formValue = this.habitForm.value;
  console.log('💾 Saving habit:', formValue);
  this.loading = true;

  if (this.editingHabit) {
    // Update existing habit
    const updateRequest = {
      name: formValue.name,
      description: formValue.description,
      frequency: formValue.frequency, // This will be a number now
      weeklyTarget: formValue.weeklyTarget,
      monthlyTarget: formValue.monthlyTarget,
      seasonalTarget: formValue.seasonalTarget,
      isActive: this.editingHabit.isActive,
      hasDeadline: formValue.hasDeadline,
      deadlineTime: formValue.hasDeadline ? formValue.deadlineTime : undefined
    };

    this.updateHabit(this.editingHabit.id, updateRequest).subscribe({
      next: (updatedHabit) => {
        console.log('✅ Habit updated successfully:', updatedHabit);
        const index = this.habits.findIndex(h => h.id === this.editingHabit!.id);
        if (index !== -1) {
          this.habits[index] = updatedHabit;
        }
        this.closeForm();
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error updating habit:', error);
        this.error = 'Failed to update habit. Please try again.';
        this.loading = false;
      }
    });
  } else {
    // Create new habit - similar logic
    const createRequest = {
      name: formValue.name,
      description: formValue.description,
      frequency: formValue.frequency, // This will be a number now
      weeklyTarget: formValue.weeklyTarget,
      monthlyTarget: formValue.monthlyTarget,
      seasonalTarget: formValue.seasonalTarget,
      hasDeadline: formValue.hasDeadline,
      deadlineTime: formValue.hasDeadline ? formValue.deadlineTime : undefined
    };

    this.createHabit(createRequest).subscribe({
      next: (newHabit) => {
        console.log('✅ Habit created successfully:', newHabit);
        this.habits.push(newHabit);
        this.closeForm();
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error creating habit:', error);
        this.error = 'Failed to create habit. Please try again.';
        this.loading = false;
      }
    });
  }
}

  toggleHabitActive(habit: Habit): void {
    console.log('🔄 Toggling habit status:', habit.name);
    const updateRequest: UpdateHabitRequest = {
      name: habit.name,
      description: habit.description,
      frequency: habit.frequency.toString(),
      weeklyTarget: habit.weeklyTarget,
      monthlyTarget: habit.monthlyTarget,
      seasonalTarget: habit.seasonalTarget,
      isActive: !habit.isActive,
      hasDeadline: habit.hasDeadline,
      deadlineTime: habit.deadlineTime
    };

    this.updateHabit(habit.id, updateRequest).subscribe({
      next: (updatedHabit) => {
        console.log('✅ Habit status toggled:', updatedHabit);
        const index = this.habits.findIndex(h => h.id === habit.id);
        if (index !== -1) {
          this.habits[index] = updatedHabit;
        }
      },
      error: (error) => {
        console.error('❌ Error toggling habit status:', error);
        this.error = 'Failed to update habit status. Please try again.';
      }
    });
  }

  confirmDeleteHabit(habit: Habit): void {
    if (confirm(`Are you sure you want to delete "${habit.name}"? This action cannot be undone.`)) {
      console.log('🗑️ Deleting habit:', habit.name);
      this.deleteHabit(habit.id).subscribe({
        next: () => {
          console.log('✅ Habit deleted successfully');
          this.habits = this.habits.filter(h => h.id !== habit.id);
        },
        error: (error) => {
          console.error('❌ Error deleting habit:', error);
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
  const dailyHabits = this.habits.filter(h => h.frequency === HabitFrequency.Daily);
  console.log('📅 getDailyHabits called, found:', dailyHabits.length, 'habits');
  console.log('📅 Daily habits:', dailyHabits.map(h => h.name));
  return dailyHabits;
}

getRollingHabits(): Habit[] {
  const rollingHabits = this.habits.filter(h => h.frequency === HabitFrequency.EveryTwoDays);
  console.log('🔄 getRollingHabits called, found:', rollingHabits.length, 'habits');
  console.log('🔄 Rolling habits:', rollingHabits.map(h => h.name));
  return rollingHabits;
}

getWeeklyHabits(): Habit[] {
  const weeklyHabits = this.habits.filter(h => h.frequency === HabitFrequency.Weekly);
  console.log('📊 getWeeklyHabits called, found:', weeklyHabits.length, 'habits');
  console.log('📊 Weekly habits:', weeklyHabits.map(h => h.name));
  return weeklyHabits;
}

getMonthlyHabits(): Habit[] {
  const monthlyHabits = this.habits.filter(h => h.frequency === HabitFrequency.Monthly);
  console.log('📅 getMonthlyHabits called, found:', monthlyHabits.length, 'habits');
  console.log('📅 Monthly habits:', monthlyHabits.map(h => h.name));
  return monthlyHabits;
}

getSeasonalHabits(): Habit[] {
  const seasonalHabits = this.habits.filter(h => h.frequency === HabitFrequency.Seasonal);
  console.log('🌱 getSeasonalHabits called, found:', seasonalHabits.length, 'habits');
  console.log('🌱 Seasonal habits:', seasonalHabits.map(h => h.name));
  return seasonalHabits;
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
  const freqNum = parseInt(frequency);
  return (freqNum === HabitFrequency.Weekly && targetType === 'weekly') ||
         (freqNum === HabitFrequency.Monthly && targetType === 'monthly') ||
         (freqNum === HabitFrequency.Seasonal && targetType === 'seasonal');
}

  // Debug method to check what's happening
  debugHabits(): void {
    console.log('🔍 DEBUG HABITS:');
    console.log('Total habits:', this.habits.length);
    console.log('Loading state:', this.loading);
    console.log('Error state:', this.error);
    console.log('Show add form:', this.showAddForm);
    console.log('Habits array:', this.habits);
    
    if (this.habits.length > 0) {
      console.log('First habit:', this.habits[0]);
      console.log('Habit frequencies:', this.habits.map(h => h.frequency));
    }
  }
}