using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Services
{
    public interface IHabitCalculationService
    {
        Task<DayStatus> CalculateDayStatusAsync(DateTime date);
        Task<WeeklyProgress> GetWeeklyProgressAsync(DateTime date);
        Task<StreakCalculationResult> CalculateStreakAsync();
        Task<bool> CompleteHabitAsync(CompleteHabitRequest request);
        Task<bool> UseGraceDayAsync(UseGraceRequest request);
        Task<List<string>> GetSmartRemindersAsync();
    }

    public class HabitCalculationService : IHabitCalculationService
    {
        private readonly DisciplineDbContext _context;
        private const int GRACE_DAYS_PER_WEEK = 1;

        public HabitCalculationService(DisciplineDbContext context)
        {
            _context = context;
        }

        public async Task<DayStatus> CalculateDayStatusAsync(DateTime date)
        {
            var habits = await GetActiveHabitsForDateAsync(date);
            var dayStatus = new DayStatus { Date = date };

            foreach (var habit in habits)
            {
                var habitStatus = await CalculateHabitStatusAsync(habit, date);
                dayStatus.HabitStatuses.Add(habitStatus);
            }

            // Check if day is completed (all required habits done or grace used)
            var weeklyProgress = await GetWeeklyProgressAsync(date);
            var requiredHabits = dayStatus.HabitStatuses.Where(h => h.IsRequired && !h.IsCompleted).ToList();

            if (requiredHabits.Count == 0)
            {
                dayStatus.IsCompleted = true;
            }
            else if (requiredHabits.Count == 1 && weeklyProgress.GraceRemaining > 0)
            {
                dayStatus.CanUseGrace = true;
                dayStatus.Recommendations.Add($"You can use your weekly grace to skip: {requiredHabits.First().HabitName}");
            }

            // Generate warnings and recommendations
            await GenerateInsightsAsync(dayStatus);

            return dayStatus;
        }

        private async Task<List<Habit>> GetActiveHabitsForDateAsync(DateTime date)
        {
            var habits = await _context.Habits
                .Include(h => h.Completions)
                .Where(h => h.IsActive)
                .ToListAsync();

            return habits.Where(h => IsHabitActiveForDate(h, date)).ToList();
        }

        private bool IsHabitActiveForDate(Habit habit, DateTime date)
        {
            // Check seasonal constraints
            if (habit.StartMonth.HasValue && habit.EndMonth.HasValue)
            {
                var month = date.Month;
                return month >= habit.StartMonth.Value && month <= habit.EndMonth.Value;
            }

            return true;
        }

        private async Task<HabitStatus> CalculateHabitStatusAsync(Habit habit, DateTime date)
        {
            var status = new HabitStatus
            {
                HabitId = habit.Id,
                HabitName = habit.Name,
                RequiredWindowCount = habit.RequiredCount
            };

            switch (habit.Frequency)
            {
                case HabitFrequency.Daily:
                    await CalculateDailyHabitStatusAsync(habit, date, status);
                    break;

                case HabitFrequency.Rolling:
                    await CalculateRollingHabitStatusAsync(habit, date, status);
                    break;

                case HabitFrequency.Weekly:
                    await CalculateWeeklyHabitStatusAsync(habit, date, status);
                    break;

                case HabitFrequency.Monthly:
                    await CalculateMonthlyHabitStatusAsync(habit, date, status);
                    break;

                case HabitFrequency.Seasonal:
                    await CalculateSeasonalHabitStatusAsync(habit, date, status);
                    break;
            }

            return status;
        }

        private async Task CalculateDailyHabitStatusAsync(Habit habit, DateTime date, HabitStatus status)
        {
            var completion = await _context.HabitCompletions
                .FirstOrDefaultAsync(c => c.HabitId == habit.Id && c.Date.Date == date.Date);

            status.IsRequired = true;
            status.IsCompleted = completion?.IsCompleted ?? false;
            status.LastCompletedDate = completion?.Date;
            status.Status = status.IsCompleted ? "Completed" : "Required";
        }

        private async Task CalculateRollingHabitStatusAsync(Habit habit, DateTime date, HabitStatus status)
        {
            // For rolling habits (like dishes every 2 days), check the rolling window
            var windowStart = date.AddDays(-habit.WindowDays + 1);
            var completionsInWindow = await _context.HabitCompletions
                .Where(c => c.HabitId == habit.Id &&
                           c.Date >= windowStart &&
                           c.Date <= date &&
                           c.IsCompleted)
                .CountAsync();

            var lastCompletion = await _context.HabitCompletions
                .Where(c => c.HabitId == habit.Id && c.IsCompleted)
                .OrderByDescending(c => c.Date)
                .FirstOrDefaultAsync();

            status.CurrentWindowCount = completionsInWindow;
            status.LastCompletedDate = lastCompletion?.Date;

            // Check if we need to do this habit today
            if (lastCompletion == null)
            {
                status.IsRequired = true;
                status.Status = "First time required";
            }
            else
            {
                var daysSinceLastCompletion = (date - lastCompletion.Date).Days;
                status.IsRequired = daysSinceLastCompletion >= habit.WindowDays;
                status.Status = status.IsRequired ? "Required" : $"Optional ({daysSinceLastCompletion}/{habit.WindowDays} days)";
            }

            var todayCompletion = await _context.HabitCompletions
                .FirstOrDefaultAsync(c => c.HabitId == habit.Id && c.Date.Date == date.Date);
            status.IsCompleted = todayCompletion?.IsCompleted ?? false;
        }

        private async Task CalculateWeeklyHabitStatusAsync(Habit habit, DateTime date, HabitStatus status)
        {
            var weekStart = GetWeekStart(date);
            var weekEnd = weekStart.AddDays(6);

            var completionsThisWeek = await _context.HabitCompletions
                .Where(c => c.HabitId == habit.Id &&
                           c.Date >= weekStart &&
                           c.Date <= weekEnd &&
                           c.IsCompleted)
                .CountAsync();

            var remainingDays = (weekEnd - date).Days + 1;
            var neededCompletions = habit.RequiredCount - completionsThisWeek;

            status.CurrentWindowCount = completionsThisWeek;
            status.IsCompleted = await _context.HabitCompletions
                .AnyAsync(c => c.HabitId == habit.Id && c.Date.Date == date.Date && c.IsCompleted);

            if (neededCompletions <= 0)
            {
                status.Status = "Week target achieved";
                status.IsRequired = false;
            }
            else if (neededCompletions <= remainingDays)
            {
                status.Status = $"Need {neededCompletions} more this week";
                status.IsRequired = false; // Optional today, but needed this week
            }
            else
            {
                status.Status = "Week target impossible";
                status.IsRequired = true; // Must do today to have any chance
            }
        }

        private async Task CalculateMonthlyHabitStatusAsync(Habit habit, DateTime date, HabitStatus status)
        {
            var monthStart = new DateTime(date.Year, date.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            var completionsThisMonth = await _context.HabitCompletions
                .Where(c => c.HabitId == habit.Id &&
                           c.Date >= monthStart &&
                           c.Date <= monthEnd &&
                           c.IsCompleted)
                .CountAsync();

            status.CurrentWindowCount = completionsThisMonth;
            status.IsCompleted = await _context.HabitCompletions
                .AnyAsync(c => c.HabitId == habit.Id && c.Date.Date == date.Date && c.IsCompleted);

            var remainingDays = (monthEnd - date).Days + 1;
            var neededCompletions = habit.RequiredCount - completionsThisMonth;

            if (neededCompletions <= 0)
            {
                status.Status = "Month target achieved";
                status.IsRequired = false;
            }
            else
            {
                status.Status = $"Need {neededCompletions} more this month";
                status.IsRequired = remainingDays <= 7; // Required if less than a week left
            }
        }

        private async Task CalculateSeasonalHabitStatusAsync(Habit habit, DateTime date, HabitStatus status)
        {
            // Similar to monthly but for the seasonal period
            var seasonStart = new DateTime(date.Year, habit.StartMonth!.Value, 1);
            var seasonEnd = new DateTime(date.Year, habit.EndMonth!.Value, DateTime.DaysInMonth(date.Year, habit.EndMonth.Value));

            var completionsThisSeason = await _context.HabitCompletions
                .Where(c => c.HabitId == habit.Id &&
                           c.Date >= seasonStart &&
                           c.Date <= seasonEnd &&
                           c.IsCompleted)
                .CountAsync();

            status.CurrentWindowCount = completionsThisSeason;
            status.IsCompleted = await _context.HabitCompletions
                .AnyAsync(c => c.HabitId == habit.Id && c.Date.Date == date.Date && c.IsCompleted);

            var remainingDays = (seasonEnd - date).Days + 1;
            var neededCompletions = habit.RequiredCount - completionsThisSeason;

            if (neededCompletions <= 0)
            {
                status.Status = "Season target achieved";
                status.IsRequired = false;
            }
            else
            {
                status.Status = $"Need {neededCompletions} more this season";
                status.IsRequired = remainingDays <= 30; // Required if less than a month left
            }
        }

        public async Task<WeeklyProgress> GetWeeklyProgressAsync(DateTime date)
        {
            var weekStart = GetWeekStart(date);
            var weekEnd = weekStart.AddDays(6);

            // Count grace days used this week
            var graceUsed = await _context.DisciplineEntries
                .Where(e => e.Date >= weekStart && e.Date <= weekEnd && e.IsGraceUsed)
                .CountAsync();

            var progress = new WeeklyProgress
            {
                WeekStart = weekStart,
                WeekEnd = weekEnd,
                GraceUsed = graceUsed,
                GraceRemaining = GRACE_DAYS_PER_WEEK - graceUsed
            };

            // Get weekly habits progress
            var weeklyHabits = await _context.Habits
                .Where(h => h.Frequency == HabitFrequency.Weekly && h.IsActive)
                .ToListAsync();

            foreach (var habit in weeklyHabits)
            {
                var completedCount = await _context.HabitCompletions
                    .Where(c => c.HabitId == habit.Id &&
                               c.Date >= weekStart &&
                               c.Date <= weekEnd &&
                               c.IsCompleted)
                    .CountAsync();

                var remainingDays = (weekEnd - date).Days + 1;
                var neededCompletions = habit.RequiredCount - completedCount;

                progress.HabitProgress.Add(new HabitWeeklyStatus
                {
                    HabitId = habit.Id,
                    HabitName = habit.Name,
                    CompletedCount = completedCount,
                    RequiredCount = habit.RequiredCount,
                    RemainingDays = remainingDays,
                    IsAchievable = neededCompletions <= remainingDays,
                    Urgency = neededCompletions > remainingDays ? "Critical" :
                             neededCompletions == remainingDays ? "Urgent" : "Normal"
                });
            }

            return progress;
        }

        public async Task<List<string>> GetSmartRemindersAsync()
        {
            var today = DateTime.Today;
            var reminders = new List<string>();

            var weeklyProgress = await GetWeeklyProgressAsync(today);

            // Check for urgent weekly habits
            foreach (var habit in weeklyProgress.HabitProgress.Where(h => h.Urgency == "Critical"))
            {
                reminders.Add($"URGENT: You need {habit.RequiredCount - habit.CompletedCount} more {habit.HabitName} sessions this week!");
            }

            foreach (var habit in weeklyProgress.HabitProgress.Where(h => h.Urgency == "Urgent"))
            {
                reminders.Add($"Reminder: {habit.HabitName} - you need {habit.RequiredCount - habit.CompletedCount} more sessions in {habit.RemainingDays} days");
            }

            // Check rolling habits that are approaching their window limit
            var rollingHabits = await _context.Habits
                .Where(h => h.Frequency == HabitFrequency.Rolling && h.IsActive)
                .ToListAsync();

            foreach (var habit in rollingHabits)
            {
                var lastCompletion = await _context.HabitCompletions
                    .Where(c => c.HabitId == habit.Id && c.IsCompleted)
                    .OrderByDescending(c => c.Date)
                    .FirstOrDefaultAsync();

                if (lastCompletion != null)
                {
                    var daysSince = (today - lastCompletion.Date).Days;
                    if (daysSince >= habit.WindowDays - 1)
                    {
                        reminders.Add($"Don't forget: {habit.Name} - last done {daysSince} days ago (limit: {habit.WindowDays} days)");
                    }
                }
            }

            return reminders;
        }

        private async Task GenerateInsightsAsync(DayStatus dayStatus)
        {
            // Add specific recommendations based on habit statuses
            var criticalHabits = dayStatus.HabitStatuses.Where(h => h.Status.Contains("Critical")).ToList();
            var urgentHabits = dayStatus.HabitStatuses.Where(h => h.Status.Contains("Urgent")).ToList();

            foreach (var habit in criticalHabits)
            {
                dayStatus.Warnings.Add($"{habit.HabitName}: {habit.Status}");
            }

            foreach (var habit in urgentHabits)
            {
                dayStatus.Recommendations.Add($"Consider doing {habit.HabitName} today - {habit.Status}");
            }
        }

        public async Task<bool> CompleteHabitAsync(CompleteHabitRequest request)
        {
            var existing = await _context.HabitCompletions
                .FirstOrDefaultAsync(c => c.HabitId == request.HabitId && c.Date.Date == request.Date.Date);

            if (existing != null)
            {
                existing.IsCompleted = true;
                existing.Notes = request.Notes;
            }
            else
            {
                _context.HabitCompletions.Add(new HabitCompletion
                {
                    HabitId = request.HabitId,
                    Date = request.Date.Date,
                    IsCompleted = true,
                    Notes = request.Notes
                });
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UseGraceDayAsync(UseGraceRequest request)
        {
            var weeklyProgress = await GetWeeklyProgressAsync(request.Date);

            if (weeklyProgress.GraceRemaining <= 0)
            {
                return false; // No grace days left
            }

            // Mark the day as using grace
            var existing = await _context.DisciplineEntries
                .FirstOrDefaultAsync(e => e.Date.Date == request.Date.Date);

            if (existing != null)
            {
                existing.IsGraceUsed = true;
                existing.Notes = request.Reason;
            }
            else
            {
                _context.DisciplineEntries.Add(new DisciplineEntry
                {
                    Date = request.Date.Date,
                    IsCompleted = true, // Grace day counts as completed
                    IsGraceUsed = true,
                    Notes = request.Reason
                });
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<StreakCalculationResult> CalculateStreakAsync()
        {
            var completedDays = await _context.DisciplineEntries
                .Where(e => e.IsCompleted)
                .OrderBy(e => e.Date)
                .ToListAsync();

            var result = new StreakCalculationResult();

            if (!completedDays.Any())
            {
                return result;
            }

            // Calculate current streak
            var today = DateTime.Today;
            var currentStreak = 0;

            for (var date = today; date >= completedDays.First().Date; date = date.AddDays(-1))
            {
                if (completedDays.Any(d => d.Date.Date == date.Date))
                {
                    currentStreak++;
                }
                else
                {
                    break;
                }
            }

            result.CurrentStreak = currentStreak;
            result.LastCompletedDate = completedDays.LastOrDefault()?.Date;

            // Calculate longest streak
            var longestStreak = 0;
            var tempStreak = 1;

            for (int i = 1; i < completedDays.Count; i++)
            {
                if (completedDays[i].Date.Date == completedDays[i - 1].Date.AddDays(1))
                {
                    tempStreak++;
                }
                else
                {
                    longestStreak = Math.Max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
            result.LongestStreak = Math.Max(longestStreak, tempStreak);

            return result;
        }

        private DateTime GetWeekStart(DateTime date)
        {
            var diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
            return date.AddDays(-1 * diff).Date;
        }
    }
}