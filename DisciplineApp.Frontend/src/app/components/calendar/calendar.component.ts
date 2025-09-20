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
import { LoadingService } from '../../services/loading.service';
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

  constructor(
    private disciplineService: DisciplineService,
    private soundService: SoundService,
    private loadingService: LoadingService,
    private subHabitsService: SubHabitsService
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
      this.loadCurrentWeekDataAsPromise(),
      this.loadFlexibleTasksAsPromise()
    ]);
  } finally {
    // Hide loading after everything is loaded
    setTimeout(() => this.loadingService.hide(), 200);
  }
}

 private async loadCurrentWeekDataAsPromise(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loading = true;
      this.error = null;

      console.log('🔍 Loading current week data...');

      this.disciplineService.getCurrentWeek().subscribe({
        next: async (weekData) => {
          console.log('✅ Week data received:', weekData);
          
          this.weekData = weekData;
          this.currentWeekDays = weekData.days;
          
          // Find today's data
          const today = new Date();
          this.todayData = weekData.days.find(day => 
            new Date(day.date).toDateString() === today.toDateString()
          ) || null;

          if (this.todayData && this.todayData.allHabits) {
            // Load sub-habits for today's tasks
            await this.loadSubHabitsForHabits(this.todayData.allHabits);

            this.todayData.allHabits.forEach(habit => {
              if (habit.hasDeadline) {
                habit.timeRemaining = this.calculateTimeRemaining(habit) || undefined;
                habit.isOverdue = this.isHabitOverdue(habit);
              }
            });
          }

          // Calculate "MUST DO" status (your existing logic)
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
          }

          console.log('📅 Today\'s data (with sub-habits):', this.todayData);
          this.loading = false;
          resolve();
        },
        error: (error) => {
          console.error('❌ Error loading week data:', error);
          this.error = 'Failed to load calendar data';
          this.loading = false;
          reject(error);
        }
      });

      // Load weekly progress in parallel
      this.disciplineService.getWeeklyProgress().subscribe({
        next: (progress) => {
          console.log('📈 Weekly progress loaded:', progress);
          this.weeklyProgress = progress;
        },
        error: (error) => {
          console.error('❌ Error loading weekly progress:', error);
        }
      });
    });
  }
