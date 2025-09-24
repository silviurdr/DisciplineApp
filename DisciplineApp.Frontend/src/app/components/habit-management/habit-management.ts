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
  estimatedDurationMinutes?: number;
    // Sub-habits related
  subHabits?: SubHabit[];
  hasSubHabits?: boolean;
  isExpanded?: boolean;
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
  estimatedDurationMinutes?: number;
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
  estimatedDurationMinutes?: number;
}

interface SubHabit {
  id: number;
  parentHabitId: number;
  name: string;
  description: string;
  orderIndex: number;
  isActive: boolean;
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
  isOptional?: boolean;
  estimatedDurationMinutes?: number;
}

interface CreateSubHabitRequest {
  parentHabitId: number;
  name: string;
  description?: string;
}

interface UpdateSubHabitRequest {
  name: string;
  description?: string;
  isActive: boolean;
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
  
   // Sub-Habits Properties
  showSubHabitForm: { [habitId: number]: boolean } = {};
  editingSubHabit: { habit: Habit, subHabit: SubHabit } | null = null;
  subHabitForm: FormGroup;
  expandedHabits: Set<number> = new Set();

    // Delete Confirmation
  habitToDelete: Habit | null = null;
  subHabitToDelete: { habit: Habit, subHabit: SubHabit } | null = null;
  
  private apiUrl = 'https://localhost:7025/api';

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.habitForm = this.createHabitForm();
    this.subHabitForm = this.createSubHabitForm();
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
      isOptional: [false],
      estimatedDurationMinutes: [30, [Validators.min(1), Validators.max(600)]]
    });
  }

  private createSubHabitForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['']
    });
  }

   openAddForm(): void {
    this.showAddForm = true;
    this.editingHabit = null;
    this.habitForm.reset();
    this.habitForm.patchValue({
      frequency: 'Daily',
      weeklyTarget: 0,
      monthlyTarget: 0,
      seasonalTarget: 0,
      hasDeadline: false,
      isOptional: false,
      estimatedDurationMinutes: 0
    });
  }

 formatDuration(minutes?: number): string {
    if (!minutes) return '';
    
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  }

  openEditForm(habit: Habit): void {
    this.showAddForm = true;
    this.editingHabit = habit;
    this.habitForm.patchValue({
      name: habit.name,
      description: habit.description,
      frequency: this.getFrequencyName(habit.frequency),
      weeklyTarget: habit.weeklyTarget,
      monthlyTarget: habit.monthlyTarget,
      seasonalTarget: habit.seasonalTarget,
      hasDeadline: habit.hasDeadline,
      deadlineTime: habit.deadlineTime || '',
      isOptional: habit.isOptional,
      estimatedDurationMinutes: habit.estimatedDurationMinutes || 0
    });
  }

  closeForm(): void {
    this.showAddForm = false;
    this.editingHabit = null;
    this.habitForm.reset();
    this.error = null;
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

    private getFrequencyName(frequency: number): string {
    switch (frequency) {
      case HabitFrequency.Daily: return 'Daily';
      case HabitFrequency.EveryTwoDays: return 'EveryTwoDays';
      case HabitFrequency.Weekly: return 'Weekly';
      case HabitFrequency.Monthly: return 'Monthly';
      case HabitFrequency.Seasonal: return 'Seasonal';
      default: return 'Daily';
    }
  }

  // ===================================
  // DATA LOADING AND SAVING
  // ===================================

async loadHabits(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const response = await this.http.get<Habit[]>(`${this.apiUrl}/habits`).toPromise();
      this.habits = response || [];
      
      // Load sub-habits for each habit
      for (const habit of this.habits) {
        await this.loadSubHabitsForHabit(habit);
      }
      
    } catch (error) {
      this.error = 'Failed to load habits';
      console.error('Error loading habits:', error);
    } finally {
      this.loading = false;
    }
  }

async loadSubHabitsForHabit(habit: Habit): Promise<void> {
    try {
      const subHabits = await this.http.get<SubHabit[]>(`${this.apiUrl}/subhabits/habit/${habit.id}`).toPromise();
      habit.subHabits = subHabits || [];
      habit.hasSubHabits = habit.subHabits.length > 0;
    } catch (error) {
      console.error(`Error loading sub-habits for habit ${habit.id}:`, error);
      // Set default values even on error - this ensures habits can still have sub-habits added
      habit.subHabits = [];
      habit.hasSubHabits = false;
    }
  }

    openSubHabitsManager(habitId: number): void {
    // First, make sure the habit is expanded to show the sub-habits section
    if (!this.expandedHabits.has(habitId)) {
      this.expandedHabits.add(habitId);
    }
    
    // Toggle the form instead of just showing it
    if (this.showSubHabitForm[habitId]) {
      // Form is open, close it
      this.hideAddSubHabitForm(habitId);
      this.expandedHabits.delete(habitId);
    } else {
      // Form is closed, open it
      setTimeout(() => {
        this.showSubHabitForm[habitId] = true;
        this.editingSubHabit = null;    
        this.subHabitForm.reset();
      }, 100);
    }
  }

