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

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DisciplineService } from '../../services/discipline.services';
import { SoundService } from '../../services/sound.service';
import { LoadingService } from '../../services/loading.service';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { 
  WeekData, 
  DayData, 
  WeeklyProgress, 
  ScheduledHabit, 
  HabitWithFlexibility, 
} from '../../models/discipline.models';

import { SubHabitsService } from '../../services/sub-habits.service';
import { 
  HabitWithSubHabits, 
  SubHabit, 
  CompleteSubHabitRequest, 
  CompleteAllSubHabitsRequest 
} from '../../models/discipline.models';

import { DaysLeftPipe } from '../../pipes/days-left-pipe';

// Pipe for sorting habits
import { Pipe, PipeTransform,  } from '@angular/core';

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
  imports: [CommonModule, FormsModule, SortCompletedPipe, DaysLeftPipe],
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
  hasDeadline = false;
  deadlineDate = '';
  habitsWithSubHabits: HabitWithSubHabits[] = [];
  expandedHabits: Set<number> = new Set(); // Track which habits are expanded
  newTaskEstimatedDuration: number | null = null;
  editTaskEstimatedDuration: number | null = null;
  estimatedDurations: number | null = null;
  isAdvancedCompleting: number | null = null;
  successMessage: string | null = null;
  errorMessageBox: string | null = null;

  constructor(
    private disciplineService: DisciplineService,
    private soundService: SoundService,
    private loadingService: LoadingService,
    private subHabitsService: SubHabitsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadingService.show();
    this.initializeComponent();
  }

  // ===================================
  // DATA LOADING METHODS
  // ===================================


private async initializeComponent(): Promise<void> {
  try {
    // Convert your existing methods to promises and run in parallel
   await Promise.all([
      this.loadCurrentWeekDataAsPromise(), // ✅ Your original working method
      this.loadFlexibleTasksAsPromise()
    ]);
  } finally {
    // Hide loading after everything is loaded
    setTimeout(() => this.loadingService.hide(), 200);
  }
}

private async loadCurrentWeekDataAsPromise(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.loading = true; // Keep loading true throughout the entire process
    this.error = null;

    console.log('🔍 Loading current week data...');

    this.disciplineService.getCurrentWeek().subscribe({
      next: async (weekData) => {
        try {
          console.log('✅ Week data received:', weekData);
          
          this.weekData = weekData;
          this.currentWeekDays = weekData.days;
          
          // Find today's data
          const today = new Date();
          this.todayData = weekData.days.find(day => 
            new Date(day.date).toDateString() === today.toDateString()
          ) || null;

          // CRITICAL: Wait for sub-habits to load BEFORE setting loading = false
          if (this.todayData && this.todayData.allHabits) {
            console.log('🔄 Loading sub-habits...');
            // Wait for sub-habits to complete loading
            await this.loadSubHabitsForHabits(this.todayData.allHabits);
            console.log('✅ Sub-habits loaded completely');

            // Process deadline and overdue information
            this.todayData.allHabits.forEach(habit => {
              if (habit.hasDeadline) {
                // ✅ ONLY calculate isOverdue, keep backend timeRemaining
                habit.isOverdue = this.isHabitOverdue(habit);
                
                // Debug what we have
                console.log(`🔧 Processing ${habit.name}:`, {
                  backendTimeRemaining: habit.timeRemaining,
                  hasDeadline: habit.hasDeadline,
                  isCompleted: habit.isCompleted,
                  isOverdue: habit.isOverdue,
                  willShow: !!(habit.timeRemaining && !habit.isCompleted && !habit.isOverdue)
                });
              }
            });
          }

          // Calculate "MUST DO" status
          if (this.todayData && this.todayData.allHabits) {
            const habitStats = new Map<string, {completed: number, total: number}>();
            this.currentWeekDays.forEach(day => {
              day.allHabits?.forEach(habit => {
                if (habit.isAdHoc) return;
                const stats = habitStats.get(habit.name) || {completed: 0, total: 0};
                stats.total += 1;
                if (habit.isCompleted) stats.completed += 1;
                habitStats.set(habit.name, stats);
              });
            });

            const daysRemaining = this.currentWeekDays.filter(d => this.isToday(d.date) || this.isFuture(d.date)).length;

            this.todayData.allHabits.forEach(habit => {
              const stats = habitStats.get(habit.name);
              if (stats) {
                const remainingTasks = stats.total - stats.completed;
                habit.isMustDo = (remainingTasks === daysRemaining && remainingTasks > 0);
              }
            });

                      this.todayData.allHabits.forEach(habit => {
            console.log(`🔍 Frontend received for ${habit.name}:`, {
              timeRemaining: habit.timeRemaining,
              hasDeadline: habit.hasDeadline,
              isCompleted: habit.isCompleted,
              isOverdue: habit.isOverdue,
              isAdHoc: habit.isAdHoc,
              priority: habit.priority
            });
          });
          }

          

          console.log('📅 Today\'s data (with sub-habits):', this.todayData);
          
          // ONLY set loading = false after EVERYTHING is ready
          this.loading = false;
          resolve();
        } catch (error) {
          console.error('❌ Error in async processing:', error);
          this.error = 'Failed to load task data';
          this.loading = false;
          reject(error);
        }
      },
      error: (error) => {
        console.error('❌ Error loading week data:', error);
        this.error = 'Failed to load calendar data';
        this.loading = false;
        reject(error);
      }
    });
  });
}
// CORRECT FIX: Replace your loadSubHabitsForHabits method with this version

