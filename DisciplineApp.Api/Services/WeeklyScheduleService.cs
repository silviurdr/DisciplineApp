using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Services;

public class WeeklyScheduleService
{
    private readonly DisciplineDbContext _context;

    public WeeklyScheduleService(DisciplineDbContext context)
    {
        _context = context;
    }

    public async Task<WeekSchedule> GenerateWeekSchedule(DateTime weekStart)
    {
        var habits = await _context.Habits.Where(h => h.IsActive).ToListAsync();
        var schedule = new WeekSchedule
        {
            WeekStart = weekStart,
            WeekEnd = weekStart.AddDays(6),
            DailySchedules = new List<DailySchedule>()
        };

        // Initialize 7 days
        for (int i = 0; i < 7; i++)
        {
            var date = weekStart.AddDays(i);
            schedule.DailySchedules.Add(new DailySchedule
            {
                Date = date,
                ScheduledHabits = new List<ScheduledHabit>()
            });
        }

        // Get recent completion history AND deferrals for smart scheduling
        var recentCompletions = await GetRecentCompletions(weekStart);
        var weekDeferrals = await GetWeekDeferrals(weekStart); // NEW

        // Apply deferred tasks first (highest priority)
        await ApplyDeferredTasks(schedule, weekDeferrals); // NEW

        // Then assign regular habits by type (excluding already deferred tasks)
        await AssignDailyHabits(schedule, habits, weekDeferrals);
        await AssignRollingHabits(schedule, habits, recentCompletions, weekDeferrals);
        await AssignWeeklyHabits(schedule, habits, weekDeferrals);
        await AssignMonthlyHabits(schedule, habits, recentCompletions, weekDeferrals);
        await AssignSeasonalHabits(schedule, habits, recentCompletions, weekDeferrals);

        return schedule;
    }

    private async Task<List<TaskDeferral>> GetWeekDeferrals(DateTime weekStart)
    {
        var weekEnd = weekStart.AddDays(6);
        return await _context.TaskDeferrals
            .Include(d => d.Habit)
            .Where(d =>
    (d.DeferredToDate >= weekStart && d.DeferredToDate <= weekEnd) ||
    (d.OriginalDate >= weekStart && d.OriginalDate <= weekEnd))
            .OrderBy(d => d.DeferredToDate)
            .ToListAsync();
    }

    // NEW: Apply deferred tasks to their target dates
    private async Task ApplyDeferredTasks(WeekSchedule schedule, List<TaskDeferral> deferrals)
    {
        foreach (var deferral in deferrals)
        {
            var targetDay = schedule.DailySchedules
                .FirstOrDefault(d => d.Date.Date == deferral.DeferredToDate.Date);

            if (targetDay != null && deferral.Habit.IsActive)
            {
                targetDay.ScheduledHabits.Add(new ScheduledHabit
                {
                    HabitId = deferral.HabitId,
                    HabitName = deferral.Habit.Name,
                    Description = deferral.Habit.Description,
                    IsLocked = deferral.Habit.IsLocked,
                    HasDeadline = deferral.Habit.HasDeadline,
                    DeadlineTime = deferral.Habit.DeadlineTime,
                    Priority = SchedulePriority.Required, // Deferred tasks get high priority
                    Reason = $"Moved from {deferral.OriginalDate:MMM dd} - {deferral.Reason}"
                });
            }
        }
    }

    private async Task<List<HabitCompletion>> GetRecentCompletions(DateTime weekStart)
    {
        return await _context.HabitCompletions
            .Where(h => h.Date >= weekStart.AddDays(-60) && h.IsCompleted)
            .OrderByDescending(h => h.Date)
            .ToListAsync();
    }

