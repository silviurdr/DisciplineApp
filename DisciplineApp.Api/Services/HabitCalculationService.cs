using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Services;

public class HabitCalculationService : IHabitCalculationService
{
    private readonly DisciplineDbContext _context;

    public HabitCalculationService(DisciplineDbContext context)
    {
        _context = context;
    }

    public async Task<DayStatusResponse> GetDayStatus(DateTime date)
    {
        var habits = await _context.Habits.ToListAsync();
        var completions = await _context.HabitCompletions
            .Where(h => h.Date >= date.AddDays(-60)) // Get last 60 days for analysis
            .ToListAsync();

        var dayCompletions = completions.Where(c => c.Date.Date == date.Date).ToList();
        var requiredHabits = new List<HabitStatus>();
        var optionalHabits = new List<HabitStatus>();
        var warnings = new List<string>();
        var recommendations = new List<string>();

        foreach (var habit in habits)
        {
            var habitStatus = await CalculateHabitStatus(habit, date, completions, dayCompletions);

            if (habitStatus.IsRequired)
            {
                requiredHabits.Add(habitStatus);

                // Add warnings for urgent habits
                if (habitStatus.UrgencyLevel == UrgencyLevel.Critical)
                {
                    warnings.Add($"CRITICAL: {habit.Name} must be completed today to maintain streak!");
                }
                else if (habitStatus.UrgencyLevel == UrgencyLevel.Urgent)
                {
                    warnings.Add($"URGENT: {habit.Name} needed to stay on track.");
                }
            }
            else if (habitStatus.IsOptional)
            {
                optionalHabits.Add(habitStatus);

                // Add recommendations for optional but beneficial habits
                recommendations.Add($"Optional: {habit.Name} - {habitStatus.Reason}");
            }
        }

        // Calculate if day can be marked complete
        var canUseGrace = await CanUseGraceDay(date);
        var requiredCount = requiredHabits.Count;
        var completedRequired = requiredHabits.Count(h => h.IsCompleted);

        bool isCompleted = completedRequired == requiredCount;
        bool isPartiallyCompleted = completedRequired > 0 && completedRequired < requiredCount;
        bool canUseGraceToComplete = !isCompleted && canUseGrace && (requiredCount - completedRequired) <= 1;

        return new DayStatusResponse
        {
            Date = date,
            IsCompleted = isCompleted,
            IsPartiallyCompleted = isPartiallyCompleted,
            CanUseGrace = canUseGraceToComplete,
            RequiredHabits = requiredHabits,
            OptionalHabits = optionalHabits,
            Warnings = warnings,
            Recommendations = recommendations
        };
    }

    private async Task<HabitStatus> CalculateHabitStatus(Habit habit, DateTime date, List<HabitCompletion> allCompletions, List<HabitCompletion> dayCompletions)
    {
        var isCompleted = dayCompletions.Any(c => c.HabitId == habit.Id && c.IsCompleted);

        bool isLocked = false;
        if (habit.HasDeadline && date.Date == DateTime.Today)
        {
            var currentTime = TimeOnly.FromDateTime(DateTime.Now);
            var deadlineTime = habit?.DeadlineTime ?? TimeOnly.MaxValue;

            // If it's past the deadline and not completed, lock it
            if (currentTime > deadlineTime && !isCompleted)
            {
                isLocked = true;
            }
        }

        var status = new HabitStatus
        {
            HabitId = habit.Id,
            HabitName = habit.Name,
            Description = habit.Description,
            IsCompleted = isCompleted,
            CompletedAt = dayCompletions.FirstOrDefault(c => c.HabitId == habit.Id)?.CompletedAt,
            IsLocked = isLocked
        };

        switch (habit.Frequency)
        {
            case HabitFrequency.Daily:
                status.IsRequired = true;
                status.UrgencyLevel = UrgencyLevel.Critical;
                status.Reason = "Required daily";
                break;

            case HabitFrequency.EveryTwoDays:
                status = await CalculateRollingHabitStatus(habit, date, allCompletions, status);
                break;

            case HabitFrequency.Weekly:
                status = await CalculateWeeklyHabitStatus(habit, date, allCompletions, status);
                break;

            case HabitFrequency.Monthly:
                status = await CalculateMonthlyHabitStatus(habit, date, allCompletions, status);
                break;

            case HabitFrequency.Seasonal:
                status = await CalculateSeasonalHabitStatus(habit, date, allCompletions, status);
                break;
        }

        return status;
    }

