import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisciplineService } from '../../services/discipline.services';
import { SoundService } from '../../services/sound.service';

interface ScheduledHabit {
  habitId: number;
  name: string;
  description: string;
  isCompleted: boolean;
  isRequired: boolean;
  reason: string;
  priority: string;
  completedAt?: string;
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

interface WeekData {
  weekStartDate: string;
  weekEndDate: string;
  currentDay: DayData;
  weeklyHabitProgress: WeeklyProgress[];
  dayStatuses: any[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
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

  constructor(private disciplineService: DisciplineService, private soundService: SoundService) {}

  ngOnInit(): void {
    this.loadCurrentWeekData();
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

  // Habit completion method
  toggleHabit(habit: ScheduledHabit): void {
    if (!this.todayData) return;

    const newCompletionState = !habit.isCompleted;
      // Only play task completed sound when COMPLETING a task (not unchecking)
  if (newCompletionState) {
    console.log('Playing task completed sound for:', habit.name);
    this.soundService.playTaskCompleted();
  }
    // Optimistic UI update
    habit.isCompleted = newCompletionState;

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
          this.soundService.playDayCompleted();
        }
        }
        // Refresh the entire week data to update progress
        this.loadCurrentWeekData();
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
}