private async loadSubHabitsForHabits(habits: any[]): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  console.log('🔧 Enriching', habits.length, 'habits with sub-habits data');
  
  // FIXED: Enrich each habit IN PLACE instead of creating new array
  for (let i = 0; i < habits.length; i++) {
    const habit = habits[i];
    
    try {
      // Only load sub-habits for non-ad-hoc tasks
      if (!habit.isAdHoc && habit.habitId) {
        const response = await this.subHabitsService.getSubHabitsWithCompletions(habit.habitId, today).toPromise();
        
        if (response && response.subHabits && response.subHabits.length > 0) {
          // FIXED: Add sub-habit properties directly to the existing habit object
          habit.subHabits = response.subHabits;
          habit.hasSubHabits = true;
          habit.totalSubHabitsCount = response.subHabits.length;
          habit.completedSubHabitsCount = response.subHabits.filter(sh => sh.isCompleted).length;
          habit.allSubHabitsCompleted = habit.completedSubHabitsCount === habit.totalSubHabitsCount;
          habit.isExpanded = false;
        } else {
          // Set default values for habits without sub-habits
          habit.subHabits = [];
          habit.hasSubHabits = false;
          habit.totalSubHabitsCount = 0;
          habit.completedSubHabitsCount = 0;
          habit.allSubHabitsCompleted = false;
          habit.isExpanded = false;
        }
      } else {
        // Set default values for ad-hoc tasks
        habit.subHabits = [];
        habit.hasSubHabits = false;
        habit.totalSubHabitsCount = 0;
        habit.completedSubHabitsCount = 0;
        habit.allSubHabitsCompleted = false;
        habit.isExpanded = false;
      }
    } catch (error) {
      console.error(`Error loading sub-habits for habit ${habit.habitId}:`, error);
      // Set default values on error
      habit.subHabits = [];
      habit.hasSubHabits = false;
      habit.totalSubHabitsCount = 0;
      habit.completedSubHabitsCount = 0;
      habit.allSubHabitsCompleted = false;
      habit.isExpanded = false;
    }
  }

  // FIXED: Update habitsWithSubHabits to reference the same enriched habits
  this.habitsWithSubHabits = habits;
  
  console.log('✅ Habits enriched successfully. Total count:', habits.length);
  console.log('✅ Habits with sub-habits:', habits.filter(h => h.hasSubHabits).length);
  
  // No need to modify todayData.allHabits since we enriched the original array in place
}
toggleHabitExpansion(habitId: number): void {
    if (this.expandedHabits.has(habitId)) {
      this.expandedHabits.delete(habitId);
    } else {
      this.expandedHabits.add(habitId);
    }

    // Update the habit's expanded state
    const habit = this.habitsWithSubHabits.find(h => h.habitId === habitId);
    if (habit) {
      habit.isExpanded = this.expandedHabits.has(habitId);
    }
  }


  // NEW: Check if habit is expanded
 isHabitExpanded(habitId: number): boolean {
    return this.expandedHabits.has(habitId);
  }

async toggleSubHabitCompletion(subHabitId: number, isCompleted: boolean): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // OPTIMISTIC UPDATE: Find and update the sub-habit immediately
    let parentHabit: any = null;
    let subHabit: any = null;
    
    for (const habit of this.habitsWithSubHabits) {
      if (habit.subHabits) {
        const foundSubHabit = habit.subHabits.find(sh => sh.id === subHabitId);
        if (foundSubHabit) {
          subHabit = foundSubHabit;
          parentHabit = habit;
          break;
        }
      }
    }
    
    if (subHabit && parentHabit) {
      // Update sub-habit status immediately
      subHabit.isCompleted = isCompleted;
      subHabit.completedAt = isCompleted ? new Date().toISOString() : null;
      
      // Update parent habit counts
      parentHabit.completedSubHabitsCount = parentHabit.subHabits.filter((sh: SubHabit) => sh.isCompleted).length;
      parentHabit.allSubHabitsCompleted = parentHabit.completedSubHabitsCount === parentHabit.totalSubHabitsCount;
      
      // Update main habit completion if all sub-habits are done
      if (parentHabit.allSubHabitsCompleted && !parentHabit.isCompleted) {
        parentHabit.isCompleted = true;
        this.soundService.playTaskCompleted();
      }
      
      this.updateTaskCounts(); // Update counters
    }
    
    // Make API call in background
    const response = await this.subHabitsService.completeSubHabit(subHabitId, {
      date: today,
      isCompleted: isCompleted
    }).toPromise();
    
    console.log('Sub-habit completion updated:', response);
    // NO RELOAD - UI already updated optimistically
    
  } catch (error) {
    console.error('Error toggling sub-habit completion:', error);
    // TODO: Add rollback logic here if needed
  }
}

async quickCompleteAllSubHabits(habitId: number): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('🚀 Quick completing all sub-habits for habit:', habitId);
    
    // Call the backend API to complete all sub-habits
    const response = await this.subHabitsService.completeAllSubHabits(habitId, {
      date: today
    }).toPromise();
    
    console.log('✅ All sub-habits completed:', response);
    
    // Update the frontend immediately
    const parentHabit = this.habitsWithSubHabits.find(h => h.habitId === habitId);
    if (parentHabit && parentHabit.subHabits) {
      // Mark all sub-habits as completed
      parentHabit.subHabits.forEach((subHabit: any) => {
        subHabit.isCompleted = true;
        subHabit.completedAt = new Date().toISOString();
      });
      
      // Update parent habit counts and completion
      parentHabit.completedSubHabitsCount = parentHabit.totalSubHabitsCount;
      parentHabit.allSubHabitsCompleted = true;
      parentHabit.isCompleted = true;
      
      // Update the main habit in todayData
      const mainHabit = this.todayData?.allHabits?.find(h => h.habitId === habitId);
      if (mainHabit) {
        mainHabit.isCompleted = true;
      }
      
      // Play success sound
      this.soundService.playTaskCompleted();
      
      // Update task counts
      this.updateTaskCounts();
    }
    
  } catch (error) {
    console.error('❌ Error completing all sub-habits:', error);
    alert('Failed to complete all sub-habits. Please try again.');
  }
}

  private async refreshWeekData(): Promise<void> {
    try {
      await this.loadCurrentWeekDataAsPromise();
    } catch (error) {
      console.error('Error refreshing week data:', error);
    }
  }
  
