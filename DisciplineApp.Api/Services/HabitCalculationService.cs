using Microsoft.EntityFrameworkCore;
using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;

namespace DisciplineApp.Api.Services
{
    public interface IHabitCalculationService
    {
        Task<DayStatusDto> CalculateDayStatusAsync(DateOnly date);
        Task<List<HabitStatusDto>> GetHabitStatusesForDateAsync(DateOnly date);
        Task<bool> CompleteHabitAsync(int habitId, DateOnly date, string? notes = null);
        Task<WeekStatusDto> GetWeekStatusAsync(DateOnly weekStartDate);
        Task<List<string>> GetSmartRemindersAsync(DateOnly date);
        Task<GracePeriodStatusDto> GetGracePeriodStatusAsync();
    }

    public class HabitCalculationService : IHabitCalculationService
    {
        private readonly DisciplineDbContext _context;
        private readonly ILogger<HabitCalculationService> _logger;

        public HabitCalculationService(DisciplineDbContext context, ILogger<HabitCalculationService> logger)
        {
            _context = context;
            _logger = logger;
        }

        // In your HabitCalculationService.cs, update the CalculateDayStatusAsync method

        public async Task<DayStatusDto> CalculateDayStatusAsync(DateOnly date)
        {
            try
            {
                var habitStatuses = await GetHabitStatusesForDateAsync(date);
                var reminders = await GetSmartRemindersAsync(date);

                var requiredHabits = habitStatuses.Where(h => h.IsRequired).ToList();
                var completedRequiredHabits = requiredHabits.Where(h => h.IsCompleted).ToList();

                // KEY FIX: Don't mark current day as failed if incomplete
                var today = DateHelper.GetToday();
                var status = DayCompletionStatus.Incomplete;

                if (completedRequiredHabits.Count == requiredHabits.Count)
                {
                    status = DayCompletionStatus.Complete;
                }
                else if (completedRequiredHabits.Any())
                {
                    status = DayCompletionStatus.Partial;
                }
                else if (date < today) // Only past days can be marked as truly "failed"
                {
                    status = DayCompletionStatus.Incomplete; // or create a new "Failed" status
                }
                else // Current day or future days
                {
                    status = DayCompletionStatus.Incomplete; // Should not show as failed
                }

                return new DayStatusDto
                {
                    Date = DateHelper.ToDateString(date),
                    Status = status,
                    HabitStatuses = habitStatuses,
                    CompletionPercentage = requiredHabits.Any()
                        ? (int)((double)completedRequiredHabits.Count / requiredHabits.Count * 100)
                        : 100,
                    Reminders = reminders,
                    CanUseGrace = await CanUseGraceAsync(date),
                    IsToday = date == today, // Add this flag for frontend to use
                    IsPastDay = date < today  // Add this flag too
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating day status for {Date}", date);
                throw;
            }
        }

        public async Task<List<HabitStatusDto>> GetHabitStatusesForDateAsync(DateOnly date)
        {
            var habits = await _context.Set<Habit>().ToListAsync();
            var habitStatuses = new List<HabitStatusDto>();

            foreach (var habit in habits)
            {
                var status = await CalculateHabitStatusAsync(habit, date);
                habitStatuses.Add(status);
            }

            return habitStatuses;
        }

        public async Task<bool> CompleteHabitAsync(int habitId, DateOnly date, string? notes = null)
        {
            try
            {
                var existingCompletion = await _context.Set<HabitCompletion>()
                    .FirstOrDefaultAsync(hc => hc.HabitId == habitId && hc.Date == date);

                if (existingCompletion != null)
                {
                    // Instead of returning false, remove the completion (toggle off)
                    _context.Set<HabitCompletion>().Remove(existingCompletion);
                    _logger.LogInformation("Uncompleted habit {HabitId} for date {Date}", habitId, date);
                }
                else
                {
                    // Add new completion (toggle on)
                    var completion = new HabitCompletion
                    {
                        HabitId = habitId,
                        Date = date,
                        CompletedAt = DateTime.UtcNow,
                        Notes = notes,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Set<HabitCompletion>().Add(completion);
                    _logger.LogInformation("Completed habit {HabitId} for date {Date}", habitId, date);
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling habit {HabitId} for date {Date}", habitId, date);
                return false;
            }
        }

        public async Task<WeekStatusDto> GetWeekStatusAsync(DateOnly weekStartDate)
        {
            // Ensure we start from Monday
            var mondayDate = weekStartDate.AddDays(-(int)weekStartDate.DayOfWeek + 1);
            var weekEndDate = mondayDate.AddDays(6);

            var weekStatus = new WeekStatusDto
            {
                WeekStartDate = DateHelper.ToDateString(mondayDate),
                WeekEndDate = DateHelper.ToDateString(weekEndDate),
                DayStatuses = new List<DayStatusDto>()
            };

            for (var date = mondayDate; date <= weekEndDate; date = date.AddDays(1))
            {
                var dayStatus = await CalculateDayStatusAsync(date);
                weekStatus.DayStatuses.Add(dayStatus);
            }

            // Calculate week-level metrics
            var weeklyHabits = await _context.Set<Habit>()
                .Where(h => h.Category == HabitCategory.Weekly)
                .ToListAsync();

            weekStatus.WeeklyHabitProgress = new List<WeeklyHabitProgressDto>();

            foreach (var habit in weeklyHabits)
            {
                var completions = await _context.Set<HabitCompletion>()
                    .Where(hc => hc.HabitId == habit.Id && hc.Date >= mondayDate && hc.Date <= weekEndDate)
                    .CountAsync();

                var progress = new WeeklyHabitProgressDto
                {
                    HabitId = habit.Id,
                    HabitName = habit.Name,
                    RequiredCount = habit.RequiredCount,
                    CompletedCount = completions,
                    IsOnTrack = completions >= habit.RequiredCount,
                    DaysRemaining = Math.Max(0, (weekEndDate.DayNumber - DateHelper.GetToday().DayNumber))
                };

                // Calculate if still achievable
                var remainingDays = Math.Max(0, weekEndDate.DayNumber - DateHelper.GetToday().DayNumber + 1);
                var remainingNeeded = Math.Max(0, habit.RequiredCount - completions);
                progress.IsStillAchievable = remainingNeeded <= remainingDays;

                weekStatus.WeeklyHabitProgress.Add(progress);
            }

            return weekStatus;
        }

        public async Task<List<string>> GetSmartRemindersAsync(DateOnly date)
        {
            var reminders = new List<string>();
            var today = DateHelper.GetToday();

            // Only generate reminders for today or future dates
            if (date < today)
                return reminders;

            var habits = await _context.Set<Habit>().Where(h => h.IsRequired).ToListAsync();

            foreach (var habit in habits)
            {
                var reminderText = await GenerateHabitReminderAsync(habit, date);
                if (!string.IsNullOrEmpty(reminderText))
                {
                    reminders.Add(reminderText);
                }
            }

            return reminders;
        }

        public async Task<GracePeriodStatusDto> GetGracePeriodStatusAsync()
        {
            var today = DateHelper.GetToday();
            var weekStart = today.AddDays(-(int)today.DayOfWeek + 1); // Monday

            // Get grace usage for current week
            var graceUsedThisWeek = await _context.Set<GraceUsage>()
                .Where(gu => gu.Date >= weekStart && gu.Date <= today)
                .CountAsync();

            return new GracePeriodStatusDto
            {
                WeekStartDate = DateHelper.ToDateString(weekStart),
                GraceAllowance = 1, // One grace per week
                GraceUsed = graceUsedThisWeek,
                GraceRemaining = Math.Max(0, 1 - graceUsedThisWeek),
                CanUseGrace = graceUsedThisWeek < 1
            };
        }

        // Private helper methods

        private async Task<HabitStatusDto> CalculateHabitStatusAsync(Habit habit, DateOnly date)
        {
            var isCompleted = await IsHabitCompletedForDateAsync(habit.Id, date);
            var isRequired = await IsHabitRequiredForDateAsync(habit, date);
            var urgency = await CalculateHabitUrgencyAsync(habit, date);

            return new HabitStatusDto
            {
                HabitId = habit.Id,
                HabitName = habit.Name,
                Description = habit.Description,
                Category = habit.Category.ToString(),
                IsCompleted = isCompleted,
                IsRequired = isRequired,
                UrgencyLevel = urgency,
                CompletionWindow = await CalculateCompletionWindowAsync(habit, date)
            };
        }

        private async Task<bool> IsHabitCompletedForDateAsync(int habitId, DateOnly date)
        {
            return await _context.Set<HabitCompletion>()
                .AnyAsync(hc => hc.HabitId == habitId && hc.Date == date);
        }

        private async Task<bool> IsHabitRequiredForDateAsync(Habit habit, DateOnly date)
        {
            switch (habit.Category)
            {
                case HabitCategory.Daily:
                    return true; // Daily habits are always required

                case HabitCategory.Rolling:
                    // Check if we need to complete within the rolling window
                    var windowStart = date.AddDays(-habit.WindowDays + 1);
                    var completionsInWindow = await _context.Set<HabitCompletion>()
                        .Where(hc => hc.HabitId == habit.Id && hc.Date >= windowStart && hc.Date <= date)
                        .CountAsync();
                    return completionsInWindow < habit.RequiredCount;

                case HabitCategory.Weekly:
                    // Required if we haven't met weekly target and still have time
                    var weekStart = date.AddDays(-(int)date.DayOfWeek + 1);
                    var weekEnd = weekStart.AddDays(6);
                    var weeklyCompletions = await _context.Set<HabitCompletion>()
                        .Where(hc => hc.HabitId == habit.Id && hc.Date >= weekStart && hc.Date <= date)
                        .CountAsync();
                    return weeklyCompletions < habit.RequiredCount;

                case HabitCategory.Seasonal:
                    // Check if we're in the seasonal period
                    if (!string.IsNullOrEmpty(habit.SeasonalMonths))
                    {
                        var months = habit.SeasonalMonths.Split(',')
                            .Select(m => int.TryParse(m, out var month) ? month : 0)
                            .Where(m => m > 0)
                            .ToList();

                        return months.Contains(date.Month);
                    }
                    break;
            }

            return habit.IsRequired;
        }

        private async Task<UrgencyLevel> CalculateHabitUrgencyAsync(Habit habit, DateOnly date)
        {
            if (await IsHabitCompletedForDateAsync(habit.Id, date))
                return UrgencyLevel.Complete;

            switch (habit.Category)
            {
                case HabitCategory.Daily:
                    return UrgencyLevel.Normal;

                case HabitCategory.Weekly:
                    var weekStart = date.AddDays(-(int)date.DayOfWeek + 1);
                    var weekEnd = weekStart.AddDays(6);
                    var daysLeftInWeek = (weekEnd.DayNumber - date.DayNumber);

                    var weeklyCompletions = await _context.Set<HabitCompletion>()
                        .Where(hc => hc.HabitId == habit.Id && hc.Date >= weekStart && hc.Date < date)
                        .CountAsync();

                    var remainingNeeded = habit.RequiredCount - weeklyCompletions;

                    if (remainingNeeded > daysLeftInWeek + 1)
                        return UrgencyLevel.Critical;
                    if (remainingNeeded > daysLeftInWeek / 2)
                        return UrgencyLevel.Urgent;
                    return UrgencyLevel.Normal;

                case HabitCategory.Rolling:
                    var windowStart = date.AddDays(-habit.WindowDays + 1);
                    var completionsInWindow = await _context.Set<HabitCompletion>()
                        .Where(hc => hc.HabitId == habit.Id && hc.Date >= windowStart && hc.Date < date)
                        .CountAsync();

                    if (completionsInWindow == 0 && habit.WindowDays - 1 <= 1)
                        return UrgencyLevel.Critical;

                    return UrgencyLevel.Normal;
            }

            return UrgencyLevel.Normal;
        }

        private async Task<string> CalculateCompletionWindowAsync(Habit habit, DateOnly date)
        {
            switch (habit.Category)
            {
                case HabitCategory.Daily:
                    return "Today";

                case HabitCategory.Weekly:
                    var weekStart = date.AddDays(-(int)date.DayOfWeek + 1);
                    var weekEnd = weekStart.AddDays(6);
                    return $"This week ({DateHelper.ToDateString(weekStart)} - {DateHelper.ToDateString(weekEnd)})";

                case HabitCategory.Rolling:
                    var windowStart = date.AddDays(-habit.WindowDays + 1);
                    return $"Rolling {habit.WindowDays} days ({DateHelper.ToDateString(windowStart)} - {DateHelper.ToDateString(date)})";

                case HabitCategory.Monthly:
                    var monthStart = new DateOnly(date.Year, date.Month, 1);
                    var monthEnd = monthStart.AddMonths(1).AddDays(-1);
                    return $"This month ({DateHelper.ToDateString(monthStart)} - {DateHelper.ToDateString(monthEnd)})";

                default:
                    return "Unknown";
            }
        }

        private async Task<string> GenerateHabitReminderAsync(Habit habit, DateOnly date)
        {
            if (await IsHabitCompletedForDateAsync(habit.Id, date))
                return string.Empty;

            var urgency = await CalculateHabitUrgencyAsync(habit, date);

            switch (urgency)
            {
                case UrgencyLevel.Critical:
                    return $"🚨 CRITICAL: {habit.Name} - You must complete this today to maintain your streak!";

                case UrgencyLevel.Urgent:
                    return $"⚠️ URGENT: {habit.Name} - Complete soon to stay on track!";

                case UrgencyLevel.Normal:
                    return $"📋 {habit.Name} - Don't forget to complete this today";

                default:
                    return string.Empty;
            }
        }

        private async Task<bool> CanUseGraceAsync(DateOnly date)
        {
            var gracePeriod = await GetGracePeriodStatusAsync();
            return gracePeriod.CanUseGrace;
        }
    }
}