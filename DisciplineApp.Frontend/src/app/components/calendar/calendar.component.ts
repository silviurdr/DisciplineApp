// ===================================
// 1. MODELS FILE - src/app/models/discipline.models.ts
// ===================================

export interface CalendarDay {
  date: string; // YYYY-MM-DD format
  dayOfMonth: number;
  isCompleted: boolean;
  isSpecial: boolean;
  dayInStreak: number;
  color: StreakColor;
  rewards: Reward[];
}

export interface MonthData {
  month: number;
  year: number;
  monthName: string;
  days: CalendarDay[];
}

export interface YearCalendar {
  year: number;
  months: MonthData[];
  streakInfo: StreakInfo;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  weeklyRewards: number;
  monthlyRewards: number;
  nextMilestone?: number;
  lastUpdate?: string;
}

export interface Reward {
  id: number;
  type: string;
  description: string;
  earnedAt: string;
}


export interface HabitProgress {
  habitName: string;
  completedCount: number;
  requiredCount: number;
  urgency: string;
  remainingDays: number;
  isAchievable: boolean;
  isOnTrack: boolean;
}

export enum StreakColor {
  None = 0,
  Salmon = 1,
  Orange = 2,
  Yellow = 3,
  White = 4
}

// ===================================
// 2. COMPONENT TYPESCRIPT - calendar.component.ts
// ===================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DisciplineService } from '../../services/discipline.services';
import { SoundService } from '../../services/sound.service';
import { 
  WeekData, 
  DayData, 
  WeeklyProgress, 
  ScheduledHabit, 
  HabitWithFlexibility 
} from '../../models/discipline.models';

// Pipe for sorting habits
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sortCompleted',
  standalone: true
})
export class SortCompletedPipe implements PipeTransform {
  transform(habits: ScheduledHabit[]): ScheduledHabit[] {
    if (!habits) return [];
    return habits.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1; // Incomplete first
      }
      if (a.isRequired !== b.isRequired) {
        return a.isRequired ? -1 : 1; // Required first
      }
      return 0;
    });
  }
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
  weeklyProgress: WeeklyProgress | null = null;
  currentWeekDays: DayData[] = [];
  flexibleTasks: HabitWithFlexibility[] = [];
  loading = true;
  error: string | null = null;
  selectedDay: DayData | null = null;
  showAddTaskDialog = false;
  newTaskName = '';
  newTaskDescription = '';
  showEditTaskDialog = false;
  editingTask: ScheduledHabit | null = null;
  editTaskName = '';
  editTaskDescription = '';
  errorMessage = '';

  constructor(
    private disciplineService: DisciplineService,
    private soundService: SoundService
  ) {}

  ngOnInit(): void {
    this.loadCurrentWeekData();
    this.loadFlexibleTasks();
  }

  // ===================================
  // DATA LOADING METHODS
  // ===================================