private loadFlexibleTasksAsPromise(): Promise<void> {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    
    this.disciplineService.getFlexibleTasksForDay(today).subscribe({
      next: (tasks: HabitWithFlexibility[]) => {
        this.flexibleTasks = tasks;
        console.log('Flexible tasks loaded:', tasks);
        resolve();
      },
      error: (error) => {
        console.error('Error loading flexible tasks:', error);
        this.errorMessage = 'Failed to load tasks. Please refresh the page.';
        reject(error);
      }
    });
  });
}

loadCurrentWeekData(): void {
  // Just call the promise version
  this.loadCurrentWeekDataAsPromise().catch(error => {
    console.error('Error in loadCurrentWeekData:', error);
  });
}

loadFlexibleTasks(): void {
  // Just call the promise version
  this.loadFlexibleTasksAsPromise().catch(error => {
    console.error('Error in loadFlexibleTasks:', error);
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
    const maxDeferrals = habit.maxDeferrals !== undefined ? habit.maxDeferrals : this.getMaxDeferralsForFrequency(habit.frequency || '');
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
  if (this.isDailyHabit(habit)) {
    return 'Daily habits cannot be moved - required every day';
  }

  const flexInfo = this.getFlexibilityInfo(habit);
  if (!flexInfo) return 'This task cannot be moved';
  
  if (flexInfo.remainingDeferrals === 0) {
    return '⚠️ No deferrals remaining - must complete today';
  }
  
  // Enhanced tooltip with prominent deferral count
  const deferralsText = flexInfo.remainingDeferrals === 1 
    ? '1 deferral remaining' 
    : `${flexInfo.remainingDeferrals} deferrals remaining`;
  
  if (habit.frequency?.toLowerCase().includes('weekly')) {
    return `📅 Move to next available day this week\n💫 ${deferralsText}`;
  }
  
  return `📅 Move to next available date\n💫 ${deferralsText}`;
}


  getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
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

  // ... existing validation logic ...

  const today = new Date().toISOString().split('T')[0];
  
  this.disciplineService.smartDeferTask(habit.habitId, today, 'Moved by user')
    .subscribe({
      next: (response) => {
        if (response.success) {
          const newDate = new Date(response.newDueDate!).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
          });
          
          const message = `✅ ${response.message}\nDeferrals used: ${response.deferralsUsed}/${response.deferralsUsed! + response.remainingDeferrals!}`;
          this.showDeferralMessage(message, 'success');
          
          // OPTIMISTIC UPDATE: Remove task from today's list
          if (this.todayData && this.todayData.allHabits) {
            const taskIndex = this.todayData.allHabits.findIndex(h => h.habitId === habit.habitId);
            if (taskIndex > -1) {
              this.todayData.allHabits.splice(taskIndex, 1);
              this.updateTaskCounts(); // Update counters
            }
          }
          
          // NO RELOAD - UI already updated optimistically
        } else {
          this.showDeferralMessage(response.message, 'warning');
        }
      },
      error: (error) => {
        console.error('Smart defer error:', error);
        this.showDeferralMessage('Failed to move task. Please try again.', 'error');
      }
    });
}

private updateTaskCounts(): void {
  if (!this.todayData || !this.todayData.allHabits) return;
  
  // Update today's task counts
  this.todayData.totalHabits = this.todayData.allHabits.length;
  this.todayData.completedHabits = this.todayData.allHabits.filter(h => h.isCompleted).length;
  this.todayData.requiredHabitsCount = this.todayData.allHabits.filter(h => h.isRequired).length;
  this.todayData.completedRequiredCount = this.todayData.allHabits.filter(h => h.isRequired && h.isCompleted).length;
  
  // Update completion status
  this.todayData.isCompleted = this.todayData.completedRequiredCount === this.todayData.requiredHabitsCount && this.todayData.requiredHabitsCount > 0;
  this.todayData.isPartiallyCompleted = this.todayData.completedHabits > 0 && !this.todayData.isCompleted;
  
  console.log('✅ Task counts updated without reload');
}

private showDeferralMessage(message: string, type: 'success' | 'warning' | 'error' | 'info'): void {
  // Create a toast notification or alert
  const alertClass = {
    'success': 'alert-success',
    'warning': 'alert-warning', 
    'error': 'alert-danger',
    'info': 'alert-info'
  }[type];

  // Simple alert for now - you can replace with a toast library
  alert(message);
  
  // Or if you want to show it in the UI temporarily:
  /*
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert ${alertClass} fixed-alert`;
  alertDiv.textContent = message;
  alertDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 4000);
  */
}