private async loadSubHabitsForHabits(habits: any[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    this.habitsWithSubHabits = await Promise.all(
      habits.map(async (habit) => {
        const habitWithSubHabits: HabitWithSubHabits = {
          ...habit,
          subHabits: [],
          hasSubHabits: false,
          allSubHabitsCompleted: false,
          completedSubHabitsCount: 0,
          totalSubHabitsCount: 0,
          isExpanded: false
        };

        try {
          // Only load sub-habits for non-ad-hoc tasks
          if (!habit.isAdHoc && habit.habitId) {
            const response = await this.subHabitsService.getSubHabitsWithCompletions(habit.habitId, today).toPromise();
            
            if (response && response.subHabits && response.subHabits.length > 0) {
              habitWithSubHabits.subHabits = response.subHabits;
              habitWithSubHabits.hasSubHabits = true;
              habitWithSubHabits.totalSubHabitsCount = response.subHabits.length;
              habitWithSubHabits.completedSubHabitsCount = response.subHabits.filter(sh => sh.isCompleted).length;
              habitWithSubHabits.allSubHabitsCompleted = habitWithSubHabits.completedSubHabitsCount === habitWithSubHabits.totalSubHabitsCount;
            }
          }
        } catch (error) {
          console.error(`Error loading sub-habits for habit ${habit.habitId}:`, error);
        }

        return habitWithSubHabits;
      })
    );

    // Update todayData.allHabits with the enriched habits
    if (this.todayData) {
      this.todayData.allHabits = this.habitsWithSubHabits;
    }
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
    const today = new Date().toISOString().split('T')[0];
    
    const request: CompleteSubHabitRequest = {
      date: today,
      isCompleted: isCompleted,
      notes: ''
    };

    try {
      const response = await this.subHabitsService.completeSubHabit(subHabitId, request).toPromise();
      
      if (response) {
        // Update the sub-habit in the local state
        const habit = this.habitsWithSubHabits.find(h => 
          h.subHabits?.some(sh => sh.id === subHabitId)
        );
        
        if (habit && habit.subHabits) {
          const subHabit = habit.subHabits.find(sh => sh.id === subHabitId);
          if (subHabit) {
            subHabit.isCompleted = isCompleted;
            subHabit.completedAt = response.completedAt;
            
            // Update completion counts
            habit.completedSubHabitsCount = habit.subHabits.filter(sh => sh.isCompleted).length;
            habit.allSubHabitsCompleted = habit.completedSubHabitsCount === habit.totalSubHabitsCount;
            
            // If parent habit was completed, update main habit status
            if (response.parentHabitCompleted) {
              habit.isCompleted = true;
              await this.refreshWeekData(); // Refresh to get updated stats
            }
          }
        }

        // Play completion sound
        if (isCompleted) {
          this.soundService.playTaskCompleted();
        }
      }
    } catch (error) {
      console.error('Error toggling sub-habit completion:', error);
      // Could show error toast here
    }
  }

async quickCompleteAllSubHabits(habitId: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const request: CompleteAllSubHabitsRequest = {
      date: today
    };

    try {
      const response = await this.subHabitsService.completeAllSubHabits(habitId, request).toPromise();
      
      if (response) {
        // Update all sub-habits for this habit
        const habit = this.habitsWithSubHabits.find(h => h.habitId === habitId);
        if (habit && habit.subHabits) {
          habit.subHabits.forEach(subHabit => {
            subHabit.isCompleted = true;
            subHabit.completedAt = new Date().toISOString();
          });
          
          // Update completion counts
          habit.completedSubHabitsCount = habit.totalSubHabitsCount;
          habit.allSubHabitsCompleted = true;
          habit.isCompleted = true;
          
          // Refresh week data to get updated stats
          await this.refreshWeekData();
        }

        // Play completion sound
        this.soundService.playTaskCompleted();
        
        console.log(`All sub-habits completed for habit ${habitId}`);
      }
    } catch (error) {
      console.error('Error quick-completing all sub-habits:', error);
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

  // Prevent moving daily habits
  if (this.isDailyHabit(habit)) {
    this.showDeferralMessage('Daily habits cannot be moved - they are required every day.', 'error');
    return;
  }

  // Check if can actually move
  if (!this.canActuallyMoveHabit(habit)) {
    const flexInfo = this.getFlexibilityInfo(habit);
    const message = flexInfo ? 
      'No more deferrals available - must complete today' : 
      'This task cannot be moved';
    this.showDeferralMessage(message, 'error');
    return;
  }

  // Show loading state
this.showDeferralMessage('Finding next available date...', 'info');

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
          
          // FIX: Use promise methods instead of old method
          Promise.all([
            this.loadCurrentWeekDataAsPromise(),
            this.loadFlexibleTasksAsPromise()
          ]).catch(error => {
            console.error('Error reloading data:', error);
          });
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
      
      // FIX: Use promise methods instead of old methods
      Promise.all([
        this.loadCurrentWeekDataAsPromise(),
        this.loadFlexibleTasksAsPromise()
      ]).catch(error => {
        console.error('Error reloading data:', error);
      });
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
toggleTask(habit: any): void {
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
    const habitWithSubHabits = this.habitsWithSubHabits.find(h => h.habitId === habit.habitId);
    
    if (habitWithSubHabits && habitWithSubHabits.hasSubHabits && !habit.isCompleted) {
      if (!habitWithSubHabits.allSubHabitsCompleted) {
        // Show warning that not all sub-habits are completed
        alert('Please complete all sub-habits first, or use the "Complete All" button.');
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

  this.disciplineService.completeAdHocTask({
    taskId: habit.adHocId,
    isCompleted: !habit.isCompleted,
    notes: ''
  }).subscribe({
    next: (response) => {
      console.log('Ad-hoc task toggled successfully:', response);
      
      habit.isCompleted = !habit.isCompleted;
      
      if (habit.isCompleted) {
        this.soundService.playTaskCompleted();
      }
      
      // FIX: Use promise method instead of old method
      this.loadCurrentWeekDataAsPromise().catch(error => {
        console.error('Error reloading data:', error);
      });
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
    date: today,
    deadlineDate: this.hasDeadline ? this.deadlineDate : undefined,  
    deadlineTime: "23:59"
  }).subscribe({
    next: (response) => {
      console.log('Ad-hoc task added successfully:', response);
      this.showAddTaskDialog = false;
      this.newTaskName = '';
      this.newTaskDescription = '';
      this.errorMessage = '';
      
      // FIX: Use promise method instead of old method
      this.loadCurrentWeekDataAsPromise().catch(error => {
        console.error('Error reloading data:', error);
      });
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
      
      // FIX: Use promise method instead of old method
      this.loadCurrentWeekDataAsPromise().catch(error => {
        console.error('Error reloading data:', error);
      });
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
  
  // Extract minutes from timeRemaining string
  const minutesMatch = timeRemaining.match(/(\d+)m/);
  const hoursMatch = timeRemaining.match(/(\d+)h/);
  
  const totalMinutes = (hoursMatch ? parseInt(hoursMatch[1]) * 60 : 0) + 
                      (minutesMatch ? parseInt(minutesMatch[1]) : 0);
  
  if (totalMinutes <= 30) return 'critical';
  if (totalMinutes <= 120) return 'urgent'; // 2 hours
  return 'normal';
}

private isHabitOverdue(habit: any): boolean {
  if (!habit.hasDeadline || !habit.deadlineTime || habit.isCompleted) {
    return false;
  }

  const now = new Date();
  
  // For adhoc tasks with future deadline dates
  if (habit.deadlineDate) {
    const deadlineDate = new Date(habit.deadlineDate);
    const [hours, minutes] = habit.deadlineTime.split(':').map(Number);
    deadlineDate.setHours(hours, minutes, 0, 0);
    
    return now > deadlineDate;
  }
  
  // For regular habits with same-day deadlines
  const [hours, minutes] = habit.deadlineTime.split(':').map(Number);
  const deadline = new Date();
  deadline.setHours(hours, minutes, 0, 0);
  
  return now > deadline;
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
    const hoursUntilDeadline = timeDiff / (1000 * 60 * 60);
    
    // If more than 24 hours until deadline, task should be optional (no time display)
    if (hoursUntilDeadline > 24) {
      return null;
    }
    
    // If deadline has passed, it's overdue
    if (timeDiff <= 0) {
      return null; // Will show as overdue
    }
    
    // Within 24 hours of deadline, show countdown
    const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
      return `${hoursLeft}h ${minutesLeft}m`;
    } else {
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
    return `${hoursLeft}h ${minutesLeft}m`;
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


