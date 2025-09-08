export interface CalendarDay {
  date: string; // API returns DateTime, but JSON serializes to string
  isCompleted: boolean;
  isInStreak: boolean;
  dayInStreak: number;
  streakColor: StreakColor;
  rewards: RewardType[];
  isSpecialDay: boolean;
  specialDayType?: string;
  notes?: string;
}

export interface MonthData {
  year: number;
  month: number;
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
  lastCompletedDate?: string; // API returns DateTime?, JSON serializes to string
  streakPeriods: StreakPeriod[];
}

export interface StreakPeriod {
  startDate: string; // API returns DateTime, JSON serializes to string
  endDate: string;   // API returns DateTime, JSON serializes to string
  length: number;
  color: StreakColor;
}

export enum StreakColor {
  None = 0,
  Salmon = 1,
  Orange = 2,
  Yellow = 3,
  White = 4
}

export enum RewardType {
  Coffee = 1,
  Book = 2,
  Clothing = 3,
  Tennis = 4
}

export interface ToggleDayRequest {
  date: string;
  notes?: string;
}

export interface UpdateNotesRequest {
  date: string;
  notes?: string;
}

// Utility type for API responses
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}