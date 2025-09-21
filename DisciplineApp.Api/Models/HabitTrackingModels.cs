using System.ComponentModel.DataAnnotations;

namespace DisciplineApp.Api.Models
{
    // Core Habit Definition
    public class Habit
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public HabitFrequency Frequency { get; set; }
        public int WeeklyTarget { get; set; } = 1;
        public int MonthlyTarget { get; set; } = 1;
        public int SeasonalTarget { get; set; } = 1;
        public TimeOnly DeadlineTime { get; set; }
        public bool HasDeadline { get; set; } = false;
        public bool IsOptional { get; set; } = false; 
        public bool IsLocked { get; set; } = false;
        public bool IsActive { get; set; } = true;
        public int MaxDeferrals { get; set; } = 0; // 🔥 ENSURE THIS FIELD EXISTS
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public virtual ICollection<HabitCompletion> Completions { get; set; } = new List<HabitCompletion>();
        public virtual ICollection<TaskDeferral> Deferrals { get; set; } = new List<TaskDeferral>();
        public virtual ICollection<SubHabit> SubHabits { get; set; } = new List<SubHabit>();
    }


    // Individual habit completions
    public class HabitCompletion
    {
        public int Id { get; set; }
        public int HabitId { get; set; }
        public DateTime Date { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string Notes { get; set; } = string.Empty;

        // Navigation properties
        public virtual Habit Habit { get; set; } = null!;
    }
    public class SubHabit
    {
        public int Id { get; set; }
        public int ParentHabitId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int OrderIndex { get; set; } = 0; // For displaying in correct order
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public virtual Habit ParentHabit { get; set; } = null!;
        public virtual ICollection<SubHabitCompletion> Completions { get; set; } = new List<SubHabitCompletion>();
    }

    // NEW: Sub-Habit Completion Model
    public class SubHabitCompletion
    {
        public int Id { get; set; }
        public int SubHabitId { get; set; }
        public DateTime Date { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string Notes { get; set; } = string.Empty;

        // Navigation properties
        public virtual SubHabit SubHabit { get; set; } = null!;
    }

    // Grace period usage tracking
    public class GraceUsage
    {
        public int Id { get; set; }
        public DateTime UsedDate { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // Enums for habit categorization
    public enum HabitFrequency
    {
        Daily,              // Phone lock box - every day
        EveryTwoDays,       // Dishes - every 2 days max
        Weekly,             // Gym, Vacuum, Bathroom - X times per week
        Monthly,            // Kitchen deep clean - once per month
        Seasonal            // Windows - 3 times during March-October
    }

    public enum FrequencyType
    {
        Daily,
        EveryNDays,
        Weekly,
        Monthly,
        Seasonal
    }

    public enum UrgencyLevel
    {
        Complete,   // Already completed
        Normal,     // On track
        Urgent,     // Getting behind
        Critical    // Must complete today or fail
    }

    public enum DayCompletionStatus
    {
        Complete,   // All required habits completed
        Partial,    // Some habits completed
        Incomplete, // No habits completed
        GraceUsed   // Used grace day
    }

    public class TaskDeferral
    {
        public int Id { get; set; }
        public int HabitId { get; set; }
        public DateTime OriginalDate { get; set; }
        public DateTime DeferredToDate { get; set; }
        public int DeferralsUsed { get; set; } = 1;
        public string Reason { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // 🔥 KEEP ONLY ONE CompletedAt field
        public DateTime? CompletedAt { get; set; }
        public bool IsCompleted { get; set; } = false;

        // Navigation properties
        public virtual Habit Habit { get; set; } = null!;
    }

    public class HabitWithFlexibility
    {
        public int HabitId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Frequency { get; set; } = string.Empty;
        public DateTime OriginalScheduledDate { get; set; }
        public DateTime CurrentDueDate { get; set; }
        public int DeferralsUsed { get; set; }
        public int MaxDeferrals { get; set; }
        public int DaysRemaining { get; set; }
        public string UrgencyLevel { get; set; } = "normal"; // safe, warning, urgent, critical
        public bool CanStillBeDeferred { get; set; }
        public string StatusLabel { get; set; } = string.Empty;
        public string FlexibilityIcon { get; set; } = string.Empty;
        public string FlexibilityColor { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
        public bool IsRequired { get; set; }
        public bool IsLocked { get; set; }
        public bool HasDeadline { get; set; }
        public TimeOnly DeadlineTime { get; set; }
    }

    // DTOs for API responses
    public class DayStatusDto
    {
        public string Date { get; set; } = string.Empty;
        public DayCompletionStatus Status { get; set; }
        public List<HabitStatusDto> HabitStatuses { get; set; } = new List<HabitStatusDto>();
        public int CompletionPercentage { get; set; }
        public List<string> Reminders { get; set; } = new List<string>();
        public bool CanUseGrace { get; set; }
        public bool IsToday { get; set; } = false;
        public bool IsPastDay { get; set; } = false;
    }


    public class HabitStatusDto
    {
        public int HabitId { get; set; }
        public string HabitName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
        public bool IsRequired { get; set; }
        public UrgencyLevel UrgencyLevel { get; set; }
        public string CompletionWindow { get; set; } = string.Empty;
    }

    public class WeekStatusDto
    {
        public string WeekStartDate { get; set; } = string.Empty;
        public string WeekEndDate { get; set; } = string.Empty;
        public List<DayStatusDto> DayStatuses { get; set; } = new List<DayStatusDto>();
        public List<WeeklyHabitProgressDto> WeeklyHabitProgress { get; set; } = new List<WeeklyHabitProgressDto>();
    }

    public class WeeklyHabitProgressDto
    {
        public int HabitId { get; set; }
        public string HabitName { get; set; } = string.Empty;
        public int RequiredCount { get; set; }
        public int CompletedCount { get; set; }
        public bool IsOnTrack { get; set; }
        public bool IsStillAchievable { get; set; }
        public int DaysRemaining { get; set; }
    }

    public class GracePeriodStatusDto
    {
        public string WeekStartDate { get; set; } = string.Empty;
        public int GraceAllowance { get; set; }
        public int GraceUsed { get; set; }
        public int GraceRemaining { get; set; }
        public bool CanUseGrace { get; set; }
    }

    // Request DTOs
    public class CompleteHabitRequest
    {
        public int HabitId { get; set; }
        public string Date { get; set; } = string.Empty; // YYYY-MM-DD format
        public string? Notes { get; set; }
    }

    public class UseGraceRequest
    {
        public string Date { get; set; } = string.Empty; // YYYY-MM-DD format
        public string Reason { get; set; } = string.Empty;
    }

    public class AdHocTask
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public DateTime Date { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? DeadlineDate { get; set; }  // NEW
        public bool IsAutoMoved { get; set; } = false;  // NEW
        public DateTime? OriginalDate { get; set; }  // NEW - tracks original date
        public DateTime CreatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string Notes { get; set; }
    }

    public class DailyStats
    {
        public int Id { get; set; }
        public DateTime Date { get; set; }

        // Essential stats for monthly calendar
        public int TotalTasks { get; set; }
        public int CompletedTasks { get; set; }
        public int RequiredTasks { get; set; }
        public int CompletedRequiredTasks { get; set; }
        public bool IsDayCompleted { get; set; }

        // Streak context when this day was calculated
        public int StreakDayNumber { get; set; } // What day of streak this was (1, 2, 3, etc.)
        public bool IsInFirst7Days { get; set; } // Was this in the "easy" period?

        // Completion percentage for visual display
        public decimal CompletionPercentage { get; set; }

        // When this was calculated (for cache invalidation)
        public DateTime CalculatedAt { get; set; } = DateTime.UtcNow;

        // Optional: Store the specific completion rules used
        public string CompletionRules { get; set; } = string.Empty; // e.g., "First7Days:PhoneLockOnly"
    }
}