async saveHabit(): Promise<void> {
    if (this.habitForm.invalid) return;

    // Remove this.loading = true for form actions
    this.error = null;

    try {
      const formValue = this.habitForm.value;
      const request: CreateHabitRequest = {
        name: formValue.name.trim(),
        description: formValue.description?.trim() || '',
        frequency: formValue.frequency,
        weeklyTarget: formValue.weeklyTarget || undefined,
        monthlyTarget: formValue.monthlyTarget || undefined,
        seasonalTarget: formValue.seasonalTarget || undefined,
        hasDeadline: formValue.hasDeadline,
        deadlineTime: formValue.hasDeadline ? formValue.deadlineTime : undefined,
        isOptional: formValue.isOptional,
        estimatedDurationMinutes: formValue.estimatedDurationMinutes || undefined
      };

      if (this.editingHabit) {
        // Update existing habit
        const updateRequest = { ...request, id: this.editingHabit.id, isActive: true, isLocked: false };
        const updatedHabit = await this.http.put<Habit>(`${this.apiUrl}/habits/${this.editingHabit.id}`, updateRequest).toPromise();
        
        // Update local state instead of reloading
        const index = this.habits.findIndex(h => h.id === this.editingHabit!.id);
        if (index !== -1 && updatedHabit) {
          this.habits[index] = { ...updatedHabit, subHabits: this.habits[index].subHabits, hasSubHabits: this.habits[index].hasSubHabits };
        }
      } else {
        // Create new habit
        const newHabit = await this.http.post<Habit>(`${this.apiUrl}/habits`, request).toPromise();
        
        // Add to local state instead of reloading
        if (newHabit) {
          const habitWithSubHabits: Habit = {
            ...newHabit,
            subHabits: [],
            hasSubHabits: false
          };
          this.habits.push(habitWithSubHabits);
        }
      }

      this.closeForm();
    } catch (error) {
      this.error = this.editingHabit ? 'Failed to update habit' : 'Failed to create habit';
      console.error('Error saving habit:', error);
    }
    // Remove finally block with this.loading = false
  }

  // ===================================
  // HABIT ACTIONS
  // ===================================

  async toggleHabitActive(habit: Habit): Promise<void> {
    try {
      const updateRequest = {
        id: habit.id,
        name: habit.name,
        description: habit.description,
        frequency: this.getFrequencyName(habit.frequency),
        weeklyTarget: habit.weeklyTarget,
        monthlyTarget: habit.monthlyTarget,
        seasonalTarget: habit.seasonalTarget,
        hasDeadline: habit.hasDeadline,
        deadlineTime: habit.deadlineTime,
        isActive: !habit.isActive,
        isLocked: habit.isLocked,
        isOptional: habit.isOptional,
        estimatedDurationMinutes: habit.estimatedDurationMinutes
      };

      await this.http.put(`${this.apiUrl}/habits/${habit.id}`, updateRequest).toPromise();
      
      // Update local state instead of reloading
      habit.isActive = !habit.isActive;
    } catch (error) {
      this.error = 'Failed to update habit status';
      console.error('Error toggling habit active status:', error);
    }
  }

 confirmDeleteHabit(habit: Habit): void {
    this.habitToDelete = habit;
  }

  cancelDelete(): void {
    this.habitToDelete = null;
    this.subHabitToDelete = null;
  }

 async deleteHabit(): Promise<void> {
    if (!this.habitToDelete) return;

    // Remove loading state for quick actions
    try {
      await this.http.delete(`${this.apiUrl}/habits/${this.habitToDelete.id}`).toPromise();
      
      // Remove from local state instead of reloading
      this.habits = this.habits.filter(h => h.id !== this.habitToDelete!.id);
      this.habitToDelete = null;
    } catch (error) {
      this.error = 'Failed to delete habit';
      console.error('Error deleting habit:', error);
      this.habitToDelete = null;
    }
  }

  // ===================================
  // SUB-HABITS MANAGEMENT
  // ===================================

  toggleHabitExpansion(habitId: number): void {
    if (this.expandedHabits.has(habitId)) {
      this.expandedHabits.delete(habitId);
    } else {
      this.expandedHabits.add(habitId);
    }
  }

  isHabitExpanded(habitId: number): boolean {
    return this.expandedHabits.has(habitId);
  }

 showAddSubHabitForm(habitId: number): void {
    // First, make sure the habit is expanded to show the sub-habits section
    if (!this.expandedHabits.has(habitId)) {
      this.expandedHabits.add(habitId);
    }
    
    // Toggle the form instead of just showing it
    if (this.showSubHabitForm[habitId]) {
      // Form is open, close it
      this.hideAddSubHabitForm(habitId);
    } else {
      // Form is closed, open it
      this.showSubHabitForm[habitId] = true;
      this.editingSubHabit = null;
      this.subHabitForm.reset();
    }
  }
  

  hideAddSubHabitForm(habitId: number): void {
    this.showSubHabitForm[habitId] = false;
    this.editingSubHabit = null;
    this.subHabitForm.reset();
  }

  openEditSubHabitForm(habit: Habit, subHabit: SubHabit): void {
    this.editingSubHabit = { habit, subHabit };
    this.subHabitForm.patchValue({
      name: subHabit.name,
      description: subHabit.description
    });
    // Hide the add form and show edit mode
    this.showSubHabitForm[habit.id] = true;
  }