toggleRegularHabit(habit: ScheduledHabit): void {
  if (habit.isLocked) {
    console.log('Habit is locked, cannot toggle');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  
  // OPTIMISTIC UPDATE: Update UI immediately
  const wasCompleted = habit.isCompleted;
  habit.isCompleted = !habit.isCompleted;
  
  // Play sound effect immediately
  if (habit.isCompleted) {
    this.soundService.playTaskCompleted();
  }
  
  this.disciplineService.completeHabit({
    habitId: habit.habitId,
    date: today,
    isCompleted: habit.isCompleted,
    adHocId: habit.adHocId
  }).subscribe({
    next: (response) => {
      console.log('Habit completion toggled:', response);
      // NO RELOAD - UI already updated optimistically
      this.updateTaskCounts(); // Just update counters
    },
    error: (error) => {
      console.error('Error toggling habit:', error);
      // ROLLBACK: Revert the optimistic update on error
      habit.isCompleted = wasCompleted;
      alert('Failed to update habit. Please try again.');
    }
  });
}

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

  async toggleTask(habit: any): Promise<void> {
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

    // If habit has sub-habits and we're trying to complete it, check if all sub-habits are done
// If habit has sub-habits and we're trying to complete it, auto-complete all sub-habits
    const habitWithSubHabits = this.habitsWithSubHabits.find(h => h.habitId === habit.habitId);

    if (habitWithSubHabits && habitWithSubHabits.hasSubHabits && !habit.isCompleted) {
      if (!habitWithSubHabits.allSubHabitsCompleted) {
        // Auto-complete all sub-habits instead of showing warning
        await this.quickCompleteAllSubHabits(habit.habitId);
        return;
      }
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

  // OPTIMISTIC UPDATE: Update UI immediately
  const wasCompleted = habit.isCompleted;
  habit.isCompleted = !habit.isCompleted;
  
  if (habit.isCompleted) {
    this.soundService.playTaskCompleted();
  }

  this.disciplineService.completeAdHocTask({
    taskId: habit.adHocId,
    isCompleted: habit.isCompleted,
    notes: ''
  }).subscribe({
    next: (response) => {
      console.log('Ad-hoc task toggled successfully:', response);
      // NO RELOAD - UI already updated optimistically
      this.updateTaskCounts(); // Just update counters
    },
    error: (error) => {
      console.error('Error toggling ad-hoc task:', error);
      // ROLLBACK: Revert the optimistic update on error
      habit.isCompleted = wasCompleted;
      this.errorMessage = 'Failed to update task. Please try again.';
    }
  });
}

// Method to check if Advanced Complete button should show
canShowAdvancedComplete(habitProgress: any): boolean {
  // Rule 1: Must have remaining tasks this week
  if (habitProgress.completed >= habitProgress.total) {
    return false;
  }

  // Rule 2: Cannot be a daily task (like Phone Lock Box)
  if (this.isDailyTask(habitProgress.habitName)) {
    return false;
  }

  // Rule 3: Cannot be already scheduled for today
  if (this.isTaskScheduledToday(habitProgress.habitName)) {
    return false;
  }

  return true;
}

// Helper method to identify daily tasks
private isDailyTask(habitName: string): boolean {
  const dailyTasks = ['Phone Lock Box']; // Add other daily tasks as needed
  return dailyTasks.includes(habitName);
}

// Helper method to check if task is scheduled for today
private isTaskScheduledToday(habitName: string): boolean {
  if (!this.todayData || !this.todayData.allHabits) {
    return false;
  }

  return this.todayData.allHabits.some(habit => 
    habit.name === habitName && !habit.isAdHoc
  );
}

// Method to handle advanced completion
advancedCompleteTask(habitProgress: any): void {
  const habitId = this.getHabitIdFromName(habitProgress.habitName);
  
  if (!habitId) {
    console.error('Could not find habitId for:', habitProgress.habitName);
    this.errorMessage = 'Could not complete task. Please try again.';
    return;
  }

  const confirmMessage = `Complete "${habitProgress.habitName}" now? This will count toward your weekly goal.`;
  
  if (!confirm(confirmMessage)) {
    return;
  }

  this.isAdvancedCompleting = habitId;

  this.disciplineService.advancedCompleteHabit(habitId).subscribe({
    next: (response) => {
      console.log('✅ Advanced completion successful:', response);
      
      // Play success sound
      this.soundService.playTaskCompleted();
      
      // Show success message  
      this.successMessage = response.message;
      
      // ✅ SIMPLE FIX: Just reload the current week data normally
      this.loadCurrentWeekDataAsPromise().then(() => {
        console.log('📊 Week data reloaded after advanced completion');
      });
      
      // Clear loading state
      this.isAdvancedCompleting = null;
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        this.successMessage = null;
      }, 3000);
    },
    error: (error) => {
      console.error('❌ Advanced completion failed:', error);
      
      const errorMsg = error.error?.message || error.error || 'Failed to complete task. Please try again.';
      this.errorMessage = errorMsg;
      this.isAdvancedCompleting = null;
      
      setTimeout(() => {
        this.errorMessage = '';
      }, 5000);
    }
  });
}

