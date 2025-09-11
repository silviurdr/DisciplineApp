// src/app/components/habit-management/habit-management.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Habit {
  id: string;
  name: string;
  description: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Rolling' | 'Seasonal';
  frequencyDetails?: {
    daysOfWeek?: number[];
    timesPerWeek?: number;
    rollingDays?: number;
    monthlyWeek?: number;
    monthlyDay?: number;
    activeMonths?: number[];
    timesPerSeason?: number;
  };
  isActive: boolean;
  streakRewards?: StreakReward[];
}

interface StreakReward {
  streakLength: number;
  rewardType: 'Coffee' | 'Book' | 'Clothing' | 'Equipment' | 'Experience' | 'Trip';
  description: string;
}

@Component({
  selector: 'app-habit-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './habit-management.html',
  styleUrls: ['./habit-management.scss']
})
export class HabitManagementComponent implements OnInit {
  habits: Habit[] = [];
  showAddHabitForm = false;
  editingHabit: Habit | null = null;
  
  formHabit: Habit = this.createEmptyHabit();
  
  weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  constructor() {}

  ngOnInit(): void {
    this.loadHabits();
  }

  private createEmptyHabit(): Habit {
    return {
      id: '',
      name: '',
      description: '',
      frequency: 'Daily',
      frequencyDetails: {
        daysOfWeek: [],
        activeMonths: [],
        timesPerWeek: 1,
        rollingDays: 2,
        timesPerSeason: 3
      },
      isActive: true,
      streakRewards: [
        { streakLength: 7, rewardType: 'Coffee', description: 'Coffee shop visit' },
        { streakLength: 14, rewardType: 'Book', description: 'New book' }
      ]
    };
  }

  loadHabits(): void {
    const savedHabits = localStorage.getItem('discipline-habits');
    if (savedHabits) {
      this.habits = JSON.parse(savedHabits);
    } else {
      this.habits = this.getSampleHabits();
      this.saveHabits();
    }
  }

  private getSampleHabits(): Habit[] {
    return [
      {
        id: 'phone-lock',
        name: 'Phone Lock Box',
        description: 'Lock iPhone in the lock box for the day',
        frequency: 'Daily',
        isActive: true,
        streakRewards: [
          { streakLength: 7, rewardType: 'Coffee', description: 'Coffee shop visit' },
          { streakLength: 14, rewardType: 'Book', description: 'New book' },
          { streakLength: 30, rewardType: 'Clothing', description: 'New clothes' }
        ]
      },
      {
        id: 'dishes',
        name: 'Clean Dishes',
        description: 'Ensure sink is clean, no dishes left',
        frequency: 'Rolling',
        frequencyDetails: { rollingDays: 2 },
        isActive: true
      },
      {
        id: 'vacuum',
        name: 'Vacuum & Sweep',
        description: 'Vacuum and sweep all floors',
        frequency: 'Weekly',
        frequencyDetails: { 
          timesPerWeek: 2, 
          daysOfWeek: [1, 4] // Monday and Thursday
        },
        isActive: true
      },
      {
        id: 'bathroom',
        name: 'Clean Bathroom',
        description: 'Full bathroom cleaning',
        frequency: 'Weekly',
        frequencyDetails: { 
          timesPerWeek: 1, 
          daysOfWeek: [0] // Sunday
        },
        isActive: true
      }
    ];
  }

  saveHabits(): void {
    localStorage.setItem('discipline-habits', JSON.stringify(this.habits));
  }

  onFrequencyChange(): void {
    this.formHabit.frequencyDetails = {
      daysOfWeek: [],
      activeMonths: [],
      timesPerWeek: 1,
      rollingDays: 2,
      timesPerSeason: 3
    };
  }

  toggleWeekDay(dayIndex: number): void {
    if (!this.formHabit.frequencyDetails!.daysOfWeek) {
      this.formHabit.frequencyDetails!.daysOfWeek = [];
    }
    
    const days = this.formHabit.frequencyDetails!.daysOfWeek;
    const index = days.indexOf(dayIndex);
    
    if (index > -1) {
      days.splice(index, 1);
    } else {
      days.push(dayIndex);
    }
  }

  toggleMonth(monthIndex: number): void {
    if (!this.formHabit.frequencyDetails!.activeMonths) {
      this.formHabit.frequencyDetails!.activeMonths = [];
    }
    
    const months = this.formHabit.frequencyDetails!.activeMonths;
    const index = months.indexOf(monthIndex);
    
    if (index > -1) {
      months.splice(index, 1);
    } else {
      months.push(monthIndex);
    }
  }

  addReward(): void {
    if (!this.formHabit.streakRewards) {
      this.formHabit.streakRewards = [];
    }
    
    this.formHabit.streakRewards.push({
      streakLength: 30,
      rewardType: 'Book',
      description: ''
    });
  }

  removeReward(index: number): void {
    if (this.formHabit.streakRewards) {
      this.formHabit.streakRewards.splice(index, 1);
    }
  }

  saveHabit(): void {
    if (!this.formHabit.name.trim()) {
      alert('Please enter a habit name');
      return;
    }

    if (this.editingHabit) {
      const index = this.habits.findIndex(h => h.id === this.editingHabit!.id);
      if (index > -1) {
        this.habits[index] = { ...this.formHabit };
      }
    } else {
      const newHabit: Habit = {
        ...this.formHabit,
        id: this.generateHabitId()
      };
      this.habits.push(newHabit);
    }

    this.saveHabits();
    this.cancelForm();
  }

  editHabit(habit: Habit): void {
    this.editingHabit = habit;
    this.formHabit = { ...habit };
    this.showAddHabitForm = false;
  }

  cancelForm(): void {
    this.showAddHabitForm = false;
    this.editingHabit = null;
    this.formHabit = this.createEmptyHabit();
  }

  toggleHabitActive(habit: Habit): void {
    habit.isActive = !habit.isActive;
    this.saveHabits();
  }

  deleteHabit(habitId: string): void {
    if (confirm('Are you sure you want to delete this habit? This cannot be undone.')) {
      this.habits = this.habits.filter(h => h.id !== habitId);
      this.saveHabits();
    }
  }

  private generateHabitId(): string {
    return 'habit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  getDailyHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === 'Daily');
  }

  getWeeklyHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === 'Weekly');
  }

  getRollingHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === 'Rolling');
  }

  getMonthlyHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === 'Monthly');
  }

  getSeasonalHabits(): Habit[] {
    return this.habits.filter(h => h.frequency === 'Seasonal');
  }

  getWeekDaysText(dayIndices: number[]): string {
    return dayIndices.map(i => this.weekDays[i].substr(0, 3)).join(', ');
  }

  getMonthsText(monthIndices: number[]): string {
    return monthIndices.map(i => this.months[i - 1]).join(', ');
  }
}