async saveSubHabit(habitId: number): Promise<void> {
    if (this.subHabitForm.invalid) return;

    // Remove loading state for sub-habit actions
    try {
      const formValue = this.subHabitForm.value;

      if (this.editingSubHabit) {
        // Update existing sub-habit
        const updateRequest: UpdateSubHabitRequest = {
          name: formValue.name.trim(),
          description: formValue.description?.trim() || '',
          isActive: true
        };
        
        const updatedSubHabit = await this.http.put<SubHabit>(`${this.apiUrl}/subhabits/${this.editingSubHabit.subHabit.id}`, updateRequest).toPromise();
        
        // Update local state
        const habit = this.habits.find(h => h.id === habitId);
        if (habit && habit.subHabits && updatedSubHabit) {
          const subHabitIndex = habit.subHabits.findIndex(sh => sh.id === this.editingSubHabit!.subHabit.id);
          if (subHabitIndex !== -1) {
            habit.subHabits[subHabitIndex] = updatedSubHabit;
          }
        }
      } else {
        // Create new sub-habit
        const createRequest: CreateSubHabitRequest = {
          parentHabitId: habitId,
          name: formValue.name.trim(),
          description: formValue.description?.trim() || ''
        };
        
        const newSubHabit = await this.http.post<SubHabit>(`${this.apiUrl}/subhabits`, createRequest).toPromise();
        
        // Update local state
        const habit = this.habits.find(h => h.id === habitId);
        if (habit && newSubHabit) {
          if (!habit.subHabits) habit.subHabits = [];
          habit.subHabits.push(newSubHabit);
          habit.hasSubHabits = true;
        }
      }

      this.hideAddSubHabitForm(habitId);
    } catch (error) {
      this.error = this.editingSubHabit ? 'Failed to update sub-habit' : 'Failed to create sub-habit';
      console.error('Error saving sub-habit:', error);
    }
  }

  confirmDeleteSubHabit(habit: Habit, subHabit: SubHabit): void {
    this.subHabitToDelete = { habit, subHabit };
  }

async deleteSubHabit(): Promise<void> {
    if (!this.subHabitToDelete) return;

    // Remove loading state for delete actions
    try {
      await this.http.delete(`${this.apiUrl}/subhabits/${this.subHabitToDelete.subHabit.id}`).toPromise();
      
      // Update local state instead of reloading
      const habit = this.subHabitToDelete.habit;
      if (habit.subHabits) {
        habit.subHabits = habit.subHabits.filter(sh => sh.id !== this.subHabitToDelete!.subHabit.id);
        habit.hasSubHabits = habit.subHabits.length > 0;
      }
      this.subHabitToDelete = null;
    } catch (error) {
      this.error = 'Failed to delete sub-habit';
      console.error('Error deleting sub-habit:', error);
      this.subHabitToDelete = null;
    }
  }

 async toggleSubHabitActive(habit: Habit, subHabit: SubHabit): Promise<void> {
    try {
      const updateRequest: UpdateSubHabitRequest = {
        name: subHabit.name,
        description: subHabit.description,
        isActive: !subHabit.isActive
      };

      await this.http.put(`${this.apiUrl}/subhabits/${subHabit.id}`, updateRequest).toPromise();
      
      // Update local state instead of reloading
      subHabit.isActive = !subHabit.isActive;
    } catch (error) {
      this.error = 'Failed to update sub-habit status';
      console.error('Error toggling sub-habit active status:', error);
    }
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