    private async Task<HabitStatus> CalculateRollingHabitStatus(Habit habit, DateTime date, List<HabitCompletion> allCompletions, HabitStatus status)
    {
        // For dishes: every 2 days max gap
        var habitCompletions = allCompletions
            .Where(c => c.HabitId == habit.Id && c.IsCompleted)
            .OrderByDescending(c => c.Date)
            .ToList();

        var lastCompletion = habitCompletions.FirstOrDefault()?.Date;

        if (lastCompletion == null)
        {
            // Never completed - required immediately
            status.IsRequired = true;
            status.UrgencyLevel = UrgencyLevel.Critical;
            status.Reason = "Never completed";
        }
        else
        {
            var daysSinceLastCompletion = (date - lastCompletion.Value).Days;

            if (daysSinceLastCompletion >= 2)
            {
                // Required - too many days passed
                status.IsRequired = true;
                status.UrgencyLevel = UrgencyLevel.Critical;
                status.Reason = $"Last completed {daysSinceLastCompletion} days ago";
            }
            else if (daysSinceLastCompletion == 1)
            {
                // Optional but getting urgent
                status.IsOptional = true;
                status.UrgencyLevel = UrgencyLevel.Normal;
                status.Reason = "Can wait 1 more day";
            }
            else
            {
                // Recently completed - not needed
                status.IsRequired = false;
                status.IsOptional = false;
                status.Reason = "Recently completed";
            }
        }

        return status;
    }

    private async Task<HabitStatus> CalculateWeeklyHabitStatus(Habit habit, DateTime date, List<HabitCompletion> allCompletions, HabitStatus status)
    {
        var weekStart = GetWeekStart(date);
        var weekEnd = weekStart.AddDays(6);

        var thisWeekCompletions = allCompletions
            .Where(c => c.HabitId == habit.Id && c.IsCompleted && c.Date >= weekStart && c.Date <= weekEnd)
            .Count();

        var daysRemainingInWeek = (weekEnd - date).Days + 1;
        var completionsNeeded = habit.WeeklyTarget - thisWeekCompletions;

        if (completionsNeeded <= 0)
        {
            // Target already met
            status.IsRequired = false;
            status.IsOptional = false;
            status.Reason = $"Weekly target met ({thisWeekCompletions}/{habit.WeeklyTarget})";
        }
        else if (completionsNeeded > daysRemainingInWeek)
        {
            // Impossible to meet target
            status.IsRequired = false;
            status.IsOptional = true;
            status.UrgencyLevel = UrgencyLevel.Low;
            status.Reason = $"Weekly target impossible ({thisWeekCompletions}/{habit.WeeklyTarget})";
        }
        else if (completionsNeeded == daysRemainingInWeek)
        {
            // Must do every remaining day
            status.IsRequired = true;
            status.UrgencyLevel = UrgencyLevel.Critical;
            status.Reason = $"Need {completionsNeeded} more in {daysRemainingInWeek} days";
        }
        else if (completionsNeeded == daysRemainingInWeek - 1)
        {
            // Getting urgent
            status.IsRequired = true;
            status.UrgencyLevel = UrgencyLevel.Urgent;
            status.Reason = $"Need {completionsNeeded} more in {daysRemainingInWeek} days";
        }
        else
        {
            // Optional for now
            status.IsOptional = true;
            status.UrgencyLevel = UrgencyLevel.Normal;
            status.Reason = $"Need {completionsNeeded} more in {daysRemainingInWeek} days";
        }

        return status;
    }

