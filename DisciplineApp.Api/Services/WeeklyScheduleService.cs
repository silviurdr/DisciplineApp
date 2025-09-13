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

        // Get recent completion history for smart scheduling
        var recentCompletions = await GetRecentCompletions(weekStart);

        // Assign habits by type
        await AssignDailyHabits(schedule, habits);
        await AssignRollingHabits(schedule, habits, recentCompletions);
        await AssignWeeklyHabits(schedule, habits);
        await AssignMonthlyHabits(schedule, habits, recentCompletions);
        await AssignSeasonalHabits(schedule, habits, recentCompletions);

        return schedule;
    }

    private async Task<List<HabitCompletion>> GetRecentCompletions(DateTime weekStart)
    {
        return await _context.HabitCompletions
            .Where(h => h.Date >= weekStart.AddDays(-60) && h.IsCompleted)
            .OrderByDescending(h => h.Date)
            .ToListAsync();
    }

    private async Task AssignDailyHabits(WeekSchedule schedule, List<Habit> habits)
    {
        var dailyHabits = habits.Where(h => h.Frequency == HabitFrequency.Daily).ToList();

        foreach (var day in schedule.DailySchedules)
        {
            foreach (var habit in dailyHabits)
            {
                day.ScheduledHabits.Add(new ScheduledHabit
                {
                    HabitId = habit.Id,
                    HabitName = habit.Name,
                    IsLocked   = habit.IsLocked,
                    HasDeadline = habit.HasDeadline,
                    DeadlineTime = habit.DeadlineTime,
                    Description = habit.Description,
                    Priority = SchedulePriority.Required,
                    Reason = "Daily habit"
                });
            }
        }
    }

    private async Task AssignRollingHabits(WeekSchedule schedule, List<Habit> habits, List<HabitCompletion> recentCompletions)
    {
        var rollingHabits = habits.Where(h => h.Frequency == HabitFrequency.EveryTwoDays).ToList();

        foreach (var habit in rollingHabits)
        {
            var lastCompletion = recentCompletions
                .FirstOrDefault(c => c.HabitId == habit.Id)?.Date;

            // Determine starting day based on last completion
            var startDay = CalculateNextRollingDay(lastCompletion, schedule.WeekStart);

            // Schedule every 2 days: Mon, Wed, Fri, Sun pattern
            var rollingDays = new[] { 0, 2, 4, 6 }; // Monday, Wednesday, Friday, Sunday

            foreach (var dayIndex in rollingDays)
            {
                if (dayIndex < schedule.DailySchedules.Count)
                {
                    var daysSinceLastCompletion = lastCompletion.HasValue
                        ? (schedule.DailySchedules[dayIndex].Date - lastCompletion.Value).Days
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

    private async Task AssignWeeklyHabits(WeekSchedule schedule, List<Habit> habits)
    {
        var weeklyHabits = habits.Where(h => h.Frequency == HabitFrequency.Weekly).ToList();

        foreach (var habit in weeklyHabits)
        {
            var optimalDays = GetOptimalDaysForWeeklyHabit(habit, schedule);

            for (int i = 0; i < Math.Min(habit.WeeklyTarget, optimalDays.Count); i++)
            {
                var dayIndex = optimalDays[i];
                schedule.DailySchedules[dayIndex].ScheduledHabits.Add(new ScheduledHabit
                {
                    HabitId = habit.Id,
                    HabitName = habit.Name,
                    Description = habit.Description,
                    Priority = SchedulePriority.Required,
                    Reason = $"Weekly target: {i + 1}/{habit.WeeklyTarget}"
                });
            }
        }
    }

    private async Task AssignMonthlyHabits(WeekSchedule schedule, List<Habit> habits, List<HabitCompletion> recentCompletions)
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
                // Schedule on the day with least other tasks (load balancing)
                var optimalDay = schedule.DailySchedules
                    .OrderBy(d => d.ScheduledHabits.Count)
                    .First();

                optimalDay.ScheduledHabits.Add(new ScheduledHabit
                {
                    HabitId = habit.Id,
                    HabitName = habit.Name,
                    Description = habit.Description,
                    Priority = SchedulePriority.Required,
                    Reason = "Monthly target not yet met"
                });
            }
        }
    }

    private async Task AssignSeasonalHabits(WeekSchedule schedule, List<Habit> habits, List<HabitCompletion> recentCompletions)
    {
        var seasonalHabits = habits.Where(h => h.Frequency == HabitFrequency.Seasonal).ToList();

        foreach (var habit in seasonalHabits)
        {
            // Check if we're in the warm season (March-October)
            var currentMonth = schedule.WeekStart.Month;
            if (currentMonth >= 3 && currentMonth <= 10)
            {
                var seasonStart = new DateTime(schedule.WeekStart.Year, 3, 1);
                var seasonEnd = new DateTime(schedule.WeekStart.Year, 10, 31);

                var completedThisSeason = recentCompletions
                    .Count(c => c.HabitId == habit.Id && c.Date >= seasonStart && c.Date <= seasonEnd);

                if (completedThisSeason < habit.SeasonalTarget)
                {
                    // Calculate if we need to schedule this week
                    var remainingWeeksInSeason = GetRemainingWeeksInSeason(schedule.WeekStart);
                    var remainingCompletions = habit.SeasonalTarget - completedThisSeason;

                    if (remainingCompletions > 0 && ShouldScheduleSeasonalHabitThisWeek(remainingCompletions, remainingWeeksInSeason))
                    {
                        var optimalDay = schedule.DailySchedules
                            .Where(d => d.Date.DayOfWeek == DayOfWeek.Saturday || d.Date.DayOfWeek == DayOfWeek.Sunday)
                            .OrderBy(d => d.ScheduledHabits.Count)
                            .FirstOrDefault() ?? schedule.DailySchedules.OrderBy(d => d.ScheduledHabits.Count).First();

                        optimalDay.ScheduledHabits.Add(new ScheduledHabit
                        {
                            HabitId = habit.Id,
                            HabitName = habit.Name,
                            Description = habit.Description,
                            Priority = SchedulePriority.Required,
                            Reason = $"Seasonal target: {completedThisSeason + 1}/{habit.SeasonalTarget}"
                        });
                    }
                }
            }
        }
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