    private async Task AssignDailyHabits(WeekSchedule schedule, List<Habit> habits, List<TaskDeferral> deferrals)
    {
        var dailyHabits = habits.Where(h => h.Frequency == HabitFrequency.Daily).ToList();

        foreach (var day in schedule.DailySchedules)
        {
            foreach (var habit in dailyHabits)
            {
                // 🔥 CRITICAL FIX: Check if this habit was moved AWAY from this day
                var wasMovedFromThisDay = deferrals.Any(d =>
                    d.HabitId == habit.Id &&
                    d.OriginalDate.Date == day.Date.Date);

                // 🔥 CRITICAL FIX: Also check if already deferred TO this day (to prevent duplicates)
                var isAlreadyDeferredToThisDay = deferrals.Any(d =>
                    d.HabitId == habit.Id &&
                    d.DeferredToDate.Date == day.Date.Date);

                // Only add if NOT moved away AND NOT already deferred to this day
                if (!wasMovedFromThisDay && !isAlreadyDeferredToThisDay)
                {
                    day.ScheduledHabits.Add(new ScheduledHabit
                    {
                        HabitId = habit.Id,
                        HabitName = habit.Name,
                        IsLocked = habit.IsLocked,
                        HasDeadline = habit.HasDeadline,
                        DeadlineTime = habit.DeadlineTime,
                        Description = habit.Description,
                        Priority = SchedulePriority.Required,
                        Reason = "Daily habit"
                    });
                }
            }
        }
    }