loadCurrentWeekData(): void {
  this.loading = true;
  this.error = null;

  console.log('🔍 Loading current week data...');

  this.disciplineService.getCurrentWeek().subscribe({
    next: (weekData) => {
      console.log('✅ Week data received:', weekData);
      
      this.weekData = weekData;
      this.currentWeekDays = weekData.days;
      
      // Find today's data
      const today = new Date();
      this.todayData = weekData.days.find(day => 
        new Date(day.date).toDateString() === today.toDateString()
      ) || null;

      // 🔍 DEBUG: Check deadline data specifically
      if (this.todayData?.allHabits) {
        console.log('📋 Today\'s habits with deadline info:');
        this.todayData.allHabits.forEach(habit => {
          if (habit.name === 'Phone Lock Box') {
            console.log('📱 Phone Lock Box deadline data:', {
              name: habit.name,
              hasDeadline: habit.hasDeadline,
              deadlineTime: habit.deadlineTime,
              timeRemaining: habit.timeRemaining,
              isOverdue: habit.isOverdue,
              isCompleted: habit.isCompleted
            });
          }
        });
      }

      this.loading = false;
    },
    error: (error) => {
      console.error('❌ Error loading week data:', error);
      this.error = 'Failed to load calendar data';
      this.loading = false;
    }
  });
}

  loadFlexibleTasks(): void {
    const today = new Date().toISOString().split('T')[0];
    
    this.disciplineService.getFlexibleTasksForDay(today).subscribe({
      next: (tasks: HabitWithFlexibility[]) => {
        this.flexibleTasks = tasks;
        console.log('Flexible tasks loaded:', tasks);
      },
      error: (error) => {
        console.error('Error loading flexible tasks:', error);
        this.errorMessage = 'Failed to load tasks. Please refresh the page.';
      }
    });
  }

  // ===================================
  // FLEXIBLE TASK METHODS
  // ===================================

  getHabitClasses(habit: ScheduledHabit): string {
    const classes = [];
    
    // Priority classes
    if (habit.isRequired) classes.push('required');
    if (!habit.isRequired) classes.push('optional');
    
    // Completion classes
    if (habit.isCompleted) classes.push('completed');
    
    // Urgency classes
    if (!habit.isCompleted) {
      if (habit.isOverdue) classes.push('overdue');
      if (habit.timeRemaining) {
        const urgency = this.getUrgencyLevel(habit.timeRemaining);
        if (urgency === 'urgent') classes.push('urgent');
        if (urgency === 'critical') classes.push('critical');
      }
    }
    
    // Flexibility classes
    const flexInfo = this.getFlexibilityInfo(habit);
    if (flexInfo) {
      classes.push(`flexibility-${flexInfo.urgency}`);
    }
    
    // Type classes
    if (habit.isAdHoc) classes.push('ad-hoc');
    
    return classes.join(' ');
  }

  getFlexibilityInfo(habit: ScheduledHabit): {
    urgency: string;
    color: string;
    icon: string;
    label: string;
    statusText: string;
    remainingDeferrals: number;
    maxDeferrals: number;
    deferralsUsed: number;
    showDetails: boolean;
  } | null {
    // Skip daily and ad-hoc tasks
    if (this.isDailyHabit(habit) || habit.isAdHoc) {
      return null;
    }
    
    // Get max deferrals based on frequency
    const maxDeferrals = this.getMaxDeferralsForFrequency(habit.frequency || habit.reason || '');
    if (maxDeferrals === 0) return null;
    
    // Get current deferral usage
    const deferralsUsed = habit.deferralsUsed || 0;
    const remainingDeferrals = maxDeferrals - deferralsUsed;
    const usagePercentage = deferralsUsed / maxDeferrals;
    
    let urgency: string;
    let color: string;
    let icon: string;
    let label: string;
    let statusText: string;
    
    if (remainingDeferrals === 0) {
      urgency = 'critical';
      color = '#dc3545';
      icon = '🚨';
      label = 'FINAL DAY';
      statusText = 'Must complete today - no more deferrals';
    } else if (usagePercentage >= 0.66) {
      urgency = 'urgent';
      color = '#fd7e14';
      icon = '🔥';
      label = `${remainingDeferrals} left`;
      statusText = remainingDeferrals === 1 ? 'Can move 1 more time' : `Can move ${remainingDeferrals} more times`;
    } else if (usagePercentage >= 0.33) {
      urgency = 'warning';
      color = '#ffc107';
      icon = '⚠️';
      label = `${remainingDeferrals} left`;
      statusText = remainingDeferrals === 1 ? 'Can move 1 more time' : `Can move ${remainingDeferrals} more times`;
    } else {
      urgency = 'safe';
      color = '#28a745';
      icon = '✅';
      label = `${remainingDeferrals} left`;
      statusText = remainingDeferrals === 1 ? 'Can move 1 more time' : `Can move ${remainingDeferrals} more times`;
    }
    
    return {
      urgency,
      color,
      icon,
      label,
      statusText,
      remainingDeferrals,
      maxDeferrals,
      deferralsUsed,
      showDetails: true
    };
  }

  private getMaxDeferralsForFrequency(frequency: string): number {
    if (!frequency) return 0;
    
    const freq = frequency.toLowerCase();
    if (freq.includes('daily')) return 0;
    if (freq.includes('weekly') || freq.includes('gym') || freq.includes('vacuum') || freq.includes('bathroom')) return 2;
    if (freq.includes('monthly') || freq.includes('seasonal') || freq.includes('kitchen') || freq.includes('window')) return 6;
    if (freq.includes('every') && freq.includes('2')) return 1; // EveryTwoDays
    
    return 0;
  }

  canMoveHabitToTomorrow(habit: ScheduledHabit): boolean {
    return !this.isDailyHabit(habit) && !habit.isCompleted && !habit.isAdHoc && !habit.isLocked;
  }

  canActuallyMoveHabit(habit: ScheduledHabit): boolean {
    if (!this.canMoveHabitToTomorrow(habit)) return false;
    
    const flexInfo = this.getFlexibilityInfo(habit);
    return flexInfo ? flexInfo.remainingDeferrals > 0 : false;
  }

  getMoveButtonText(habit: ScheduledHabit): string {
    const flexInfo = this.getFlexibilityInfo(habit);
    if (!flexInfo || flexInfo.remainingDeferrals === 0) {
      return 'Cannot Move';
    }
    return 'Move to Tomorrow';
  }

  getMoveButtonTooltip(habit: ScheduledHabit): string {
    const flexInfo = this.getFlexibilityInfo(habit);
    if (!flexInfo) return 'Daily tasks cannot be moved';
    
    if (flexInfo.remainingDeferrals === 0) {
      return 'No more deferrals available - must complete today';
    }
    
    return `${flexInfo.statusText}`;
  }

  // ===================================
  // ACTION METHODS
  // ===================================

 moveTaskToTomorrow(habit: ScheduledHabit): void {
  // Prevent moving completed tasks
  if (habit.isCompleted) {
    console.log('Cannot move completed tasks');
    return;
  }

  // Prevent moving daily habits
  if (this.isDailyHabit(habit)) {
    alert('Daily habits cannot be moved to tomorrow');
    return;
  }
    if (!this.canActuallyMoveHabit(habit)) {
      const flexInfo = this.getFlexibilityInfo(habit);
      const message = flexInfo ? 
        `Cannot move ${habit.name}: ${flexInfo.statusText}` :
        `Cannot move ${habit.name}: Daily tasks must be completed today`;
      alert(message);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Use flexible task service if available
    if (this.disciplineService.deferTask) {
      this.disciplineService.deferTask(habit.habitId, today, 'User requested').subscribe({
        next: (updatedTask) => {
          console.log('Task deferred successfully:', updatedTask);
          
          // Update the habit in the current day's data
          if (this.todayData?.allHabits) {
            const index = this.todayData.allHabits.findIndex(h => h.habitId === habit.habitId);
            if (index !== -1) {
              this.todayData.allHabits[index].deferralsUsed = (habit.deferralsUsed || 0) + 1;
            }
          }
          
          alert(`${habit.name} moved to tomorrow. ${updatedTask.statusLabel || 'Task rescheduled successfully.'}`);
          this.loadCurrentWeekData();
        },
        error: (error) => {
          console.error('Error moving task:', error);
          alert('Failed to move task. Please try again.');
        }
      });
    } else {
      // Fallback to original move logic
      this.disciplineService.moveTaskToTomorrow({
        habitId: habit.habitId,
        currentDate: today,
        reason: 'User requested'
      }).subscribe({
        next: (response) => {
          console.log('Task moved:', response);
          alert(`${habit.name} moved to tomorrow`);
          this.loadCurrentWeekData();
        },
        error: (error) => {
          console.error('Error moving task:', error);
          alert('Failed to move task. Please try again.');
        }
      });
    }
  }

  toggleRegularHabit(habit: ScheduledHabit): void {
    if (habit.isLocked) {
      console.log('Habit is locked, cannot toggle');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    this.disciplineService.completeHabit({
      habitId: habit.habitId,
      date: today,
      isCompleted: !habit.isCompleted,
      adHocId: habit.adHocId
    }).subscribe({
      next: (response) => {
        console.log('Habit completion toggled:', response);
        
        // Update local state
        habit.isCompleted = !habit.isCompleted;
        
        // Play sound effect
        if (habit.isCompleted) {
          this.soundService.playTaskCompleted();
        }
        
        // Reload data to refresh counters
        this.loadCurrentWeekData();
        this.loadFlexibleTasks();
      },
      error: (error) => {
        console.error('Error toggling habit:', error);
        alert('Failed to update habit. Please try again.');
      }
    });
  }
// Add these methods to your calendar.component.ts

getCurrentWeekRange(): string {
  if (!this.weekData) return 'Loading...';
  
  const startDate = new Date(this.weekData.days[0].date);
  const endDate = new Date(this.weekData.days[6].date);
  
  const formatOptions: Intl.DateTimeFormatOptions = { 
    month: 'long', 
    day: 'numeric' 
  };
  
  const start = startDate.toLocaleDateString('en-US', formatOptions);
  const end = endDate.toLocaleDateString('en-US', formatOptions);
  const year = endDate.getFullYear();
  
  return `${start} - ${end}, ${year}`;
}

getWeekProgressPercentage(): number {
  if (!this.weekData) return 0;
  
  const totalTasks = this.weekData.days.reduce((sum, day) => sum + (day.totalHabits || 0), 0);
  const completedTasks = this.weekData.days.reduce((sum, day) => sum + (day.completedHabits || 0), 0);
  
  return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
}
toggleTask(habit: ScheduledHabit): void {
  // Prevent toggling locked tasks
  if (habit.isLocked) {
    console.log('Task is locked, cannot toggle');
    return;
  }

  // For completed ad-hoc tasks, show a message instead of allowing toggle
  if (habit.isAdHoc && habit.isCompleted) {
    console.log('Completed ad-hoc tasks cannot be unchecked');
    return;
  }

  // Check if it's an ad-hoc task
  if (habit.isAdHoc && habit.adHocId) {
    this.toggleAdHocTask(habit);
  } else {
    this.toggleRegularHabit(habit);
  }
}

  toggleAdHocTask(habit: ScheduledHabit): void {
  if (!habit.isAdHoc || !habit.adHocId) {
    console.error('Invalid ad-hoc task', habit);
    return;
  }

  this.disciplineService.completeAdHocTask({
    taskId: habit.adHocId,
    isCompleted: !habit.isCompleted,
    notes: ''
  }).subscribe({
    next: (response) => {
      console.log('Ad-hoc task toggled successfully:', response);
      
      // Update local state
      habit.isCompleted = !habit.isCompleted;
      
      // Play sound effect
      if (habit.isCompleted) {
        this.soundService.playTaskCompleted();
      }
      
      // Refresh all data to update counters and status
      this.loadCurrentWeekData();
    },
    error: (error) => {
      console.error('Error toggling ad-hoc task:', error);
      this.errorMessage = 'Failed to update task. Please try again.';
    }
  });
}

shouldDisableActions(habit: ScheduledHabit): boolean {
  // Ad-hoc tasks should be disabled when completed
  if (habit.isAdHoc && habit.isCompleted) {
    return true;
  }
  
  // Locked tasks are always disabled
  if (habit.isLocked) {
    return true;
  }
  
  return false;
}

/**
 * Check if edit button should be shown
 */
shouldShowEditButton(habit: ScheduledHabit): boolean {
  // Only show edit for ad-hoc tasks that are not completed
  return !!habit.isAdHoc && !habit.isCompleted && !habit.isLocked;
}

/**
 * Check if defer button should be shown
 */
shouldShowDeferButton(habit: ScheduledHabit): boolean {
  // Don't show defer for daily habits, completed tasks, or locked tasks
  return !this.isDailyHabit(habit) && 
         !habit.isCompleted && 
         !habit.isLocked;
}

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

  // ===================================
  // UTILITY METHODS
  // ===================================

  isUrgentTask(habit: ScheduledHabit): boolean {
    if (habit.isCompleted) return false;
    
    // Check deadline urgency
    if (habit.timeRemaining) {
      const urgency = this.getUrgencyLevel(habit.timeRemaining);
      if (urgency === 'critical' || urgency === 'urgent') return true;
    }
    
    // Check flexibility urgency
    const flexInfo = this.getFlexibilityInfo(habit);
    if (flexInfo && (flexInfo.urgency === 'critical' || flexInfo.urgency === 'urgent')) {
      return true;
    }
    
    return habit.isOverdue;
  }

  // ===================================
// ADD TASK MODAL METHODS
// ===================================

addAdHocTask(): void {
  if (!this.newTaskName.trim()) {
    this.errorMessage = 'Task name is required';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  
  this.disciplineService.addAdHocTask({
    name: this.newTaskName.trim(),
    description: this.newTaskDescription.trim(),
    date: today
  }).subscribe({
    next: (response) => {
      console.log('Ad-hoc task added successfully:', response);
      this.showAddTaskDialog = false;
      this.newTaskName = '';
      this.newTaskDescription = '';
      this.errorMessage = '';
      
      // Refresh the data to show the new task
      this.loadCurrentWeekData();
    },
    error: (error) => {
      console.error('Error adding ad-hoc task:', error);
      this.errorMessage = 'Failed to add task. Please try again.';
    }
  });
}

saveEditedTask(): void {
  if (!this.editingTask || !this.editTaskName.trim()) {
    this.errorMessage = 'Task name is required';
    return;
  }

  this.disciplineService.editAdHocTask({
    adHocId: this.editingTask.adHocId!,
    name: this.editTaskName.trim(),
    description: this.editTaskDescription.trim()
  }).subscribe({
    next: (response) => {
      console.log('Ad-hoc task edited successfully:', response);
      this.showEditTaskDialog = false;
      this.editingTask = null;
      this.editTaskName = '';
      this.editTaskDescription = '';
      this.errorMessage = '';
      
      // Refresh the data to show the updated task
      this.loadCurrentWeekData();
    },
    error: (error) => {
      console.error('Error editing ad-hoc task:', error);
      this.errorMessage = 'Failed to update task. Please try again.';
    }
  });
}

cancelAddTask(): void {
  this.showAddTaskDialog = false;
  this.newTaskName = '';
  this.newTaskDescription = '';
  this.errorMessage = '';
}

cancelEditTask(): void {
  this.showEditTaskDialog = false;
  this.editingTask = null;
  this.editTaskName = '';
  this.editTaskDescription = '';
  this.errorMessage = '';
}

  isDailyHabit(habit: ScheduledHabit): boolean {
    if (habit.frequency && habit.frequency.toLowerCase().includes('daily')) return true;
    if (habit.reason && habit.reason.toLowerCase().includes('daily')) return true;
    return false;
  }

  getUrgencyLevel(timeRemaining: string): 'normal' | 'urgent' | 'critical' {
    if (!timeRemaining) return 'normal';
    
    const hourMatch = timeRemaining.match(/(\d+)h/);
    const minuteMatch = timeRemaining.match(/(\d+)m/);
    
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes <= 30) return 'critical';
    if (totalMinutes <= 120) return 'urgent';
    return 'normal';
  }

  // Date utility methods
  getDayName(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getDayNumber(date: Date | string): number {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.getDate();
  }

  isToday(date: Date | string): boolean {
    const today = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    return today.getFullYear() === dateObj.getFullYear() &&
           today.getMonth() === dateObj.getMonth() &&
           today.getDate() === dateObj.getDate();
  }

  isFuture(date: Date | string): boolean {
    const today = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj > today;
  }

  isAnyToday(): boolean {
    if (!this.currentWeekDays) return false;
    return this.currentWeekDays.some(day => this.isToday(day.date));
  }

  getCompletionIcon(day: DayData): string {
    if (day.isCompleted) return '✅';
    if (day.isPartiallyCompleted) return '🔶';
    return '⭕';
  }

calculateWeekProgress(): number {
  if (!this.currentWeekDays) return 0;
  
  let totalTasksCompleted = 0;
  let totalTasksForEntireWeek = 0;
  
  this.currentWeekDays.forEach(day => {
    // Count ALL tasks from ALL days (past, present, and future)
    totalTasksForEntireWeek += day.totalHabits || 0;
    
    // Only count completed tasks from past and current days
    if (!day.isFuture) {
      totalTasksCompleted += day.completedHabits || 0;
    }
  });
  
  return totalTasksForEntireWeek > 0 
    ? Math.round((totalTasksCompleted / totalTasksForEntireWeek) * 100)
    : 0;
}

calculateWeeklyHabitProgress(): {habitName: string, completed: number, total: number, percentage: number}[] {
  if (!this.currentWeekDays) return [];
  
  const habitStats = new Map<string, {completed: number, total: number}>();
  
  this.currentWeekDays.forEach(day => {
    if (day.allHabits) {
      day.allHabits.forEach(habit => {
        const habitName = habit.name;
        
        if (!habitStats.has(habitName)) {
          habitStats.set(habitName, {completed: 0, total: 0});
        }
        
        const stats = habitStats.get(habitName)!;
        stats.total += 1; // This habit appears on this day
        
        // Only count as completed if it's not a future day
        if (!day.isFuture && habit.isCompleted) {
          stats.completed += 1;
        }
      });
    }
  });
  
  // Convert to array and calculate percentages
  return Array.from(habitStats.entries()).map(([habitName, stats]) => ({
    habitName,
    completed: stats.completed,
    total: stats.total,
    percentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  }));
}

  getCompletionPercentage(day: DayData): number {
    if (!day.totalHabits || day.totalHabits === 0) return 0;
    return Math.round((day.completedHabits / day.totalHabits) * 100);
  }

  getRequiredTasksCompleted(day: DayData): number {
    if (!day.allHabits) return 0;
    return day.allHabits.filter(h => h.isRequired && h.isCompleted).length;
  }

  getRequiredTasksTotal(day: DayData): number {
    if (!day.allHabits) return 0;
    return day.allHabits.filter(h => h.isRequired).length;
  }

  getOptionalTasksCompleted(day: DayData): number {
    if (!day.allHabits) return 0;
    return day.allHabits.filter(h => !h.isRequired && h.isCompleted).length;
  }

  getOptionalTasksTotal(day: DayData): number {
    if (!day.allHabits) return 0;
    return day.allHabits.filter(h => !h.isRequired).length;
  }

  openDayDetail(day: DayData): void {
    this.selectedDay = day;
    console.log('Opening day detail for:', day);
  }

  openAddTaskModal(): void {
    this.showAddTaskDialog = true;
    this.newTaskName = '';
    this.newTaskDescription = '';
  }

editAdHocTask(habit: ScheduledHabit): void {
  // Prevent editing completed ad-hoc tasks
  if (habit.isCompleted) {
    console.log('Cannot edit completed ad-hoc tasks');
    return;
  }

  // Proceed with original edit logic
  this.editingTask = habit;
  this.editTaskName = habit.name;
  this.editTaskDescription = habit.description;
  this.showEditTaskDialog = true;
}
}