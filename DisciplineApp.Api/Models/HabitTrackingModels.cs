using System.ComponentModel.DataAnnotations;

namespace DisciplineApp.Api.Models
{
    // Core Habit Definition
    public class Habit
    {
        [Key]
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public HabitCategory Category { get; set; }
        public FrequencyType FrequencyType { get; set; }

        public int RequiredCount { get; set; } // How many times required in window
        public int WindowDays { get; set; } // Size of the time window

        public bool IsRequired { get; set; } = true;
        public string? SeasonalMonths { get; set; } // "3,4,5,6,7,8,9,10" for March-October

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<HabitCompletion> Completions { get; set; } = new List<HabitCompletion>();
    }

    // Individual habit completions
    public class HabitCompletion
    {
        [Key]
        public int Id { get; set; }

        public int HabitId { get; set; }
        public DateOnly Date { get; set; } // When the habit was completed

        public DateTime CompletedAt { get; set; } // Timestamp of completion
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property
        public virtual Habit Habit { get; set; } = null!;
    }

    // Grace period usage tracking
    public class GraceUsage
    {
        [Key]
        public int Id { get; set; }

        public DateOnly Date { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateTime UsedAt { get; set; } = DateTime.UtcNow;
    }

    // Enums for habit categorization
    public enum HabitCategory
    {
        Daily,      // Must be done every day
        Rolling,    // Must be done within rolling window (e.g., every 2 days)
        Weekly,     // Must be done X times per week
        Monthly,    // Must be done X times per month
        Seasonal    // Only required during certain months
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
}