// Helper method to get habitId from habit name
getHabitIdFromName(habitName: string): number | null {
  // First try to find it in today's data
  if (this.todayData && this.todayData.allHabits) {
    const habit = this.todayData.allHabits.find(h => h.name === habitName);
    if (habit && habit.habitId) {
      return habit.habitId;
    }
  }

  // Then try to find it in the week's data
  if (this.currentWeekDays) {
    for (const day of this.currentWeekDays) {
      if (day.allHabits) {
        const habit = day.allHabits.find(h => h.name === habitName);
        if (habit && habit.habitId) {
          return habit.habitId;
        }
      }
    }
  }

  // Fallback to stored mapping (for reliability)
  const habitMapping: { [key: string]: number } = {
    'Phone Lock Box': 1,
    'Clean Eating': 2,
    'Brushing Teeth': 3,
    'Clean Dishes': 4,
    'Clean Balcony': 5,
    'Regular Recyling': 6,
    'Gym Workout': 7,
    'Clean Windows': 8,
    'Vacuum/Sweep Floors': 9,
    'RetuRO Recycling': 10,
    'Tidy Up The Wardrobe': 11,
    'Plants Watering': 12,
    'Clean Bathroom': 13
  };

  const habitId = habitMapping[habitName];
  
  if (!habitId) {
    console.warn('Could not find habitId for habit:', habitName);
    console.log('Available habits in today data:', 
      this.todayData?.allHabits?.map(h => ({ name: h.name, id: h.habitId }))
    );
  }

  return habitId || null;
}

getHabitIdFromNameForTemplate(habitName: string): number | null {
  return this.getHabitIdFromName(habitName);
}

getTaskDuration(habit: any): string | null {
  // Check if task has estimated duration
  const durationMinutes = habit.estimatedDurationMinutes || habit.durationMinutes;
  
  if (!durationMinutes || durationMinutes === 0) {
    return null; // Don't show duration chip if no duration
  }
  
  // Format duration based on length
  if (durationMinutes < 60) {
    return `${durationMinutes}m`; // "30m", "45m"
  } else if (durationMinutes < 1440) { // Less than 24 hours
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (minutes === 0) {
      return `${hours}h`; // "2h", "3h"
    } else {
      return `${hours}h ${minutes}m`; // "2h 30m"
    }
  } else {
    // More than 24 hours - show days
    const days = Math.floor(durationMinutes / 1440);
    const remainingHours = Math.floor((durationMinutes % 1440) / 60);
    
    if (remainingHours === 0) {
      return `${days}d`; // "2d"
    } else {
      return `${days}d ${remainingHours}h`; // "2d 5h"
    }
  }
}

// Enhanced method to get total time for completed tasks today
getTodayCompletedTime(): string {
  if (!this.todayData?.allHabits) return '0m';
  
  const totalMinutes = this.todayData.allHabits.reduce((total, habit) => {
    if (habit.isCompleted) {
      const duration = habit.estimatedDurationMinutes || habit.estimatedDurationMinutes || 30;
      return total + duration;
    }
    return total;
  }, 0);
  
  return this.formatDuration(totalMinutes);
}

// Helper method to format duration consistently
private formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  }
}

getWeekTotalHours(): number {
  if (!this.currentWeekDays) return 0;
  
  return this.currentWeekDays.reduce((total, day) => {
    const dayMinutes = day.allHabits?.reduce((dayTotal, habit) => {
      // Now uses the real estimatedDurationMinutes from the API
      return dayTotal + (habit.estimatedDurationMinutes || 30);
    }, 0) || 0;
    return total + dayMinutes;
  }, 0) / 60; // Convert minutes to hours
}

// Calculate completed hours for the week
getWeekCompletedHours(): number {
  if (!this.currentWeekDays) return 0;
  
  return this.currentWeekDays.reduce((total, day) => {
    const dayMinutes = day.allHabits?.reduce((dayTotal, habit) => {
      if (habit.isCompleted) {
        // Now uses the real estimatedDurationMinutes from the API
        return dayTotal + (habit.estimatedDurationMinutes || 30);
      }
      return dayTotal;
    }, 0) || 0;
    return total + dayMinutes;
  }, 0) / 60; // Convert minutes to hours
}

// Calculate today's total hours
getTodayTotalHours(): number {
  if (!this.todayData?.allHabits) return 0;
  
  return this.todayData.allHabits.reduce((total, habit) => {
    // Now uses the real estimatedDurationMinutes from the API
    return total + (habit.estimatedDurationMinutes || 30);
  }, 0) / 60; // Convert minutes to hours
}

// Calculate today's completed hours  
getTodayCompletedHours(): number {
  if (!this.todayData?.allHabits) return 0;
  
  return this.todayData.allHabits.reduce((total, habit) => {
    if (habit.isCompleted) {
      // Now uses the real estimatedDurationMinutes from the API
      return total + (habit.estimatedDurationMinutes || 30);
    }
    return total;
  }, 0) / 60; // Convert minutes to hours
}

// Format hours for display (e.g., "2.5h" or "45m")
formatHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  
  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }
  return `${minutes}m`;
}