    private async Task<HabitStatus> CalculateMonthlyHabitStatus(Habit habit, DateTime date, List<HabitCompletion> allCompletions, HabitStatus status)
    {
        var monthStart = new DateTime(date.Year, date.Month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var thisMonthCompletions = allCompletions
            .Where(c => c.HabitId == habit.Id && c.IsCompleted && c.Date >= monthStart && c.Date <= monthEnd)
            .Count();

        var daysRemainingInMonth = (monthEnd - date).Days + 1;

        if (thisMonthCompletions >= habit.MonthlyTarget)
        {
            // Target already met
            status.IsRequired = false;
            status.IsOptional = false;
            status.Reason = $"Monthly target met ({thisMonthCompletions}/{habit.MonthlyTarget})";
        }
        else if (daysRemainingInMonth <= 7)
        {
            // Getting urgent - last week of month
            status.IsRequired = true;
            status.UrgencyLevel = UrgencyLevel.Urgent;
            status.Reason = $"Month ending soon - {daysRemainingInMonth} days left";
        }
        else if (daysRemainingInMonth <= 3)
        {
            // Critical - very few days left
            status.IsRequired = true;
            status.UrgencyLevel = UrgencyLevel.Critical;
            status.Reason = $"Only {daysRemainingInMonth} days left in month!";
        }
        else
        {
            // Optional for now
            status.IsOptional = true;
            status.UrgencyLevel = UrgencyLevel.Normal;
            status.Reason = $"Can wait - {daysRemainingInMonth} days remaining";
        }

        return status;
    }

    private async Task<HabitStatus> CalculateSeasonalHabitStatus(Habit habit, DateTime date, List<HabitCompletion> allCompletions, HabitStatus status)
    {
        // Windows cleaning: March-October, 3 times per year
        var currentYear = date.Year;
        var seasonStart = new DateTime(currentYear, 3, 1); // March 1
        var seasonEnd = new DateTime(currentYear, 10, 31); // October 31

        // Check if we're in season
        if (date < seasonStart || date > seasonEnd)
        {
            status.IsRequired = false;
            status.IsOptional = false;
            status.Reason = "Out of season (March-October only)";
            return status;
        }

        var thisSeasonCompletions = allCompletions
            .Where(c => c.HabitId == habit.Id && c.IsCompleted &&
                       c.Date >= seasonStart && c.Date <= seasonEnd)
            .Count();

        var daysRemainingInSeason = (seasonEnd - date).Days + 1;
        var completionsNeeded = habit.SeasonalTarget - thisSeasonCompletions;

        if (completionsNeeded <= 0)
        {
            status.IsRequired = false;
            status.IsOptional = false;
            status.Reason = $"Seasonal target met ({thisSeasonCompletions}/{habit.SeasonalTarget})";
        }
        else if (daysRemainingInSeason <= 30)
        {
            // Getting urgent - last month of season
            status.IsRequired = true;
            status.UrgencyLevel = UrgencyLevel.Urgent;
            status.Reason = $"Season ending soon - need {completionsNeeded} more";
        }
        else if (daysRemainingInSeason <= 14)
        {
            // Critical - very few days left
            status.IsRequired = true;
            status.UrgencyLevel = UrgencyLevel.Critical;
            status.Reason = $"Only {daysRemainingInSeason} days left in season!";
        }
        else
        {
            // Optional for now
            status.IsOptional = true;
            status.UrgencyLevel = UrgencyLevel.Low;
            status.Reason = $"Seasonal - {daysRemainingInSeason} days remaining";
        }

        return status;
    }

    private async Task<bool> CanUseGraceDay(DateTime date)
    {
        var weekStart = GetWeekStart(date);
        var weekEnd = weekStart.AddDays(6);

        var graceUsedThisWeek = await _context.GraceUsages
            .CountAsync(g => g.UsedDate >= weekStart && g.UsedDate <= weekEnd);

        return graceUsedThisWeek < 1; // Max 1 grace per week
    }

    private DateTime GetWeekStart(DateTime date)
    {
        // Get Monday of the current week
        var dayOfWeek = (int)date.DayOfWeek;
        var mondayOffset = (dayOfWeek == 0) ? -6 : -(dayOfWeek - 1);
        return date.AddDays(mondayOffset);
    }
}

public class DayStatusResponse
{
    public DateTime Date { get; set; }
    public bool IsCompleted { get; set; }
    public bool IsPartiallyCompleted { get; set; }
    public bool CanUseGrace { get; set; }
    public List<HabitStatus> RequiredHabits { get; set; } = new();
    public List<HabitStatus> OptionalHabits { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public List<string> Recommendations { get; set; } = new();
}

public class HabitStatus
{
    public int HabitId { get; set; }
    public string HabitName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public bool IsRequired { get; set; }
    public bool IsOptional { get; set; }
    public bool IsLocked { get; set; } = false;
    public UrgencyLevel UrgencyLevel { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime? CompletedAt { get; set; }
}

public enum UrgencyLevel
{
    Low,
    Normal,
    Urgent,
    Critical
}