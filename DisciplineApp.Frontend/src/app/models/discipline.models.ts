// src/app/models/discipline.models.ts - Fixed date handling for timezone issues

export interface CalendarDay {
  date: string; // Always in YYYY-MM-DD format to avoid timezone issues
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

export interface ToggleDayRequest {
  date: string; // YYYY-MM-DD format
}

export interface UpdateDayRequest {
  date: string; // YYYY-MM-DD format
  isCompleted: boolean;
  notes?: string;
}

export enum StreakColor {
  None = 'None',
  Blue = 'Blue',
  Green = 'Green',
  Orange = 'Orange',
  Red = 'Red',
  Special = 'Special'
}

// Helper class for consistent date handling in Angular
export class DateUtils {
  /**
   * Converts a Date object to YYYY-MM-DD string format
   * This eliminates timezone issues by working with local date only
   */
  static toDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Converts YYYY-MM-DD string to Date object in local timezone
   */
  static fromDateString(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /**
   * Gets today's date in YYYY-MM-DD format (local timezone)
   */
  static getTodayString(): string {
    return this.toDateString(new Date());
  }

  /**
   * Creates a date string for a specific year, month, day
   */
  static createDateString(year: number, month: number, day: number): string {
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  }

  /**
   * Validates if a string is in YYYY-MM-DD format
   */
  static isValidDateString(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = this.fromDateString(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Gets the date string for yesterday
   */
  static getYesterdayString(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.toDateString(yesterday);
  }

  /**
   * Gets the date string for tomorrow
   */
  static getTomorrowString(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.toDateString(tomorrow);
  }

  /**
   * Adds days to a date string and returns new date string
   */
}