// Get time completion percentage
getTimeCompletionPercentage(): number {
  const total = this.getWeekTotalHours();
  const completed = this.getWeekCompletedHours();
  
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
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

  this.disciplineService.addAdHocTask({
    name: this.newTaskName.trim(),
    description: this.newTaskDescription.trim(),
    date: new Date().toISOString().split('T')[0],
    deadlineDate: this.hasDeadline && this.deadlineDate ? 
      this.deadlineDate : undefined,  
    deadlineTime: "23:59",
    estimatedDurationMinutes: this.newTaskEstimatedDuration || 30 // Use provided duration or default to 30
  }).subscribe({
    next: (response) => {
      console.log('Ad-hoc task added successfully:', response);
      
      // ✅ SOLUTION: Use the complete dayData from backend OR reload the day
      if (response && response.dayData) {
        // Use the complete updated day data from backend
        this.todayData = response.dayData;
        this.habitsWithSubHabits = response.dayData.allHabits || [];
        this.updateTaskCounts();
        console.log('✅ Used complete dayData from backend API response');
      } else if (response && response.task) {
        // Fallback: manually create task with ALL required properties from backend structure
        const newTask: HabitWithSubHabits = {
          // Core properties (matching ScheduledHabit interface)
          habitId: 0, // Keep as 0 for ad-hoc tasks  
          name: response.task.name,
          description: response.task.description,
          isCompleted: response.task.isCompleted || false,
          isRequired: true, // ✅ Default ad-hoc tasks to required (shows today)
          isLocked: false,
          hasDeadline: true, // ✅ Always true now (auto-set to today)
          deadlineTime: "23:59",
          timeRemaining: this.calculateTimeRemainingForToday(), // ✅ Calculate remaining time
          isOverdue: false,
          urgencyLevel: 'Normal',
          
          // ✅ Meta properties for tags
          reason: "Ad-hoc task",
          priority: "Required", // ✅ Shows as Required, not Optional
          frequency: "Daily",   // ✅ Shows Daily frequency chip
          
          // ✅ Deadline properties
          deadlineDate: this.hasDeadline && this.deadlineDate ? 
            this.deadlineDate : 
            new Date().toISOString().split('T')[0], // Today's date
          
          // Flexibility properties (set to defaults for ad-hoc)
          deferralsUsed: 0,
          maxDeferrals: 0,
          canStillBeDeferred: false,
          originalScheduledDate: undefined,
          currentDueDate: undefined,
          flexibilityStatus: undefined,
          
          // Ad-hoc specific properties
          isAdHoc: true,
          adHocId: response.task.id || response.task.adHocId,
          
          // Sub-habits properties (defaults for ad-hoc tasks)
          hasSubHabits: false,
          subHabits: [],
          totalSubHabitsCount: 0,
          completedSubHabitsCount: 0,
          allSubHabitsCompleted: false,
          isExpanded: false
        };
        
        // Add to both arrays to keep them synchronized
        if (this.todayData && this.todayData.allHabits) {
          this.todayData.allHabits = [...this.todayData.allHabits, newTask as ScheduledHabit];
        }
        this.habitsWithSubHabits = [...this.habitsWithSubHabits, newTask];
        this.updateTaskCounts();
        
        console.log('✅ Successfully added ad-hoc task with all properties');
        console.log('📊 Task properties:', {
          priority: newTask.priority,
          frequency: newTask.frequency,
          timeRemaining: newTask.timeRemaining,
          hasDeadline: newTask.hasDeadline,
          deadlineDate: newTask.deadlineDate
        });
      } else {
        // Last resort: reload the entire day data
        console.log('⚠️ No complete data in response, reloading day');
        this.loadCurrentWeekData();
      }
      
      // Close modal and reset form
      this.showAddTaskDialog = false;
      this.newTaskName = '';
      this.newTaskDescription = '';
      this.errorMessage = '';
      this.hasDeadline = false;
      this.deadlineDate = '';
    },
    error: (error) => {
      console.error('Error adding ad-hoc task:', error);
      this.errorMessage = 'Failed to add task. Please try again.';
    }
  });
}

private calculateTimeRemainingForToday(): string {
  const now = new Date();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  const timeDiff = endOfDay.getTime() - now.getTime();
  
  if (timeDiff <= 0) {
    return "0m"; // Past deadline
  }
  
  const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hoursLeft > 0) {
    if (hoursLeft < 6 && minutesLeft > 0) {
      return `${hoursLeft}h ${minutesLeft}m`;
    } else {
      return `${hoursLeft}h`;
    }
  } else {
    return `${minutesLeft}m`;
  }
}

