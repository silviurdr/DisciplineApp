// ===================================
// COMPLETE DISCIPLINE MODELS
// src/app/models/discipline.models.ts
// ===================================

// ===================================
// CALENDAR MODELS (Original)
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
  lastCompletedDate: Date;
}

export interface Reward {
  id: number;
  type: string;
  description: string;
  earnedAt: string;
}

export enum StreakColor {
  None = 0,
  Salmon = 1,
  Orange = 2,
  Yellow = 3,
  White = 4
}

// ===================================
// HABIT MODELS (Enhanced)
// ===================================

export interface ScheduledHabit {
  habitId: number;
  name: string;
  description: string;
  isCompleted: boolean;
  isRequired: boolean;
  isLocked: boolean;
  hasDeadline: boolean;
  deadlineTime?: string;
  timeRemaining?: string;
  isOverdue: boolean;
  urgencyLevel: string;
  reason?: string;
  priority?: string;
  isMustDo?: boolean;
  estimatedDurationMinutes?: number;
  
  // Flexible task properties
  frequency?: string;
  deferralsUsed?: number;
  maxDeferrals?: number;
  canStillBeDeferred?: boolean;
  originalScheduledDate?: string;
  currentDueDate?: string;
  flexibilityStatus?: FlexibilityStatus;
  deadlineDate?: string;  // NEW

    // NEW: Sub-habits properties
  hasSubHabits?: boolean;
  subHabits?: SubHabit[];
  allSubHabitsCompleted?: boolean;
  completedSubHabitsCount?: number;
  totalSubHabitsCount?: number;
  isExpanded?: boolean;
  
  // Ad-hoc task properties
  isAdHoc?: boolean;
  adHocId?: number;
}

export interface HabitWithFlexibility {
  habitId: number;
  name: string;
  description: string;
  frequency: string;
  originalScheduledDate: string;
  currentDueDate: string;
  deferralsUsed: number;
  maxDeferrals: number;
  daysRemaining: number;
  urgencyLevel: UrgencyLevel;
  canStillBeDeferred: boolean;
  statusLabel: string;
  flexibilityIcon: string;
  flexibilityColor: string;
  isCompleted: boolean;
  isRequired: boolean;
  isLocked: boolean;
  hasDeadline: boolean;
  deadlineTime: string;
}

export interface FlexibilityStatus {
  urgency: UrgencyLevel;
  color: string;
  icon: string;
  label: string;
  statusText: string;
  remainingDeferrals: number;
  maxDeferrals: number;
  deferralsUsed: number;
  showDetails: boolean;
}

export type UrgencyLevel = 'safe' | 'warning' | 'urgent' | 'critical';

// ===================================
// DAY AND WEEK MODELS
// ===================================

export interface DayData {
  date: string;
  isCompleted: boolean;
  isPartiallyCompleted: boolean;
  completedHabits: number;
  totalHabits: number;
  requiredHabitsCount: number;
  completedRequiredCount: number;
  optionalHabitsCount: number;
  completedOptionalCount: number;
  canUseGrace: boolean;
  usedGrace: boolean;
  allHabits: ScheduledHabit[];
  warnings: string[];
  recommendations: string[];
  dayOfWeek: string;
  isToday: boolean;
  isFuture: boolean;
  isPast: boolean;
}

export interface WeekData {
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: number;
  year: number;
  days: DayData[];
  weeklyStats: WeeklyStats;
}

export interface WeeklyStats {
  totalDays: number;
  completedDays: number;
  partialDays: number;
  incompleteDays: number;
  completionRate: number;
  graceUsed: number;
  graceRemaining: number;
}

export interface WeeklyProgress {
  overallProgress: number;
  graceRemaining: number;
  graceUsed: number;
  habitProgress: HabitProgress[];
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
}

// ===================================
// MONTHLY VIEW SPECIFIC MODELS
// ===================================

export interface MonthlyStats {
  completedDays: number;
  totalDays: number;
  completionRate: number;
  currentStreak: number;
  totalHabits: number;
  averageCompletionRate?: number;
  bestDay?: string;
  worstDay?: string;
  flexibilityUsageRate?: number;
}

export interface ProjectedReward {
  date: Date;
  dateString: string;
  streakDay: number;
  tier: RewardTier;
}

export interface RewardTier {
  tier: 1 | 2 | 3 | 4;
  icon: string;
  name: string;
  color: string;
}

