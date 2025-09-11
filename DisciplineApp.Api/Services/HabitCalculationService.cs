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
            var dayStatus = new DayStatus { Date = date };

            // For September 2025:
            // - Days 1-11: Return empty (no tasks, not completed)
            // - Days 12-30: Generate tasks according to schedule
            // - Other months: Return empty

            if (date.Year != 2025 || date.Month != 9)
            {
                // Not September 2025 - return empty
                return dayStatus;
            }

            if (date.Day < 12)
            {
                // September 1-11: Return empty (not completed, no tasks)
                dayStatus.IsCompleted = false;
                dayStatus.IsGraceUsed = false;
                dayStatus.CanUseGrace = false;
                return dayStatus;
            }

            // September 12-30: Generate tasks
            var requiredHabits = GetRequiredHabitsForDate(date);

            foreach (var habitInfo in requiredHabits)
            {
                var habitStatus = await GetHabitStatusAsync(habitInfo.HabitId, habitInfo.HabitName, date);
                dayStatus.HabitStatuses.Add(habitStatus);
            }

            // Calculate day completion
            var requiredCount = dayStatus.HabitStatuses.Count(h => h.IsRequired);
            var completedCount = dayStatus.HabitStatuses.Count(h => h.IsRequired && h.IsCompleted);

            dayStatus.IsCompleted = requiredCount > 0 && completedCount == requiredCount;

            return dayStatus;
        }
        private List<(int HabitId, string HabitName)> GetRequiredHabitsForDate(DateTime date)
        {
            var required = new List<(int HabitId, string HabitName)>();

            // Only for September 12-30, 2025
            if (date.Year != 2025 || date.Month != 9 || date.Day < 12)
            {
                return required; // Return empty list
            }

            // Phone Lock - EVERY DAY from Sept 12 onwards
            required.Add((1, "Lock Phone in Box"));

            // Dishes - Every 2 days starting Sept 12
            // Sept 12 = Day 0, Sept 14 = Day 2, Sept 16 = Day 4, etc.
            var daysSinceSept12 = date.Day - 12;
            if (daysSinceSept12 % 2 == 0)
            {
                required.Add((2, "Clean Dishes/Sink"));
            }

            // Weekly tasks based on day of week
            var dayOfWeek = date.DayOfWeek;

            // Gym - Monday, Wednesday, Friday, Saturday
            if (dayOfWeek == DayOfWeek.Monday || dayOfWeek == DayOfWeek.Wednesday ||
                dayOfWeek == DayOfWeek.Friday || dayOfWeek == DayOfWeek.Saturday)
            {
                required.Add((4, "Gym Workout"));
            }

            // Vacuum - Tuesday, Friday  
            if (dayOfWeek == DayOfWeek.Tuesday || dayOfWeek == DayOfWeek.Friday)
            {
                required.Add((3, "Vacuum/Sweep Floors"));
            }

            // Bathroom - Sunday
            if (dayOfWeek == DayOfWeek.Sunday)
            {
                required.Add((5, "Clean Bathroom"));
            }

            // Kitchen - Sept 25 only
            if (date.Day == 25)
            {
                required.Add((6, "Kitchen Deep Clean"));
            }

            return required;
        }

        private async Task<HabitStatus> GetHabitStatusAsync(int habitId, string habitName, DateTime date)
        {
            var completion = await _context.HabitCompletions
                .FirstOrDefaultAsync(c => c.HabitId == habitId && c.Date.Date == date.Date);

            return new HabitStatus
            {
                HabitId = habitId,
                HabitName = habitName,
                IsRequired = true, // All habits returned by GetRequiredHabitsForDate are required
                IsCompleted = completion?.IsCompleted ?? false,
                Status = completion?.IsCompleted == true ? "Completed" : "Required",
                LastCompletedDate = completion?.Date
            };
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

            // Daily habits (Phone Lock) - ALWAYS required every single day
            status.IsRequired = true;
            status.IsCompleted = completion?.IsCompleted ?? false;
            status.LastCompletedDate = completion?.Date;
            status.Status = status.IsCompleted ? "Completed" : "Required daily";
        }

        private async Task CalculateRollingHabitStatusAsync(Habit habit, DateTime date, HabitStatus status)
        {
            // Check if completed today
            var todayCompletion = await _context.HabitCompletions
                .FirstOrDefaultAsync(c => c.HabitId == habit.Id && c.Date.Date == date.Date);
            status.IsCompleted = todayCompletion?.IsCompleted ?? false;

            // ✅ SIMPLE APPROACH: Fixed pattern based on date
            // For dishes (WindowDays = 2), show every 2 days starting from a reference date

            // Use a fixed reference date (e.g., Jan 1, 2025)
            var referenceDate = new DateTime(2025, 1, 1);
            var daysSinceReference = (date.Date - referenceDate).Days;

            // Required every WindowDays (e.g., every 2 days)
            // This creates pattern: Day 0=Required, Day 1=Not, Day 2=Required, Day 3=Not, etc.
            bool isRequiredToday = (daysSinceReference % habit.WindowDays) == 0;

            status.IsRequired = isRequiredToday;
            status.Status = isRequiredToday ? "Required (scheduled)" : $"Not scheduled (next in {habit.WindowDays - (daysSinceReference % habit.WindowDays)} days)";

            // Set some default values
            status.CurrentWindowCount = status.IsCompleted ? 1 : 0;
            status.LastCompletedDate = status.IsCompleted ? date : null;
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

            var todayCompletion = await _context.HabitCompletions
                .FirstOrDefaultAsync(c => c.HabitId == habit.Id && c.Date.Date == date.Date);
            status.IsCompleted = todayCompletion?.IsCompleted ?? false;

            var remainingDaysInWeek = (weekEnd - date).Days + 1;
            var stillNeeded = habit.RequiredCount - completionsThisWeek;

            status.CurrentWindowCount = completionsThisWeek;

            // ✅ SIMPLE LOGIC: Only required when becoming impossible to meet weekly target
            if (stillNeeded <= 0)
            {
                // Already met weekly target
                status.IsRequired = false;
                status.Status = $"Week complete ({completionsThisWeek}/{habit.RequiredCount})";
            }
            else if (stillNeeded > remainingDaysInWeek)
            {
                // Impossible to meet target - too late
                status.IsRequired = false;
                status.Status = $"Week target missed ({completionsThisWeek}/{habit.RequiredCount})";
            }
            else if (stillNeeded == remainingDaysInWeek)
            {
                // Must do EVERY remaining day - REQUIRED
                status.IsRequired = true;
                status.Status = $"CRITICAL: Must do every remaining day ({stillNeeded} left)";
            }
            else
            {
                // Still have flexibility - NOT REQUIRED
                status.IsRequired = false;
                status.Status = $"Optional: {stillNeeded} needed in {remainingDaysInWeek} days";
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

            var todayCompletion = await _context.HabitCompletions
                .FirstOrDefaultAsync(c => c.HabitId == habit.Id && c.Date.Date == date.Date);
            status.IsCompleted = todayCompletion?.IsCompleted ?? false;

            var remainingDaysInMonth = (monthEnd - date).Days + 1;
            var stillNeeded = habit.RequiredCount - completionsThisMonth;

            status.CurrentWindowCount = completionsThisMonth;

            // ✅ SIMPLE LOGIC: Only required in last few days of month
            if (stillNeeded <= 0)
            {
                // Already completed this month
                status.IsRequired = false;
                status.Status = "Month target complete";
            }
            else if (remainingDaysInMonth <= 3)
            {
                // Last 3 days of month - REQUIRED
                status.IsRequired = true;
                status.Status = $"URGENT: {stillNeeded} needed, only {remainingDaysInMonth} days left";
            }
            else
            {
                // Still plenty of time - NOT REQUIRED
                status.IsRequired = false;
                status.Status = $"Optional: {stillNeeded} needed this month";
            }
        }

        private async Task CalculateSeasonalHabitStatusAsync(Habit habit, DateTime date, HabitStatus status)
        {
            // Check if we're in the active season
            if (habit.StartMonth.HasValue && habit.EndMonth.HasValue)
            {
                var currentMonth = date.Month;
                var isInSeason = currentMonth >= habit.StartMonth.Value && currentMonth <= habit.EndMonth.Value;

                if (!isInSeason)
                {
                    // Out of season - NEVER required
                    status.Status = "Out of season";
                    status.IsRequired = false;
                    status.IsCompleted = false;
                    return;
                }
            }

            // Calculate seasonal window (March to October = 8 months)
            var seasonStart = new DateTime(date.Year, habit.StartMonth ?? 1, 1);
            var seasonEnd = new DateTime(date.Year, habit.EndMonth ?? 12,
                DateTime.DaysInMonth(date.Year, habit.EndMonth ?? 12));

            var completionsThisSeason = await _context.HabitCompletions
                .Where(c => c.HabitId == habit.Id &&
                           c.Date >= seasonStart &&
                           c.Date <= seasonEnd &&
                           c.IsCompleted)
                .CountAsync();

            var todayCompletion = await _context.HabitCompletions
                .FirstOrDefaultAsync(c => c.HabitId == habit.Id && c.Date.Date == date.Date);
            status.IsCompleted = todayCompletion?.IsCompleted ?? false;

            var remainingDaysInSeason = (seasonEnd - date).Days + 1;
            var stillNeeded = habit.RequiredCount - completionsThisSeason;

            status.CurrentWindowCount = completionsThisSeason;

            // ✅ SIMPLE LOGIC: Only required when season is ending and target not met
            if (stillNeeded <= 0)
            {
                // Already completed seasonal target (e.g., 3 window cleanings done)
                status.IsRequired = false;
                status.Status = $"Season complete ({completionsThisSeason}/{habit.RequiredCount})";
            }
            else if (remainingDaysInSeason <= 14)
            {
                // Last 2 weeks of season - REQUIRED
                status.IsRequired = true;
                status.Status = $"URGENT: {stillNeeded} needed, season ends in {remainingDaysInSeason} days";
            }
            else if (remainingDaysInSeason <= 30)
            {
                // Last month of season - recommended but not required
                status.IsRequired = false;
                status.Status = $"Recommended: {stillNeeded} needed, season ends soon";
            }
            else
            {
                // Plenty of time left in season - NOT REQUIRED
                status.IsRequired = false;
                status.Status = $"Optional: {stillNeeded} needed this season";
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

            if (request.IsCompleted)
            {
                // User is CHECKING the task - mark as completed
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
            }
            else
            {
                // User is UNCHECKING the task - mark as not completed or delete
                if (existing != null)
                {
                    // Option 1: Set to false (keeps the record)
                    existing.IsCompleted = false;
                    existing.Notes = request.Notes;

                    // Option 2: Delete the record entirely (cleaner approach)
                    // _context.HabitCompletions.Remove(existing);
                }
                // If no existing record and user is unchecking, do nothing
            }

            await _context.SaveChangesAsync();
            return true;
        }

        private DateTime GetWeekStart(DateTime date)
        {
            var diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
            return date.AddDays(-1 * diff).Date;
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
    }

}