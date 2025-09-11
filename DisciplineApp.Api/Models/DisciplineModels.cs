using System.ComponentModel.DataAnnotations;

namespace DisciplineApp.Api.Models
{
    public class DisciplineEntry
    {
        public int Id { get; set; }

        [Required]
        public DateTime Date { get; set; }

        public bool IsCompleted { get; set; }

        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public bool IsGraceUsed { get; set; } = false;

        // Navigation properties
        public List<Reward> Rewards { get; set; } = new List<Reward>();
    }

    public class Reward
    {
        public int Id { get; set; }

        [Required]
        public RewardType Type { get; set; }

        [Required]
        public int DisciplineEntryId { get; set; }

        public DisciplineEntry DisciplineEntry { get; set; } = null!;

        public DateTime EarnedAt { get; set; } = DateTime.UtcNow;
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

    public enum StreakColor
    {
        None = 0,
        Salmon = 1,    // Days 1-7
        Orange = 2,    // Days 8-30
        Yellow = 3,    // Days 31-90
        White = 4      // Days 91+
    }

    // DTOs for API responses
    public class CalendarDayDto
    {
        public DateTime Date { get; set; }
        public bool IsCompleted { get; set; }
        public bool IsInStreak { get; set; }
        public int DayInStreak { get; set; }
        public StreakColor StreakColor { get; set; }
        public List<RewardType> Rewards { get; set; } = new List<RewardType>();
        public bool IsSpecialDay { get; set; }
        public string? SpecialDayType { get; set; }
        public string? Notes { get; set; }
    }

    public class MonthDataDto
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public string MonthName { get; set; } = string.Empty;
        public List<CalendarDayDto> Days { get; set; } = new List<CalendarDayDto>();
    }

    public class YearCalendarDto
    {
        public int Year { get; set; }
        public List<MonthDataDto> Months { get; set; } = new List<MonthDataDto>();
        public StreakInfo StreakInfo { get; set; } = new StreakInfo();
    }

    // Request DTOs
    public class ToggleDayRequest
    {
        [Required]
        public DateTime Date { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdateNotesRequest
    {
        [Required]
        public DateTime Date { get; set; }
        public string? Notes { get; set; }
    }
}