export interface HabitProgress {
  habitId: number;
  habitName: string;
  completedCount: number;
  requiredCount: number;
  urgency: string;
  remainingDays: number;
  isAchievable: boolean;
  isOnTrack: boolean;
  frequency: string;
  deferralsUsed?: number;
  maxDeferrals?: number;
}

// ===================================
// REQUEST/RESPONSE MODELS
// ===================================

export interface CompleteHabitRequest {
  habitId: number;
  date: string;
  isCompleted: boolean;
  adHocId?: number;
  notes?: string;
}

export interface DeferTaskRequest {
  habitId: number;
  fromDate: string;
  reason?: string;
}

export interface DeferTaskResponse {
  success: boolean;
  message: string;
  updatedTask: HabitWithFlexibility;
  newDueDate: string;
  deferralsUsed: number;
  remainingDeferrals: number;
}

export interface MoveTaskRequest {
  habitId: number;
  currentDate: string;
  reason?: string;
}

export interface UseGraceDayRequest {
  date: string;
  reason: string;
}

export interface UseGraceDayResponse {
  success: boolean;
  message: string;
  graceUsed: number;
  graceRemaining: number;
}

export interface AddAdHocTaskRequest {
  name: string;
  description: string;
  date: string;
  priority?: 'low' | 'normal' | 'high';
  deadlineDate?: string;  // NEW
}

export interface EditAdHocTaskRequest {
  adHocId: number;
  name: string;
  description: string;
}

export interface AdHocTaskResponse {
  id: number;
  name: string;
  description: string;
  date: string;
  isCompleted: boolean;
  createdAt: string;
}

// ===================================
// HABIT MANAGEMENT MODELS
// ===================================

export interface Habit {
  id: number;
  name: string;
  description: string;
  frequency: HabitFrequency;
  weeklyTarget: number;
  monthlyTarget: number;
  seasonalTarget: number;
  deadlineTime: string;
  hasDeadline: boolean;
  isOptional: boolean;
  isLocked: boolean;
  isActive: boolean;
  maxDeferrals: number;
  createdAt: string;
  estimatedDurationMinutes?: number;
}

export enum HabitFrequency {
  Daily = 0,
  EveryTwoDays = 1,
  Weekly = 2,
  Monthly = 3,
  Seasonal = 4
}

export interface CreateHabitRequest {
  name: string;
  description: string;
  frequency: string;
  weeklyTarget?: number;
  monthlyTarget?: number;
  seasonalTarget?: number;
  hasDeadline: boolean;
  deadlineTime?: string;
  maxDeferrals?: number;
  estimatedDurationMinutes?: number;
}

export interface UpdateHabitRequest {
  id: number;
  name: string;
  description: string;
  frequency: string;
  weeklyTarget?: number;
  monthlyTarget?: number;
  seasonalTarget?: number;
  hasDeadline: boolean;
  deadlineTime?: string;
  isActive: boolean;
  isLocked: boolean;
  maxDeferrals?: number;
  estimatedDurationMinutes?: number;
}

// ===================================
// SUB-HABITS MODELS
// ===================================

export interface SubHabit {
  id: number;
  parentHabitId: number;
  name: string;
  description: string;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  isCompleted?: boolean; // For daily view
  completedAt?: string; // For daily view
}

export interface HabitWithSubHabits extends ScheduledHabit {
  subHabits?: SubHabit[];
  hasSubHabits?: boolean;
  allSubHabitsCompleted?: boolean;
  completedSubHabitsCount?: number;
  totalSubHabitsCount?: number;
  isExpanded?: boolean; // For UI state
}

// SUB-HABITS REQUEST/RESPONSE MODELS
// ===================================

export interface CreateSubHabitRequest {
  parentHabitId: number;
  name: string;
  description?: string;
}

export interface UpdateSubHabitRequest {
  name: string;
  description?: string;
  isActive: boolean;
}

export interface CompleteSubHabitRequest {
  date: string; // YYYY-MM-DD
  isCompleted: boolean;
  notes?: string;
}

export interface CompleteAllSubHabitsRequest {
  date: string; // YYYY-MM-DD
}

export interface SubHabitCompletionResponse {
  subHabitId: number;
  date: string;
  isCompleted: boolean;
  completedAt?: string;
  parentHabitCompleted: boolean;
  message: string;
}

export interface CompleteAllSubHabitsResponse {
  habitId: number;
  date: string;
  completedSubHabits: number;
  totalSubHabits: number;
  parentHabitCompleted: boolean;
  message: string;
}

