using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using DisciplineApp.Api.Services;
using System.Data.Entity;

public class DailyStatsService : IDailyStatsService
{
    private readonly DisciplineDbContext _context;
    private readonly WeeklyScheduleService _scheduleService;

    public DailyStatsService(DisciplineDbContext context, WeeklyScheduleService scheduleService)
    {
        _context = context;
        _scheduleService = scheduleService;
    }

    public async Task<DailyStats> CalculateAndStoreDailyStatsAsync(DateTime date)
    {
        Console.WriteLine($"📊 Calculating daily stats for {date:yyyy-MM-dd}");

        // Check if stats already exist
        var existingStats = await _context.DailyStats
            .FirstOrDefaultAsync(d => d.Date.Date == date.Date);

        // Generate the schedule for this day to know what tasks were supposed to be done
        var weekStart = GetWeekStart(date);
        var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);
        var daySchedule = weekSchedule.DailySchedules.FirstOrDefault(d => d.Date.Date == date.Date);

        // Get actual completions for this day
        var completions = await _context.HabitCompletions
            .Where(c => c.Date.Date == date.Date)
            .ToListAsync();

        var adHocTasks = await _context.AdHocTasks
            .Where(t => t.Date.Date == date.Date)
            .ToListAsync();

        // Calculate basic stats
        var totalTasks = (daySchedule?.ScheduledHabits.Count ?? 0) + adHocTasks.Count;
        var completedTasks = completions.Count(c => c.IsCompleted) + adHocTasks.Count(t => t.IsCompleted);

        var requiredTasks = (daySchedule?.ScheduledHabits.Count(h => h.IsRequired) ?? 0) + adHocTasks.Count;
        var completedRequiredTasks = 0;

        // Count completed required scheduled habits
        if (daySchedule != null)
        {
            foreach (var scheduledHabit in daySchedule.ScheduledHabits.Where(h => h.IsRequired))
            {
                var completion = completions.FirstOrDefault(c => c.HabitId == scheduledHabit.HabitId);
                if (completion?.IsCompleted == true)
                {
                    completedRequiredTasks++;
                }
            }
        }

        // Count completed ad-hoc tasks (all considered required)
        completedRequiredTasks += adHocTasks.Count(t => t.IsCompleted);

        // ✅ CALCULATE STREAK CONTEXT AND COMPLETION RULES
        var streakLength = await GetCurrentStreakLengthAsync(date);
        var streakDayNumber = streakLength + 1; // What day this would be if completed
        var isInFirst7Days = streakDayNumber <= 7;

        // ✅ APPLY STREAK-BASED COMPLETION RULES
        bool isDayCompleted;
        string completionRules;

        if (isInFirst7Days)
        {
            // First 7 days: Only need Phone Lock Box
            var phoneLockCompletion = await _context.HabitCompletions
                .Include(c => c.Habit)
                .FirstOrDefaultAsync(c => c.Date.Date == date.Date &&
                                   c.Habit.Name.Contains("Phone Lock") &&
                                   c.IsCompleted);

            isDayCompleted = phoneLockCompletion != null;
            completionRules = "First7Days:PhoneLockOnly";

            Console.WriteLine($"📱 Day {streakDayNumber} (First 7): Phone Lock = {isDayCompleted}");
        }
        else
        {
            // After 7 days: Need all required tasks
            isDayCompleted = requiredTasks > 0 && completedRequiredTasks == requiredTasks;
            completionRules = "Post7Days:AllRequiredTasks";

            Console.WriteLine($"📋 Day {streakDayNumber} (Post 7): {completedRequiredTasks}/{requiredTasks} required = {isDayCompleted}");
        }

        var completionPercentage = totalTasks > 0 ? Math.Round((decimal)completedTasks / totalTasks * 100, 2) : 0;

