import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisciplineService } from '../../services/discipline.services';
import { SoundService } from '../../services/sound.service';
import { FormsModule } from '@angular/forms';
import { SortCompletedPipe } from "../../sort.completed.pipe";

interface ScheduledHabit {
  habitId: number;
  name: string;
  description: string;
  isCompleted: boolean;
  isRequired: boolean;
  reason: string;
  isLocked? : boolean;
  priority: string;
  completedAt?: string;
  timeRemaining?: string;
  hasDeadline?: boolean;
  deadlineTime?: string;
  isOverdue?: boolean;
  isAdHoc?: boolean; // New property to distinguish ad-hoc tasks
  adHocId?: number;  // ID for ad-hoc tasks
}

interface DayData {
  date: string;
  allHabits: ScheduledHabit[];
  warnings: string[];
  recommendations: string[];
  canUseGrace: boolean;
  isCompleted: boolean;
  isPartiallyCompleted: boolean;
}

interface WeeklyProgress {
  habitId: number;
  name: string;
  completions: number;
  target: number;
  percentage: number;
}


interface AddAdHocTaskRequest {
  name: string;
  description?: string;
  date: string; // Format: "YYYY-MM-DD"
}

interface EditAdHocTaskRequest {
  name: string;
  description?: string;
}

interface WeekData {
  weekStartDate: string;
  weekEndDate: string;
  currentDay: DayData;
  weeklyHabitProgress: WeeklyProgress[];
  dayStatuses: any[];
}

interface HabitWithFlexibility {
  // Basic habit info
  habitId: number;
  name: string;
  description: string;
  frequency: string; // 'Daily', 'Weekly', 'Monthly', 'Seasonal', 'EveryTwoDays'
  
  // Date tracking
  originalScheduledDate: string; // ISO date string like '2025-09-15'
  currentDueDate: string;        // ISO date string like '2025-09-16'
  
  // Flexibility tracking
  deferralsUsed: number;         // How many times this task has been moved
  maxDeferrals: number;          // Maximum allowed deferrals (0 for daily, 2 for weekly, etc.)
  daysRemaining: number;         // Days left in the completion window
  canStillBeDeferred: boolean;   // Can this task still be moved to tomorrow?
  
  // Status and urgency
  urgencyLevel: 'safe' | 'warning' | 'urgent' | 'critical';
  statusLabel: string;           // Human-readable status like "Can move 2 more times"
  
  // Visual indicators
  flexibilityIcon: string;       // Emoji icon like '✅', '⚠️', '🔥', '🚨'
  flexibilityColor: string;      // CSS color like '#28a745', '#ffc107', etc.
  
  // Completion status
  isCompleted: boolean;          // Has this task been completed?
  isRequired: boolean;           // Is this task required today?
  isLocked: boolean;             // Is this task locked (can't be modified)?
  
  // Deadline info (if applicable)
  hasDeadline: boolean;          // Does this task have a time deadline?
  deadlineTime: string;          // Time string like '18:00:00'
}


interface DeferTaskRequest {
  habitId: number;
  fromDate: string;    // ISO date string
  reason?: string;     // Optional reason for deferral
}