saveEditedTask(): void {
  if (!this.editingTask || !this.editTaskName.trim()) {
    this.errorMessage = 'Task name is required';
    return;
  }

  // Store the original values for rollback
  const originalName = this.editingTask.name;
  const originalDescription = this.editingTask.description;

  // OPTIMISTIC UPDATE: Update the UI immediately
  this.editingTask.name = this.editTaskName.trim();
  this.editingTask.description = this.editTaskDescription.trim();
  this.editingTask.estimatedDurationMinutes = this.editTaskEstimatedDuration !== null ? this.editTaskEstimatedDuration : undefined;

  this.disciplineService.editAdHocTask({
    adHocId: this.editingTask.adHocId!,
    name: this.editTaskName.trim(),
    description: this.editTaskDescription.trim(),
    estimatedDurationMinutes: this.editingTask.estimatedDurationMinutes
  }).subscribe({
    next: (response) => {
      console.log('✅ Ad-hoc task edited successfully:', response);
      
      // Close the dialog
      this.showEditTaskDialog = false;
      this.editingTask = null;
      this.editTaskName = '';
      this.editTaskDescription = '';
      this.errorMessage = '';
      
      // ✅ NO REFRESH! The UI is already updated optimistically
      console.log('🚀 Task edited without page refresh');
    },
    error: (error) => {
      console.error('❌ Error editing ad-hoc task:', error);
      
      // ROLLBACK: Revert the optimistic update on error
      if (this.editingTask) {
        this.editingTask.name = originalName;
        this.editingTask.description = originalDescription;
      }
      
      this.errorMessage = 'Failed to update task. Please try again.';
    }
  });
}

  cancelAddTask(): void {
    this.showAddTaskDialog = false;
    this.newTaskName = '';
    this.newTaskDescription = '';
    this.hasDeadline = false;
    this.deadlineDate = '';
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

getUrgencyLevel(timeRemaining: string | null): string {
  if (!timeRemaining) return 'normal';
  
  // Extract days, hours, and minutes from timeRemaining string
  const daysMatch = timeRemaining.match(/(\d+)d/);
  const hoursMatch = timeRemaining.match(/(\d+)h/);
  const minutesMatch = timeRemaining.match(/(\d+)m/);
  
  const totalMinutes = 
    (daysMatch ? parseInt(daysMatch[1]) * 24 * 60 : 0) +
    (hoursMatch ? parseInt(hoursMatch[1]) * 60 : 0) + 
    (minutesMatch ? parseInt(minutesMatch[1]) : 0);
  
  // ✅ NEW: Updated thresholds for multi-day tasks
  if (totalMinutes <= 30) return 'critical';          // Less than 30 minutes
  if (totalMinutes <= 120) return 'urgent';           // Less than 2 hours
  if (totalMinutes <= 1440) return 'moderate';        // Less than 1 day
  return 'normal';                                     // More than 1 day
}

private isHabitOverdue(habit: any): boolean {
  if (!habit.hasDeadline || !habit.deadlineTime || habit.isCompleted) {
    return false;
  }

  // ✅ Trust backend timeRemaining calculation
  // If backend sent timeRemaining = null and task has deadline, it's overdue
  if (habit.timeRemaining === null || habit.timeRemaining === undefined) {
    return true;
  }

  // If backend calculated timeRemaining, it's not overdue
  return false;
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

// In calendar.component.ts - Fix the date comparison methods to match Romania timezone:

isToday(date: Date | string): boolean {
  const today = new Date();
  
  // ✅ FIX: Handle date string parsing consistently 
  const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  // ✅ FIX: Use date-only comparison (ignore time)
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateObjDateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  return todayDateOnly.getTime() === dateObjDateOnly.getTime();
}

isFuture(date: Date | string): boolean {
  const today = new Date();
  
  // ✅ FIX: Handle date string parsing consistently
  const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  // ✅ FIX: Use date-only comparison (ignore time)
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateObjDateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  return dateObjDateOnly.getTime() > todayDateOnly.getTime();
}

// ✅ ADD: Helper method for past days if needed
isPast(date: Date | string): boolean {
  const today = new Date();
  
  const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateObjDateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  return dateObjDateOnly.getTime() < todayDateOnly.getTime();
}
  isAnyToday(): boolean {
    if (!this.currentWeekDays) return false;
    return this.currentWeekDays.some(day => this.isToday(day.date));
  }

getCompletionIcon(day: DayData): string {
  if (day.isCompleted) return '✅'; // Always show check for completed days

  if (this.isFuture(day.date)) {
    return '⚫'; // Solid dark circle for "not yet started"
  }

  if (this.isToday(day.date)) {
    // ✅ FIX: For today, always show diamond if there are tasks
    const totalTasks = this.getTotalTasksCount(day);
    if (totalTasks > 0) {
      return '◆'; // Orange diamond for today with tasks
    } else {
      return '○'; // Circle for today with no tasks
    }
  }
  
  // If none of the above, it's a past day that wasn't completed
  return '❌'; // Failed
}
calculateWeekProgress(): number {
  if (!this.currentWeekDays) return 0;
  
  let totalRequiredTasksCompleted = 0;
  let totalRequiredTasksForEntireWeek = 0;
  
  this.currentWeekDays.forEach(day => {
    if (day.allHabits) {
      // ✅ Only count REQUIRED tasks for progress calculation
      const requiredTasks = day.allHabits.filter(habit => 
        habit.priority === 'Required' || habit.isRequired === true
      );
      
      totalRequiredTasksForEntireWeek += requiredTasks.length;
      
      // Only count completed tasks from past and current days
      if (!day.isFuture) {
        const completedRequiredTasks = requiredTasks.filter(habit => habit.isCompleted);
        totalRequiredTasksCompleted += completedRequiredTasks.length;
      }
    }
  });
  
  return totalRequiredTasksForEntireWeek > 0 
    ? Math.round((totalRequiredTasksCompleted / totalRequiredTasksForEntireWeek) * 100)
    : 0;
}

calculateWeeklyHabitProgress(): {habitName: string, completed: number, total: number, percentage: number, isAchievable: boolean}[] {
  if (!this.currentWeekDays || this.currentWeekDays.length === 0) return [];
  
  const habitStats = new Map<string, {completed: number, total: number}>();
  
  this.currentWeekDays.forEach(day => {
    if (day.allHabits) {
      day.allHabits.forEach(habit => {
        // ✅ Skip ad-hoc tasks AND optional tasks
        if (habit.isAdHoc || habit.priority === 'Optional') {
          return; 
        }
        
        const habitName = habit.name;
        if (!habitStats.has(habitName)) {
          habitStats.set(habitName, {completed: 0, total: 0});
        }
        const stats = habitStats.get(habitName)!;
        stats.total += 1;
        if (habit.isCompleted) {
          stats.completed += 1;
        }
      });
    }
  });

  // Calculate days remaining in the week (today + future days)
  const daysRemaining = this.currentWeekDays.filter(d => this.isToday(d.date) || this.isFuture(d.date)).length;

  // Convert to array, calculate percentages, and determine achievability
  return Array.from(habitStats.entries()).map(([habitName, stats]) => {
    const remainingTasks = stats.total - stats.completed;
    const isAchievable = remainingTasks <= daysRemaining;

    return {
      habitName,
      completed: stats.completed,
      total: stats.total,
      percentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      isAchievable: isAchievable
    };
  });
}


private getDayCompletionStatus(day: DayData): {isCompleted: boolean, isPartiallyCompleted: boolean} {
  if (!day.allHabits || day.allHabits.length === 0) {
    return { isCompleted: true, isPartiallyCompleted: false }; // No tasks = completed
  }
  
  // ✅ Only consider required tasks for day completion
  const requiredTasks = day.allHabits.filter(habit => 
    habit.priority === 'Required' || habit.isRequired === true
  );
  
  if (requiredTasks.length === 0) {
    return { isCompleted: true, isPartiallyCompleted: false }; // No required tasks = completed
  }
  
  const completedRequiredTasks = requiredTasks.filter(habit => habit.isCompleted);
  const isCompleted = completedRequiredTasks.length === requiredTasks.length;
  const isPartiallyCompleted = completedRequiredTasks.length > 0 && !isCompleted;
  
  return { isCompleted, isPartiallyCompleted };
}

// ✅ Add helper methods for task counts (for display purposes)
getRequiredTasksCount(day: DayData): number {
  if (!day.allHabits) return 0;
  return day.allHabits.filter(habit => 
    habit.priority === 'Required' || habit.isRequired === true
  ).length;
}


getCompletedRequiredTasksCount(day: DayData): number {
  if (!day.allHabits) return 0;
  return day.allHabits.filter(habit => 
    (habit.priority === 'Required' || habit.isRequired === true) && habit.isCompleted
  ).length;
}

getTotalTasksCount(day: DayData): number {
  if (!day.allHabits) return 0;
  return day.allHabits.length;
}

getCompletedTotalTasksCount(day: DayData): number {
  if (!day.allHabits) return 0;
  return day.allHabits.filter(habit => habit.isCompleted).length;
}

private calculateTimeRemaining(habit: any): string | null {
  if (!habit.hasDeadline || !habit.deadlineTime || habit.isCompleted) {
    return null;
  }

  const now = new Date();
  
  // For adhoc tasks with future deadline dates
  if (habit.deadlineDate) {
    const deadlineDate = new Date(habit.deadlineDate);
    const [hours, minutes] = habit.deadlineTime.split(':').map(Number);
    deadlineDate.setHours(hours, minutes, 0, 0);
    
    const timeDiff = deadlineDate.getTime() - now.getTime();
    
    // If deadline has passed, it's overdue
    if (timeDiff <= 0) {
      return null; // Will show as overdue
    }
    
    // Calculate time remaining
    const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    // ✅ NEW: Show different formats based on time remaining
    if (daysLeft > 1) {
      // More than 1 day: show "X days, Y hours"
      if (hoursLeft > 0) {
        return `${daysLeft}d ${hoursLeft}h`;
      } else {
        return `${daysLeft}d`;
      }
    } else if (daysLeft === 1) {
      // Tomorrow: show "1 day, X hours" or just "1 day" if evening
      if (hoursLeft > 0) {
        return `1d ${hoursLeft}h`;
      } else {
        return `1d`;
      }
    } else if (hoursLeft > 0) {
      // Same day, more than 1 hour: show "X hours, Y minutes"
      if (minutesLeft > 0 && hoursLeft < 6) {
        return `${hoursLeft}h ${minutesLeft}m`;
      } else {
        return `${hoursLeft}h`;
      }
    } else {
      // Less than 1 hour: show minutes only
      return `${minutesLeft}m`;
    }
  }
  
  // For regular habits with same-day deadlines (existing logic)
  const [hours, minutes] = habit.deadlineTime.split(':').map(Number);
  const deadline = new Date();
  deadline.setHours(hours, minutes, 0, 0);
  
  // If deadline has passed today, it's overdue
  if (now > deadline) {
    return null; // Will show as overdue
  }
  
  // Calculate time remaining for same-day deadline
  const timeDiff = deadline.getTime() - now.getTime();
  const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hoursLeft > 0) {
    if (minutesLeft > 0 && hoursLeft < 6) {
      return `${hoursLeft}h ${minutesLeft}m`;
    } else {
      return `${hoursLeft}h`;
    }
  } else {
    return `${minutesLeft}m`;
  }
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

editAdHocTask(task: ScheduledHabit): void {
  // Prevent editing completed ad-hoc tasks
  if (task.isCompleted) {
    console.log('Cannot edit completed ad-hoc tasks');
    return;
  }

  // Proceed with original edit logic
  this.editingTask = task;
  this.editTaskName = task.name;
  this.editTaskDescription = task.description || '';
  this.showEditTaskDialog = true;
  this.errorMessage = '';
  this.editTaskEstimatedDuration = task.estimatedDurationMinutes || null; // ✅ ADD THIS LINE

}

// Alternative version with more detailed information
getMoveButtonTooltipDetailed(habit: ScheduledHabit): string {
  if (this.isDailyHabit(habit)) {
    return '🚫 Daily habits cannot be moved - required every day';
  }

  const flexInfo = this.getFlexibilityInfo(habit);
  if (!flexInfo) return '❌ This task cannot be moved';
  
  if (flexInfo.remainingDeferrals === 0) {
    return '⚠️ No deferrals remaining - must complete today\n🔒 Task is locked to this date';
  }
  
  // Show both used and remaining
  const usedDeferrals = flexInfo.maxDeferrals - flexInfo.remainingDeferrals;
  const statusText = flexInfo.remainingDeferrals === 1 
    ? `Last deferral available (${usedDeferrals}/${flexInfo.maxDeferrals} used)` 
    : `${flexInfo.remainingDeferrals}/${flexInfo.maxDeferrals} deferrals remaining`;
  
  if (habit.frequency?.toLowerCase().includes('weekly')) {
    return `📅 Move to next available day this week\n💫 ${statusText}`;
  }
  
  return `📅 Move to next available date\n💫 ${statusText}`;
}
}