        // Create or update stats
        if (existingStats != null)
        {
            // Update existing
            existingStats.TotalTasks = totalTasks;
            existingStats.CompletedTasks = completedTasks;
            existingStats.RequiredTasks = requiredTasks;
            existingStats.CompletedRequiredTasks = completedRequiredTasks;
            existingStats.IsDayCompleted = isDayCompleted;
            existingStats.StreakDayNumber = streakDayNumber;
            existingStats.IsInFirst7Days = isInFirst7Days;
            existingStats.CompletionPercentage = completionPercentage;
            existingStats.CompletionRules = completionRules;
            existingStats.CalculatedAt = DateTime.UtcNow;

            Console.WriteLine($"🔄 Updated stats for {date:yyyy-MM-dd}");
        }
        else
        {
            // Create new
            existingStats = new DailyStats
            {
                Date = date.Date,
                TotalTasks = totalTasks,
                CompletedTasks = completedTasks,
                RequiredTasks = requiredTasks,
                CompletedRequiredTasks = completedRequiredTasks,
                IsDayCompleted = isDayCompleted,
                StreakDayNumber = streakDayNumber,
                IsInFirst7Days = isInFirst7Days,
                CompletionPercentage = completionPercentage,
                CompletionRules = completionRules,
                CalculatedAt = DateTime.UtcNow
            };

            _context.DailyStats.Add(existingStats);
            Console.WriteLine($"✨ Created new stats for {date:yyyy-MM-dd}");
        }

        await _context.SaveChangesAsync();

        Console.WriteLine($"💾 Stored daily stats: {completedTasks}/{totalTasks} tasks, day completed: {isDayCompleted}");
        return existingStats;
    }

    public async Task<DailyStats?> GetStoredDailyStatsAsync(DateTime date)
    {
        return await _context.DailyStats
            .FirstOrDefaultAsync(d => d.Date.Date == date.Date);
    }

    public async Task<List<DailyStats>> GetMonthlyStatsAsync(int year, int month)
    {
        var monthStart = new DateTime(year, month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var storedStats = await _context.DailyStats
            .Where(d => d.Date >= monthStart && d.Date <= monthEnd)
            .OrderBy(d => d.Date)
            .ToListAsync();

        Console.WriteLine($"📅 Retrieved {storedStats.Count} stored daily stats for {month}/{year}");
        return storedStats;
    }

    public async Task<bool> AreStatsStoredForDate(DateTime date)
    {
        return await _context.DailyStats
            .AnyAsync(d => d.Date.Date == date.Date);
    }

    public async Task RecalculateStatsForPeriodAsync(DateTime startDate, DateTime endDate)
    {
        Console.WriteLine($"🔄 Recalculating stats from {startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}");

        var recalculatedCount = 0;
        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            await CalculateAndStoreDailyStatsAsync(date);
            recalculatedCount++;
        }

        Console.WriteLine($"✅ Recalculated {recalculatedCount} daily stats");
    }

    public async Task<int> GetCurrentStreakLengthAsync(DateTime asOfDate)
    {
        // Get all completed days up to the specified date, ordered by date descending
        var completedDays = await _context.DailyStats
            .Where(d => d.Date < asOfDate.Date && d.IsDayCompleted)
            .OrderByDescending(d => d.Date)
            .Select(d => d.Date)
            .ToListAsync();

        if (!completedDays.Any())
        {
            return 0;
        }

        // Count consecutive completed days working backwards from the most recent
        var streak = 0;
        var expectedDate = asOfDate.Date.AddDays(-1); // Start checking from yesterday

        foreach (var completedDate in completedDays)
        {
            if (completedDate.Date == expectedDate.Date)
            {
                streak++;
                expectedDate = expectedDate.AddDays(-1);
            }
            else
            {
                // Gap found, streak is broken
                break;
            }
        }

        Console.WriteLine($"📊 Current streak as of {asOfDate:yyyy-MM-dd}: {streak} days");
        return streak;
    }

    private DateTime GetWeekStart(DateTime date)
    {
        var dayOfWeek = (int)date.DayOfWeek;
        var mondayOffset = (dayOfWeek == 0) ? -6 : -(dayOfWeek - 1);
        return date.AddDays(mondayOffset);
    }
}