    public async Task DeferTask(int habitId, DateTime fromDate, DateTime toDate, string reason)
    {
        // Create a deferred task record (tracks that task was moved, not failed)
        _context.TaskDeferrals.Add(new TaskDeferral
        {
            HabitId = habitId,
            OriginalDate = fromDate,
            DeferredToDate = toDate,
            Reason = reason,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
    }


    private async Task AssignRollingHabits(WeekSchedule schedule, List<Habit> habits,
        List<HabitCompletion> recentCompletions, List<TaskDeferral> deferrals)
    {
        var rollingHabits = habits.Where(h => h.Frequency == HabitFrequency.EveryTwoDays).ToList();

        foreach (var habit in rollingHabits)
        {
            var lastCompletion = recentCompletions
                .FirstOrDefault(c => c.HabitId == habit.Id)?.Date;

            var rollingDays = new[] { 0, 2, 4, 6 }; // Monday, Wednesday, Friday, Sunday

            foreach (var dayIndex in rollingDays)
            {
                if (dayIndex < schedule.DailySchedules.Count)
                {
                    var targetDate = schedule.DailySchedules[dayIndex].Date;

                    // Skip if already deferred to this day
                    var isAlreadyDeferred = deferrals.Any(d =>
                        d.HabitId == habit.Id &&
                        d.DeferredToDate.Date == targetDate.Date);

                    if (!isAlreadyDeferred)
                    {
                        var daysSinceLastCompletion = lastCompletion.HasValue
                            ? (targetDate - lastCompletion.Value).Days
                            : 999;

                        if (daysSinceLastCompletion >= 2)
                        {
                            schedule.DailySchedules[dayIndex].ScheduledHabits.Add(new ScheduledHabit
                            {
                                HabitId = habit.Id,
                                HabitName = habit.Name,
                                Description = habit.Description,
                                Priority = SchedulePriority.Required,
                                Reason = lastCompletion.HasValue
                                    ? $"Last completed {daysSinceLastCompletion} days ago"
                                    : "Never completed"
                            });
                            break; // Only schedule once per week
                        }
                    }
                }
            }
        }
    }

    private async Task AssignWeeklyHabits(WeekSchedule schedule, List<Habit> habits, List<TaskDeferral> weekDeferrals)
    {
        var weeklyHabits = habits.Where(h => h.Frequency == HabitFrequency.Weekly).ToList();

        foreach (var habit in weeklyHabits)
        {
            var optimalDays = GetOptimalDaysForWeeklyHabit(habit, schedule);
            int assignedCount = 0;

            for (int i = 0; i < optimalDays.Count && assignedCount < habit.WeeklyTarget; i++)
            {
                var dayIndex = optimalDays[i];
                var targetDate = schedule.DailySchedules[dayIndex].Date;

                // Skip if this habit is already deferred to this day  // this now removes from weekly assignment
                var isAlreadyDeferred = weekDeferrals.Any(d =>
                    d.HabitId == habit.Id &&
                    d.OriginalDate.Date == targetDate.Date);

                if (!isAlreadyDeferred)
                {
                    schedule.DailySchedules[dayIndex].ScheduledHabits.Add(new ScheduledHabit
                    {
                        HabitId = habit.Id,
                        HabitName = habit.Name,
                        Description = habit.Description,
                        IsLocked = habit.IsLocked,
                        HasDeadline = habit.HasDeadline,
                        DeadlineTime = habit.DeadlineTime,
                        Priority = SchedulePriority.Required,
                        Reason = $"Weekly target: {assignedCount + 1}/{habit.WeeklyTarget}"
                    });
                    assignedCount++;
                }
            }
        }
    }

    private async Task AssignMonthlyHabits(WeekSchedule schedule, List<Habit> habits,
        List<HabitCompletion> recentCompletions, List<TaskDeferral> weekDeferrals)
    {
        var monthlyHabits = habits.Where(h => h.Frequency == HabitFrequency.Monthly).ToList();

        foreach (var habit in monthlyHabits)
        {
            var monthStart = new DateTime(schedule.WeekStart.Year, schedule.WeekStart.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            var completedThisMonth = recentCompletions
                .Any(c => c.HabitId == habit.Id && c.Date >= monthStart && c.Date <= monthEnd);

            if (!completedThisMonth)
            {
                // Check if this habit is already deferred to any day this week
                var isAlreadyDeferredThisWeek = weekDeferrals.Any(d => d.HabitId == habit.Id);

                if (!isAlreadyDeferredThisWeek)
                {
                    // Find available days (not already assigned this habit via deferral)
                    var availableDays = schedule.DailySchedules
                        .Where(day => !weekDeferrals.Any(d =>
                            d.HabitId == habit.Id &&
                            d.DeferredToDate.Date == day.Date.Date))
                        .ToList();

                    if (availableDays.Any())
                    {
                        // Schedule on the available day with least other tasks (load balancing)
                        var optimalDay = availableDays
                            .OrderBy(d => d.ScheduledHabits.Count)
                            .First();

                        optimalDay.ScheduledHabits.Add(new ScheduledHabit
                        {
                            HabitId = habit.Id,
                            HabitName = habit.Name,
                            Description = habit.Description,
                            IsLocked = habit.IsLocked,
                            HasDeadline = habit.HasDeadline,
                            DeadlineTime = habit.DeadlineTime,
                            Priority = SchedulePriority.Required,
                            Reason = "Monthly target not yet met"
                        });
                    }
                }
            }
        }
    }

    private async Task AssignSeasonalHabits(WeekSchedule schedule, List<Habit> habits,
        List<HabitCompletion> recentCompletions, List<TaskDeferral> weekDeferrals)
    {
        var seasonalHabits = habits.Where(h => h.Frequency == HabitFrequency.Seasonal).ToList();

        foreach (var habit in seasonalHabits)
        {
            // Calculate season boundaries (assuming 4 seasons per year, 3 months each)
            var currentSeason = GetCurrentSeason(schedule.WeekStart);
            var seasonStart = currentSeason.Start;
            var seasonEnd = currentSeason.End;

            // Check if completed this season
            var completedThisSeason = recentCompletions
                .Any(c => c.HabitId == habit.Id && c.Date >= seasonStart && c.Date <= seasonEnd);

            // For seasonal habits, also check target (e.g., "Clean Windows" 3x per season)
            var seasonalCompletions = recentCompletions
                .Count(c => c.HabitId == habit.Id && c.Date >= seasonStart && c.Date <= seasonEnd);

            var seasonalTarget = habit.SeasonalTarget != 0 ? habit.SeasonalTarget : 1; 

            if (seasonalCompletions < seasonalTarget)
            {
                // Check if this habit is already deferred to any day this week
                var isAlreadyDeferredThisWeek = weekDeferrals.Any(d => d.HabitId == habit.Id);

                if (!isAlreadyDeferredThisWeek)
                {
                    // Find available days (not already assigned this habit via deferral)
                    var availableDays = schedule.DailySchedules
                        .Where(day => !weekDeferrals.Any(d =>
                            d.HabitId == habit.Id &&
                            d.DeferredToDate.Date == day.Date.Date))
                        .ToList();

                    if (availableDays.Any())
                    {
                        // Schedule on the available day with least other tasks (load balancing)
                        var optimalDay = availableDays
                            .OrderBy(d => d.ScheduledHabits.Count)
                            .First();

                        optimalDay.ScheduledHabits.Add(new ScheduledHabit
                        {
                            HabitId = habit.Id,
                            HabitName = habit.Name,
                            Description = habit.Description,
                            IsLocked = habit.IsLocked,
                            HasDeadline = habit.HasDeadline,
                            DeadlineTime = habit.DeadlineTime,
                            Priority = SchedulePriority.Required,
                            Reason = $"Seasonal target: {seasonalCompletions + 1}/{seasonalTarget}"
                        });
                    }
                }
            }
        }
    }

    private (DateTime Start, DateTime End) GetCurrentSeason(DateTime date)
    {
        var year = date.Year;

        // Define seasons (adjust these dates based on your preference)
        var seasons = new[]
        {
            (Start: new DateTime(year, 12, 21), End: new DateTime(year + 1, 3, 20), Name: "Winter"), // Winter spans year boundary
            (Start: new DateTime(year, 3, 21), End: new DateTime(year, 6, 20), Name: "Spring"),
            (Start: new DateTime(year, 6, 21), End: new DateTime(year, 9, 20), Name: "Summer"),
            (Start: new DateTime(year, 9, 21), End: new DateTime(year, 12, 20), Name: "Fall")
        };

        // Handle winter spanning year boundary
        if (date.Month <= 3 && date.Day <= 20)
        {
            return (new DateTime(year - 1, 12, 21), new DateTime(year, 3, 20));
        }

        // Find current season
        var currentSeason = seasons.FirstOrDefault(s => date >= s.Start && date <= s.End);

        return currentSeason != default
            ? (currentSeason.Start, currentSeason.End)
            : (seasons[0].Start, seasons[0].End);
    }

    private int CalculateNextRollingDay(DateTime? lastCompletion, DateTime weekStart)
    {
        if (!lastCompletion.HasValue) return 0; // Start Monday if never completed

        var daysSince = (weekStart - lastCompletion.Value).Days;
        return daysSince >= 2 ? 0 : 2; // If it's been 2+ days, start Monday, otherwise Wednesday
    }

    private List<int> GetOptimalDaysForWeeklyHabit(Habit habit, WeekSchedule schedule)
    {
        var optimalDays = new List<int>();

        // Customize optimal days based on habit type
        switch (habit.Name.ToLower())
        {
            case var name when name.Contains("gym"):
                // Gym: Monday, Wednesday, Friday, Saturday (4x week)
                optimalDays = new List<int> { 0, 2, 4, 5 };
                break;
            case var name when name.Contains("vacuum") || name.Contains("sweep"):
                // Vacuum: Wednesday, Sunday (2x week)
                optimalDays = new List<int> { 2, 6 };
                break;
            case var name when name.Contains("bathroom"):
                // Bathroom: Saturday (1x week)
                optimalDays = new List<int> { 5 };
                break;
            default:
                // Default: spread evenly across week
                optimalDays = DistributeEvenly(habit.WeeklyTarget, 7);
                break;
        }

        return optimalDays.Take(habit.WeeklyTarget).ToList();
    }

    private List<int> DistributeEvenly(int count, int totalDays)
    {
        var result = new List<int>();
        if (count <= 0) return result;

        var interval = (double)totalDays / count;
        for (int i = 0; i < count; i++)
        {
            result.Add((int)(i * interval));
        }
        return result;
    }

    private int GetRemainingWeeksInSeason(DateTime currentDate)
    {
        var seasonEnd = new DateTime(currentDate.Year, 10, 31);
        return (int)Math.Ceiling((seasonEnd - currentDate).TotalDays / 7.0);
    }

    private bool ShouldScheduleSeasonalHabitThisWeek(int remainingCompletions, int remainingWeeks)
    {
        // Schedule if we need to complete more tasks than remaining weeks
        return remainingCompletions >= remainingWeeks;
    }
}

// Supporting models
public class WeekSchedule
{
    public DateTime WeekStart { get; set; }
    public DateTime WeekEnd { get; set; }
    public List<DailySchedule> DailySchedules { get; set; } = new();
}

public class DailySchedule
{
    public DateTime Date { get; set; }
    public List<ScheduledHabit> ScheduledHabits { get; set; } = new();
}

public class ScheduledHabit
{
    public int HabitId { get; set; }
    public string HabitName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsLocked { get; set; }
    public bool HasDeadline { get; set; }
    public TimeOnly DeadlineTime { get; set; }
    public SchedulePriority Priority { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public enum SchedulePriority
{
    Required,
    Optional,
    Bonus
}