export interface SubHabitsWithCompletionsResponse {
  habitId: number;
  date: string;
  subHabits: SubHabit[];
}

// ===================================
// ANALYTICS MODELS
// ===================================

export interface FlexibilityAnalytics {
  totalDeferrals: number;
  deferralsPerHabit: HabitDeferralStats[];
  avgDeferralsPerTask: number;
  mostDeferredDay: string;
  flexibilityUsageRate: number;
  periodStart: string;
  periodEnd: string;
  tasksSavedByFlexibility: number;
}

export interface HabitDeferralStats {
  habitId: number;
  habitName: string;
  totalDeferrals: number;
  avgDeferralsPerInstance: number;
  maxConsecutiveDeferrals: number;
  flexibilityUsageRate: number;
}

export interface CompletionRateAnalytics {
  overallCompletionRate: number;
  completionRateWithFlexibility: number;
  improvementFromFlexibility: number;
  tasksSavedByFlexibility: number;
  totalTasksAnalyzed: number;
  periodStart: string;
  periodEnd: string;
  byHabit: HabitCompletionStats[];
}

export interface HabitCompletionStats {
  habitId: number;
  habitName: string;
  completionRate: number;
  completionRateWithFlexibility: number;
  totalInstances: number;
  completedInstances: number;
  deferredInstances: number;
  failedInstances: number;
}

export interface DeferralStatus {
  habitId: number;
  date: string;
  deferralsUsed: number;
  maxDeferrals: number;
  canStillDefer: boolean;
  urgencyLevel: UrgencyLevel;
  statusText: string;
  flexibilityInfo: FlexibilityDisplayInfo;
}

export interface FlexibilityDisplayInfo {
  icon: string;
  color: string;
  label: string;
  statusText: string;
  urgency: UrgencyLevel;
  remainingDeferrals: number;
}

export interface AdvancedCompleteRequest {
  habitId: number;
  completionDate: string; // YYYY-MM-DD format
}

// Advanced completion response interface  
export interface AdvancedCompleteResponse {
  success: boolean;
  message: string;
  completedDate: string;
  originalScheduledDate: string;
  updatedWeekSchedule: any; // WeekSchedule object
}

// ===================================
// BULK OPERATIONS MODELS
// ===================================

export interface BulkDeferRequest {
  tasks: DeferTaskRequest[];
}

export interface BulkDeferResponse {
  successCount: number;
  failureCount: number;
  results: DeferTaskResponse[];
  errors: BulkOperationError[];
}

export interface BulkOperationError {
  habitId: number;
  habitName: string;
  error: string;
  reason: string;
}

export interface BulkCompleteRequest {
  habits: CompleteHabitRequest[];
}

export interface BulkCompleteResponse {
  successCount: number;
  failureCount: number;
  results: { habitId: number; success: boolean; message: string }[];
}

// ===================================
// NOTIFICATION MODELS
// ===================================

export interface NotificationPreferences {
  enableDeadlineReminders: boolean;
  enableFlexibilityWarnings: boolean;
  enableStreakReminders: boolean;
  reminderTime: string; // HH:mm format
  deadlineReminderMinutes: number;
  flexibilityWarningThreshold: number; // 0.0 to 1.0
}

export interface ReminderSettings {
  habitId: number;
  enabled: boolean;
  reminderTimes: string[]; // Array of HH:mm times
  customMessage?: string;
}

// ===================================
// EXPORT MODELS
// ===================================

export interface ExportDataRequest {
  format: 'json' | 'csv' | 'excel';
  dateFrom: string;
  dateTo: string;
  includeHabits: boolean;
  includeCompletions: boolean;
  includeDeferrals: boolean;
  includeAnalytics: boolean;
}

export interface ExportDataResponse {
  fileName: string;
  downloadUrl: string;
  fileSize: number;
  expiresAt: string;
}

// ===================================
// UTILITY TYPES
// ===================================

export type TaskStatus = 'pending' | 'completed' | 'deferred' | 'failed' | 'grace-used';

export type Priority = 'low' | 'normal' | 'high' | 'critical';

export type TimeRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DateRange {
  start: string;
  end: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ===================================
// API RESPONSE WRAPPERS
// ===================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors: string[];
  timestamp: string;
  statusCode: number;
}

// ===================================
// LEGACY SUPPORT (for backward compatibility)
// ===================================

export interface ToggleDayRequest {
  date: string;
}

export interface UpdateDayRequest {
  date: string;
  isCompleted: boolean;
  notes?: string;
}