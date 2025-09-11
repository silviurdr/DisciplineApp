using System.ComponentModel.DataAnnotations;

namespace DisciplineApp.Api.Models
{
    public class Habit
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public HabitFrequency Frequency { get; set; }

        public int RequiredCount { get; set; } = 1; // How many times within the period

        public int WindowDays { get; set; } = 1; // Rolling window in days (e.g., 2 for dishes)

        public bool IsActive { get; set; } = true;

        // Seasonal constraints
        public int? StartMonth { get; set; } // e.g., 3 for March
        public int? EndMonth { get; set; }   // e.g., 10 for October

        public List<HabitCompletion> Completions { get; set; } = new List<HabitCompletion>();
    }

    public enum HabitFrequency
    {
        Daily,      // Phone lock box
        Rolling,    // Dishes (every 2 days)
        Weekly,     // Vacuum/sweep (2x), Gym (4x), Bathroom clean (1x)
        Monthly,    // Kitchen deep clean
        Seasonal    // Window cleaning (3x during warm months)
    }

    public class HabitCompletion
    {
        public int Id { get; set; }

        [Required]
        public int HabitId { get; set; }
        public Habit Habit { get; set; } = null!;

        [Required]
        public DateTime Date { get; set; }

        public bool IsCompleted { get; set; }

        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class DayStatus
    {
        public DateTime Date { get; set; }
        public bool IsCompleted { get; set; }
        public bool IsGraceUsed { get; set; }
        public List<HabitStatus> HabitStatuses { get; set; } = new List<HabitStatus>();
        public List<string> Warnings { get; set; } = new List<string>();
        public List<string> Recommendations { get; set; } = new List<string>();
        public bool CanUseGrace { get; internal set; }
    }

    public class HabitStatus
    {
        public int HabitId { get; set; }
        public string HabitName { get; set; } = string.Empty;
        public bool IsRequired { get; set; }
        public bool IsCompleted { get; set; }
        public bool CanSkipWithGrace { get; set; }
        public int CurrentWindowCount { get; set; } // Current completions in rolling window
        public int RequiredWindowCount { get; set; } // Required completions in window
        public DateTime? LastCompletedDate { get; set; }
        public string Status { get; set; } = string.Empty; // "On track", "Behind", "Impossible"
    }

    public class WeeklyProgress
    {
        public DateTime WeekStart { get; set; }
        public DateTime WeekEnd { get; set; }
        public int GraceUsed { get; set; }
        public int GraceRemaining { get; set; }
        public List<HabitWeeklyStatus> HabitProgress { get; set; } = new List<HabitWeeklyStatus>();
    }

    public class HabitWeeklyStatus
    {
        public int HabitId { get; set; }
        public string HabitName { get; set; } = string.Empty;
        public int CompletedCount { get; set; }
        public int RequiredCount { get; set; }
        public int RemainingDays { get; set; }
        public bool IsAchievable { get; set; }
        public string Urgency { get; set; } = "Normal"; // "Normal", "Urgent", "Critical"
    }

    public class StreakCalculationResult
    {
        public int CurrentStreak { get; set; }
        public int LongestStreak { get; set; }
        public DateTime? LastCompletedDate { get; set; }
        public bool IsStreakAtRisk { get; set; }
        public List<string> RiskFactors { get; set; } = new List<string>();
        public List<string> ActionItems { get; set; } = new List<string>();
    }

    // DTOs for API requests
    public class CompleteHabitRequest
    {
        [Required]
        public int HabitId { get; set; }

        [Required]
        public DateTime Date { get; set; }
        [Required]
        public bool IsCompleted { get; set; }

        public string? Notes { get; set; }
    }

    public class UseGraceRequest
    {
        [Required]
        public DateTime Date { get; set; }

        public int? SkippedHabitId { get; set; }

        public string? Reason { get; set; }
    }
}