// Response interface for deferral operations
interface DeferTaskResponse {
  success: boolean;
  message: string;
  updatedTask: HabitWithFlexibility;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, SortCompletedPipe],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  weekData: WeekData | null = null;
  todayData: DayData | null = null;
  weeklyProgress: any = {};
  currentWeekDays: any[] = [];
  loading = true;
  error: string | null = null;
  selectedDay: any = null;
  showAddTaskDialog = false;
  newTaskName = '';
  newTaskDescription = '';
  showEditTaskDialog = false;
  editingTask: ScheduledHabit | null = null;
  editTaskName = '';
  editTaskDescription = '';
  flexibleTasks: HabitWithFlexibility[] = [];

  constructor(private disciplineService: DisciplineService, private soundService: SoundService) {}

  ngOnInit(): void {
    this.loadFlexibleTasks();
    this.loadCurrentWeekData();
  }

 loadFlexibleTasks(): void {
    const today = new Date().toISOString().split('T')[0];
    
    this.disciplineService.getFlexibleTasksForDay(today).subscribe({
      next: (tasks: HabitWithFlexibility[]) => {
        this.flexibleTasks = tasks;
        console.log('Loaded flexible tasks:', tasks);
      },
      error: (error) => {
        console.error('Error loading flexible tasks:', error);
      }
    });
  }
    canMoveTask(task: HabitWithFlexibility): boolean {
    return task.canStillBeDeferred && !task.isCompleted && !task.isLocked;
  }

  

   getRemainingDeferrals(task: HabitWithFlexibility): number {
    return task.maxDeferrals - task.deferralsUsed;
  }

  canMoveTaskToTomorrow(task: HabitWithFlexibility): boolean {
    return task.canStillBeDeferred && !task.isCompleted && !task.isLocked;
  }

    getUrgencyClass(task: HabitWithFlexibility): string {
    return `task-urgency-${task.urgencyLevel}`;
  }

  completeTask(task: HabitWithFlexibility): void {
  if (task.isLocked) {
    console.log('Task is locked, cannot complete');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  
  // Toggle completion status
  const newCompletionStatus = !task.isCompleted;
  
  this.disciplineService.completeHabit({
    habitId: task.habitId,
    date: today,
    isCompleted: newCompletionStatus
  }).subscribe({
    next: (response) => {
      console.log('Task completion updated:', response);
      
      // Update the task in our flexible tasks array
      const index = this.flexibleTasks.findIndex(t => t.habitId === task.habitId);
      if (index !== -1) {
        this.flexibleTasks[index].isCompleted = newCompletionStatus;
      }
      
      // Show success message
      if (newCompletionStatus) {
        console.log(`${task.name} marked as completed!`);
        // Play completion sound if you have it
        this.soundService.playTaskCompleted();
      } else {
        console.log(`${task.name} marked as incomplete.`);
      }
      
      // Reload data to refresh counters and overall progress
      this.loadCurrentWeekData();
      this.loadFlexibleTasks();
    },
    error: (error) => {
      console.error('Error updating task completion:', error);
      alert('Failed to update task. Please try again.');
    }
  });
}


  moveFlexibleTaskToTomorrow(task: HabitWithFlexibility): void {
    if (!this.canMoveTaskToTomorrow(task)) {
      alert(`Cannot move ${task.name}: ${task.statusLabel}`);
      return;
    }

    const fromDate = new Date().toISOString().split('T')[0];
    
    this.disciplineService.deferTask(task.habitId, fromDate, 'Moved by user request').subscribe({
      next: (updatedTask) => {
        console.log('Task deferred successfully:', updatedTask);
        
        // Update the task in our array
        const index = this.flexibleTasks.findIndex(t => t.habitId === task.habitId);
        if (index !== -1) {
          this.flexibleTasks[index] = updatedTask;
        }
        
        // Show success message
        alert(`${task.name} moved to tomorrow. ${updatedTask.statusLabel}`);
      },
      error: (error) => {
        console.error('Error moving task:', error);
        alert('Failed to move task. Please try again.');
      }
    });
  }


  public loadCurrentWeekData(): void {
    const today = new Date();
    
    this.loading = true;
    this.error = null;

    this.disciplineService.getWeekData(
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate()
    ).subscribe({
      next: (weekData) => {
        console.log('Smart Schedule Data:', weekData);
        this.weekData = weekData;
        this.todayData = weekData.currentDay;
        this.weeklyProgress = this.mapWeeklyProgress(weekData);
              console.log('Today\'s habits after loading:', this.todayData?.allHabits);
      this.todayData?.allHabits?.forEach(habit => {
        console.log(`Habit: ${habit.name}, ID: ${habit.habitId}, Completed: ${habit.isCompleted}`);
      });
        this.currentWeekDays = this.mapApiDataToWeekDays(weekData);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading week data:', error);
        this.loadFallbackData();
      }
    });
  }

  private mapWeeklyProgress(weekData: WeekData): any {
    if (!weekData.weeklyHabitProgress) return {};

    const totalProgress = weekData.weeklyHabitProgress.reduce((sum, habit) => 
      sum + habit.percentage, 0);
    
    const overallProgress = weekData.weeklyHabitProgress.length > 0 
      ? Math.round(totalProgress / weekData.weeklyHabitProgress.length) 
      : 0;

    const habitProgress = weekData.weeklyHabitProgress.map(habit => ({
      habitName: habit.name,
      completedCount: habit.completions,
      requiredCount: habit.target,
      isOnTrack: habit.percentage >= 75
    }));

    return {
      overallProgress: overallProgress,
      graceRemaining: 1, // Could come from API in future
      graceUsed: 0,
      habitProgress: habitProgress
    };
  }

  private mapApiDataToWeekDays(weekData: WeekData): any[] {
    return weekData.dayStatuses.map(apiDay => ({
      date: apiDay.date,
      isCompleted: apiDay.isCompleted,
      isPartiallyCompleted: apiDay.isPartiallyCompleted,
      canUseGrace: apiDay.canUseGrace,
      requiredHabitsCount: apiDay.requiredHabitsCount,
      completedRequiredCount: apiDay.completedRequiredCount,
      warnings: [],
      recommendations: []
    }));
  }

  private loadFallbackData(): void {
    this.currentWeekDays = [];
    this.weeklyProgress = {
      overallProgress: 0,
      graceRemaining: 1,
      graceUsed: 0,
      habitProgress: []
    };
    this.todayData = {
      date: new Date().toISOString().split('T')[0],
      allHabits: [],
      warnings: [],
      recommendations: [],
      canUseGrace: true,
      isCompleted: false,
      isPartiallyCompleted: false
    };
    this.loading = false;
  }


  // Update your toggleHabit method to handle ad-hoc tasks:
toggleHabit(habit: ScheduledHabit): void {
  if (habit.isAdHoc && habit.adHocId) {
    // Handle ad-hoc task completion
    this.toggleAdHocTask(habit);
  } else {
    // Handle regular habit completion (your existing logic)
    this.toggleRegularHabit(habit);
  }
}

private toggleAdHocTask(habit: ScheduledHabit): void {
  const newCompletionState = !habit.isCompleted;
  
  if (newCompletionState) {
    this.soundService.playTaskCompleted();
  }
  
  // Optimistic UI update
  habit.isCompleted = newCompletionState;
  let timeoutForCompleteDay = 0;

  this.disciplineService.completeAdHocTask({
    taskId: habit.adHocId!,
    isCompleted: newCompletionState,
    notes: 'Completed via smart schedule'
  }).subscribe({
    next: (response) => {
      console.log('Ad-hoc task toggled successfully:', response);
      // Check if all tasks are now completed for day completed sound
      const allTasksCompleted = this.todayData?.allHabits?.every(h => h.isCompleted) || false;
        if (allTasksCompleted && newCompletionState) {
          console.log('All tasks completed! Playing day completed sound');
                  timeoutForCompleteDay = 100; // Set delay for refreshing data
                setTimeout(() => {
              this.soundService.playDayCompleted();
            }, 100); // Delay of 1000 milliseconds (1 second)
          }
                  // Refresh the entire week data to update progress
          setTimeout(() => {
             this.loadCurrentWeekData();
            }, timeoutForCompleteDay); // Delay of 1000 milliseconds (1 second)    
    },
    error: (error) => {
      console.error('Error toggling ad-hoc task:', error);
      // Revert optimistic update on error
      habit.isCompleted = !newCompletionState;
    }
  });
}

  // Habit completion method
  toggleRegularHabit(habit: ScheduledHabit): void {
    if (!this.todayData) return;

    const newCompletionState = !habit.isCompleted;
      // Only play task completed sound when COMPLETING a task (not unchecking)
  if (newCompletionState) {
    console.log('Playing task completed sound for:', habit.name);
    this.soundService.playTaskCompleted();
  }
    // Optimistic UI update
    habit.isCompleted = newCompletionState;
    let timeoutForCompleteDay = 0;

    this.disciplineService.completeHabit({
      habitId: habit.habitId,
      date: this.todayData.date,
      isCompleted: newCompletionState,
      notes: 'Completed via smart schedule'
    }).subscribe({
      next: (response) => {
        console.log('Habit toggled successfully:', response);
        // Update the current day data with the response
        if (response.allHabits) {
          this.todayData = response;
                  // Check if ALL tasks are now completed (day completed sound)
        const allTasksCompleted = response.allHabits.every(h => h.isCompleted);
        
        if (allTasksCompleted && newCompletionState) {
          console.log('All tasks completed! Playing day completed sound');
                  timeoutForCompleteDay = 100; // Set delay for refreshing data
                setTimeout(() => {
              this.soundService.playDayCompleted();
            }, 100); // Delay of 1000 milliseconds (1 second)
          }
        }
        // Refresh the entire week data to update progress
          setTimeout(() => {
             this.loadCurrentWeekData();
            }, timeoutForCompleteDay); // Delay of 1000 milliseconds (1 second)
      },
      error: (error) => {
        console.error('Error toggling habit:', error);
        // Revert optimistic update on error
        habit.isCompleted = !newCompletionState;
      }
    });
  }


  // Helper methods for template
  getRequiredHabits(): ScheduledHabit[] {
    return this.todayData?.allHabits?.filter(h => h.isRequired) || [];
  }

  getOptionalHabits(): ScheduledHabit[] {
    return this.todayData?.allHabits?.filter(h => !h.isRequired) || [];
  }

  getAllHabits(): ScheduledHabit[] {
    return this.todayData?.allHabits || [];
  }

  getCompletedHabitsCount(): number {
    return this.todayData?.allHabits?.filter(h => h.isCompleted).length || 0;
  }

  getTotalHabitsCount(): number {
    return this.todayData?.allHabits?.length || 0;
  }

  getRequiredHabitsCount(): number {
    return this.getRequiredHabits().length;
  }

  getCompletedRequiredCount(): number {
    return this.getRequiredHabits().filter(h => h.isCompleted).length;
  }

  // Calendar navigation methods
  getDayName(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }

  getDayNumber(dateStr: string): number {
    return new Date(dateStr).getDate();
  }

  isToday(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  }

  isFuture(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateStr > today;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  openAddTaskDialog(): void {
  this.showAddTaskDialog = true;
  this.newTaskName = '';
  this.newTaskDescription = '';
}

closeAddTaskDialog(): void {
  this.showAddTaskDialog = false;
}

addNewTask(): void {
  if (!this.newTaskName.trim() || !this.todayData) return;

  const request: AddAdHocTaskRequest = {
    name: this.newTaskName.trim(),
    description: this.newTaskDescription.trim(),
    date: this.todayData.date
  };

  this.disciplineService.addAdHocTask(request).subscribe({
    next: (response) => {
      console.log('Ad-hoc task added successfully:', response);
      // Play success sound
      this.soundService.playTaskCompleted();
      // Refresh the current day data
      this.loadCurrentWeekData();
      // Close dialog
      this.closeAddTaskDialog();
    },
    error: (error) => {
      console.error('Error adding ad-hoc task:', error);
      alert('Failed to add task. Please try again.');
    }
  });
}

openEditTaskDialog(habit: ScheduledHabit): void {
  if (!habit.isAdHoc || !habit.adHocId) {
    console.error('Can only edit ad-hoc tasks');
    return;
  }
  
  this.editingTask = habit;
  this.editTaskName = habit.name;
  this.editTaskDescription = habit.description || '';
  this.showEditTaskDialog = true;
}

closeEditTaskDialog(): void {
  this.showEditTaskDialog = false;
  this.editingTask = null;
  this.editTaskName = '';
  this.editTaskDescription = '';
}

saveEditedTask(): void {
  if (!this.editTaskName.trim() || !this.editingTask?.adHocId) {
    return;
  }

  const request: EditAdHocTaskRequest = {
    name: this.editTaskName.trim(),
    description: (this.editTaskDescription !== undefined && this.editTaskDescription !== null)
      ? this.editTaskDescription.trim()
      : ''
  };

  this.disciplineService.editAdHocTask(this.editingTask.adHocId, request).subscribe({
    next: (response) => {
      console.log('Ad-hoc task edited successfully:', response);
      
      // Update the task in the current UI immediately
      if (this.editingTask && this.todayData?.allHabits) {
        const taskIndex = this.todayData.allHabits.findIndex(h => h.adHocId === this.editingTask!.adHocId);
        if (taskIndex !== -1) {
          this.todayData.allHabits[taskIndex].name = this.editTaskName.trim();
          this.todayData.allHabits[taskIndex].description = this.editTaskDescription.trim();
        }
      }
      
      // Close dialog
      this.closeEditTaskDialog();
      
      // Reload data to ensure consistency
      this.loadCurrentWeekData();
    },
    error: (error) => {
      console.error('Error editing ad-hoc task:', error);
      alert('Failed to update task. Please try again.');
    }
  });
}

  // Modal methods
  openDayDetail(day: any): void {
    if (this.isFuture(day.date)) return;
    this.selectedDay = day;
  }

  closeModal(): void {
    this.selectedDay = null;
  }

  // Priority and styling methods
  getPriorityClass(habit: ScheduledHabit): string {
    if (habit.isRequired) {
      return 'priority-required';
    }
    return 'priority-optional';
  }

  getCompletionClass(habit: ScheduledHabit): string {
  return habit.isCompleted ? 'completed' : 'incomplete';
}

  getDayCompletionStatus(): string {
    if (!this.todayData) return 'No data';
    
    if (this.todayData.isCompleted) {
      return 'Day Complete!';
    }
    
    if (this.todayData.isPartiallyCompleted) {
      const completed = this.getCompletedRequiredCount();
      const total = this.getRequiredHabitsCount();
      return `Progress: ${completed}/${total} required tasks`;
    }
    
    const remaining = this.getRequiredHabitsCount() - this.getCompletedRequiredCount();
    return `${remaining} required tasks remaining`;
  }

moveTaskToTomorrow(habit: ScheduledHabit): void {
    if (confirm(`Move "${habit.name}" to tomorrow?`)) {
        const request = {
            habitId: habit.habitId,
            currentDate: this.todayData?.date,
            reason: 'Moved by user request'
        };
        
        this.disciplineService.moveTaskToTomorrow(request).subscribe({
            next: (response) => {
                console.log('Task moved to tomorrow:', response);
                // Play success sound if you have sound service
                // this.soundService.playTaskCompleted();
                
                // Show success message
                alert('Task moved to tomorrow successfully!');
                
                // Reload current week data to reflect changes
                this.loadCurrentWeekData();
            },
            error: (error) => {
                console.error('Error moving task:', error);
                alert('Failed to move task. Please try again.');
            }
        });
    }
}

  // Grace day method
  useGraceDay(): void {
    if (!this.todayData?.canUseGrace) return;

    this.disciplineService.useGraceDay({
      date: this.todayData.date,
      reason: 'Used grace day via smart schedule'
    }).subscribe({
      next: (response) => {
        console.log('Grace day used:', response);
        this.loadCurrentWeekData();
      },
      error: (error) => {
        console.error('Error using grace day:', error);
      }
    });
  }

  /**
   * Get urgency level based on time remaining
   */
  getUrgencyLevel(timeRemaining: string): 'normal' | 'urgent' | 'critical' {
    if (!timeRemaining) return 'normal';
    
    // Extract hours from "2h 30m remaining" format
    const hourMatch = timeRemaining.match(/(\d+)h/);
    const minuteMatch = timeRemaining.match(/(\d+)m/);
    
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes <= 30) return 'critical';  // 30 minutes or less
    if (totalMinutes <= 120) return 'urgent';   // 2 hours or less
    return 'normal';
  }

  /**
   * Get deadline warning message
   */
  getDeadlineWarningMessage(habit: ScheduledHabit): string {
    if (!habit.timeRemaining) return '';
    
    const urgency = this.getUrgencyLevel(habit.timeRemaining);
    
    switch (urgency) {
      case 'critical':
        return `🚨 URGENT: Only ${habit.timeRemaining} to complete "${habit.name}"!`;
      case 'urgent':
        return `⚠️ ${habit.timeRemaining} to complete "${habit.name}"`;
      default:
        return '';
    }
  }

  isDailyHabit(habit: any): boolean {
  // Check if habit frequency is Daily (assuming you have access to frequency data)
  return typeof habit.reason === 'string' && habit.reason.toLowerCase().includes('daily');
}

  /**
   * Update time remaining for all habits (call this periodically)
   */
refreshTimeRemaining(): void {
  if (this.todayData?.allHabits) {
    this.todayData.allHabits.forEach(habit => {
      if (habit.hasDeadline && !habit.isCompleted) {
        habit.timeRemaining = this.calculateTimeRemaining(habit.deadlineTime);
        habit.isOverdue = this.disciplineService.isOverdue(habit.deadlineTime, habit.isCompleted);
      } else {
        // ✅ Clear deadline-related properties for habits without deadlines
        habit.timeRemaining = undefined;
        habit.isOverdue = false;
      }
    });
  }
}

  private calculateTimeRemaining(deadlineTime?: string): string | undefined {
    if (!deadlineTime) return undefined;
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const deadlineDateTime = new Date(`${today}T${deadlineTime}`);
    
    if (now > deadlineDateTime) return undefined;
    
    const diffMs = deadlineDateTime.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}