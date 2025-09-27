using System.ComponentModel.DataAnnotations;

namespace DisciplineApp.Api.Models
{
    public class DisciplineEntry
    {
        [Key]
        public int Id { get; set; }

        // Use DateOnly instead of DateTime to eliminate timezone conversion issues
        public DateOnly Date { get; set; }

        public bool IsCompleted { get; set; }
        public bool IsSpecial { get; set; } // Special rewards day
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }

        // Navigation property for rewards
        public virtual ICollection<Reward> Rewards { get; set; } = new List<Reward>();
    }

    // Reward tracking
    public class Reward
    {
        public int Id { get; set; }
        public int? DisciplineEntryId { get; set; } // Optional foreign key to DisciplineEntry
        public string Type { get; set; } = string.Empty; // "Weekly", "Monthly", etc.
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int StreakRequired { get; set; }
        public DateTime EarnedAt { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property
        public virtual DisciplineEntry? DisciplineEntry { get; set; }
    }
    public enum RewardType
    {
        Coffee = 1,    // Day 7
        Book = 2,      // Day 14  
        Clothing = 3,  // Day 30
        Tennis = 4     // Day 90
    }

    public class StreakInfo
    {
        public int CurrentStreak { get; set; }
        public int LongestStreak { get; set; }
        public int TotalDays { get; set; }
        public DateTime? LastCompletedDate { get; set; }
        public List<StreakPeriod> StreakPeriods { get; set; } = new List<StreakPeriod>();
    }

    public class StreakPeriod
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int Length { get; set; }
        public StreakColor Color { get; set; }
    }

    // DTOs for API responses
    public class CalendarDayDto
    {
        public string Date { get; set; } = string.Empty; // Format: YYYY-MM-DD
        public int DayOfMonth { get; set; }
        public bool IsCompleted { get; set; }
        public bool IsSpecial { get; set; }
        public int DayInStreak { get; set; }
        public StreakColor Color { get; set; }
        public List<RewardDto> Rewards { get; set; } = new List<RewardDto>();
    }

    public class MonthDataDto
    {
        public int Month { get; set; }
        public int Year { get; set; }
        public string MonthName { get; set; } = string.Empty;
        public List<CalendarDayDto> Days { get; set; } = new List<CalendarDayDto>();
    }

    public class YearCalendarDto
    {
        public int Year { get; set; }
        public List<MonthDataDto> Months { get; set; } = new List<MonthDataDto>();
        public StreakInfoDto StreakInfo { get; set; } = new StreakInfoDto();
    }

    public class StreakInfoDto
    {
        public int CurrentStreak { get; set; }
        public int LongestStreak { get; set; }
        public int TotalDays { get; set; }
        public int WeeklyRewards { get; set; }
        public int MonthlyRewards { get; set; }
        public int? NextMilestone { get; set; }
        public DateTime? LastUpdate { get; set; }
    }

    public class RewardDto
    {
        public int Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime EarnedAt { get; set; }
    }

    // Request DTOs
    public class ToggleDayRequest
    {
        public string Date { get; set; } = string.Empty; // Format: YYYY-MM-DD
    }

    public class UpdateDayRequest
    {
        public string Date { get; set; } = string.Empty; // Format: YYYY-MM-DD
        public bool IsCompleted { get; set; }
        public string? Notes { get; set; }
    }

    public class EarnedReward
    {
        public int Id { get; set; }
        public string RewardType { get; set; } = string.Empty; // "Coffee", "Book", "Clothing", etc.
        public int Count { get; set; } = 0;
        public DateTime LastUpdated { get; set; }
    }
    public enum StreakColor
    {
        None,     // No completion
        Blue,     // 1-6 days
        Green,    // 7-29 days  
        Orange,   // 30-89 days
        Red,      // 90+ days
        Special   // Reward days
    }

    // Helper class for date operations
    public static class DateHelper
    {
        /// <summary>
        /// Converts a date string (YYYY-MM-DD) to DateOnly safely
        /// </summary>
        public static DateOnly ParseDateString(string dateString)
        {
            if (DateTime.TryParse(dateString, out var dateTime))
            {
                return DateOnly.FromDateTime(dateTime);
            }
            throw new ArgumentException($"Invalid date format: {dateString}. Expected format: YYYY-MM-DD");
        }

        /// <summary>
        /// Converts DateOnly to string format for API responses
        /// </summary>
        public static string ToDateString(DateOnly date)
        {
            return date.ToString("yyyy-MM-dd");
        }

        /// <summary>
        /// Gets today's date in the user's timezone, but as DateOnly (no time component)
        /// </summary>
        public static DateOnly GetToday()
        {
            return DateOnly.FromDateTime(DateTime.Today);
        }

        /// <summary>
        /// Converts a potentially timezone-aware DateTime to a safe DateOnly
        /// </summary>
        public static DateOnly ToDateOnly(DateTime dateTime)
        {
            return DateOnly.FromDateTime(dateTime.Date);
        }
    }
}