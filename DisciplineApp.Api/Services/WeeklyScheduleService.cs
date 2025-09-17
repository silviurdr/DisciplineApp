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
                // CASE 1: Tasks deferred TO this week (from any previous date)
                (d.DeferredToDate >= weekStart && d.DeferredToDate <= weekEnd) ||

                // CASE 2: Tasks deferred FROM this week (to any future date)
                // This prevents double-scheduling tasks that were moved away from this week
                (d.OriginalDate >= weekStart && d.OriginalDate <= weekEnd)
            )
            .OrderBy(d => d.DeferredToDate)
            .ToListAsync();
    }

    // NEW: Apply deferred tasks to their target dates
    private async Task ApplyDeferredTasks(WeekSchedule schedule, List<TaskDeferral> deferrals)
    {
        var weekStart = schedule.WeekStart;
        var weekEnd = schedule.WeekEnd;

        foreach (var deferral in deferrals)
        {
            // CASE 1: Tasks deferred TO this week (ADD them)
            if (deferral.DeferredToDate >= weekStart && deferral.DeferredToDate <= weekEnd)
            {
                var targetDay = schedule.DailySchedules
                    .FirstOrDefault(d => d.Date.Date == deferral.DeferredToDate.Date);

                if (targetDay != null && deferral.Habit.IsActive)
                {
                    // 🔥 FIX: Calculate deferral info for deferred tasks
                    var deferralInfo = await CalculateDeferralInfo(deferral.Habit, deferral.OriginalDate);

                    targetDay.ScheduledHabits.Add(new ScheduledHabit
                    {
                        HabitId = deferral.HabitId,
                        HabitName = deferral.Habit.Name,
                        Description = deferral.Habit.Description,
                        IsLocked = deferral.Habit.IsLocked,
                        HasDeadline = deferral.Habit.HasDeadline,
                        DeadlineTime = deferral.Habit.DeadlineTime,
                        Priority = SchedulePriority.Required,
                        Reason = $"Moved from {deferral.OriginalDate:MMM dd} - {deferral.Reason}",

                        // 🔥 ADD MISSING DEFERRAL FIELDS
                        DeferralsUsed = deferralInfo.DeferralsUsed,
                        MaxDeferrals = deferralInfo.MaxDeferrals,
                        CanStillBeDeferred = deferralInfo.CanStillBeDeferred,
                        Frequency = deferral.Habit.Frequency.ToString(),
                        OriginalScheduledDate = deferral.OriginalDate,
                        CurrentDueDate = deferral.DeferredToDate
                    });
                }
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
                // Check if this habit was moved AWAY from this day
                var wasMovedFromThisDay = deferrals.Any(d =>
                    d.HabitId == habit.Id &&
                    d.OriginalDate.Date == day.Date.Date);

                // Also check if already deferred TO this day (to prevent duplicates)
                var isAlreadyDeferredToThisDay = deferrals.Any(d =>
                    d.HabitId == habit.Id &&
                    d.DeferredToDate.Date == day.Date.Date);

                // Only add if NOT moved away AND NOT already deferred to this day
                if (!wasMovedFromThisDay && !isAlreadyDeferredToThisDay)
                {
                    // 🔥 FIX: Calculate deferral info for this specific habit and date
                    var deferralInfo = await CalculateDeferralInfo(habit, day.Date);

                    day.ScheduledHabits.Add(new ScheduledHabit
                    {
                        HabitId = habit.Id,
                        HabitName = habit.Name,
                        IsLocked = habit.IsLocked,
                        HasDeadline = habit.HasDeadline,
                        DeadlineTime = habit.DeadlineTime,
                        Description = habit.Description,
                        Priority = SchedulePriority.Required,
                        Reason = "Daily habit",

                        // 🔥 ADD MISSING DEFERRAL FIELDS
                        DeferralsUsed = deferralInfo.DeferralsUsed,
                        MaxDeferrals = deferralInfo.MaxDeferrals,
                        CanStillBeDeferred = deferralInfo.CanStillBeDeferred,
                        Frequency = habit.Frequency.ToString()
                    });
                }
            }
        }
    }


    public async Task DeferTask(int habitId, DateTime fromDate, DateTime toDate, string reason)
    {
        // Check if there's already a deferral record for this habit and date
        var existingDeferral = await _context.TaskDeferrals
            .FirstOrDefaultAsync(d => d.HabitId == habitId &&
                               d.OriginalDate.Date == fromDate.Date &&
                               !d.IsCompleted);

        if (existingDeferral != null)
        {
            // Update existing deferral
            existingDeferral.DeferralsUsed++;
            existingDeferral.DeferredToDate = toDate;
            existingDeferral.Reason = reason;
        }
        else
        {
            // Create new deferral record
            _context.TaskDeferrals.Add(new TaskDeferral
            {
                HabitId = habitId,
                OriginalDate = fromDate,
                DeferredToDate = toDate,
                DeferralsUsed = 1, // 🔥 FIX: Set to 1 for new deferrals
                Reason = reason,
                CreatedAt = DateTime.UtcNow
            });
        }

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
                            d.OriginalDate.Date == day.Date.Date))
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
                            d.OriginalDate.Date == day.Date.Date))
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

                // Skip if this habit is already deferred from this day
                var isAlreadyDeferred = weekDeferrals.Any(d =>
                    d.HabitId == habit.Id &&
                    d.OriginalDate.Date == targetDate.Date);

                if (!isAlreadyDeferred)
                {
                    // 🔥 FIX: Calculate deferral info for this specific habit and date
                    var deferralInfo = await CalculateDeferralInfo(habit, targetDate);

                    schedule.DailySchedules[dayIndex].ScheduledHabits.Add(new ScheduledHabit
                    {
                        HabitId = habit.Id,
                        HabitName = habit.Name,
                        Description = habit.Description,
                        IsLocked = habit.IsLocked,
                        HasDeadline = habit.HasDeadline,
                        DeadlineTime = habit.DeadlineTime,
                        Priority = SchedulePriority.Required,
                        Reason = $"Weekly habit ({assignedCount + 1}/{habit.WeeklyTarget})",

                        // 🔥 ADD MISSING DEFERRAL FIELDS
                        DeferralsUsed = deferralInfo.DeferralsUsed,
                        MaxDeferrals = deferralInfo.MaxDeferrals,
                        CanStillBeDeferred = deferralInfo.CanStillBeDeferred,
                        Frequency = habit.Frequency.ToString()
                    });
                    assignedCount++;
                }
            }
        }
    }

    private async Task<(int DeferralsUsed, int MaxDeferrals, bool CanStillBeDeferred)> CalculateDeferralInfo(Habit habit, DateTime scheduledDate)
    {
        // Set MaxDeferrals if not already set
        var maxDeferrals = habit.MaxDeferrals;
        if (maxDeferrals == 0)
        {
            maxDeferrals = GetMaxDeferralsForFrequency(habit.Frequency);
            habit.MaxDeferrals = maxDeferrals;
            _context.Habits.Update(habit);
            await _context.SaveChangesAsync();
        }

        // 🔥 FIX: The problem is here - we need to find deferrals for THIS habit where:
        // 1. OriginalDate matches the scheduled date (for tasks moved FROM this date)
        // 2. OR DeferredToDate matches today (for tasks moved TO today)

        var today = DateTime.Today;

        // For deferred tasks, we need to check if this task was moved FROM its original date
        var deferral = await _context.TaskDeferrals
            .Where(d => d.HabitId == habit.Id && !d.IsCompleted)
            .Where(d =>
                // Case 1: Task originally scheduled for this date but moved elsewhere
                d.OriginalDate.Date == scheduledDate.Date ||
                // Case 2: Task moved TO today from elsewhere
                (d.DeferredToDate.Date == today && scheduledDate.Date == today)
            )
            .FirstOrDefaultAsync();

        var deferralsUsed = 0;

        if (deferral != null)
        {
            // If this is a task that was moved TO today, use its DeferralsUsed count
            if (deferral.DeferredToDate.Date == today && scheduledDate.Date == today)
            {
                deferralsUsed = deferral.DeferralsUsed;
            }
            // If this is checking the original scheduled date of a moved task
            else if (deferral.OriginalDate.Date == scheduledDate.Date)
            {
                deferralsUsed = deferral.DeferralsUsed;
            }
        }

        var canStillBeDeferred = deferralsUsed < maxDeferrals;

        // 🔥 DEBUG: Add logging to see what's happening
        Console.WriteLine($"🔍 CalculateDeferralInfo for Habit {habit.Id} ({habit.Name}):");
        Console.WriteLine($"   ScheduledDate: {scheduledDate:yyyy-MM-dd}");
        Console.WriteLine($"   Today: {today:yyyy-MM-dd}");
        Console.WriteLine($"   Found deferral: {deferral != null}");
        if (deferral != null)
        {
            Console.WriteLine($"   Deferral OriginalDate: {deferral.OriginalDate:yyyy-MM-dd}");
            Console.WriteLine($"   Deferral DeferredToDate: {deferral.DeferredToDate:yyyy-MM-dd}");
            Console.WriteLine($"   Deferral DeferralsUsed: {deferral.DeferralsUsed}");
        }
        Console.WriteLine($"   Final DeferralsUsed: {deferralsUsed}");
        Console.WriteLine($"   MaxDeferrals: {maxDeferrals}");

        return (deferralsUsed, maxDeferrals, canStillBeDeferred);
    }


    private int GetMaxDeferralsForFrequency(HabitFrequency frequency)
    {
        return frequency switch
        {
            HabitFrequency.Daily => 0,          // No deferrals for daily tasks
            HabitFrequency.EveryTwoDays => 1,   // Limited deferrals for rolling
            HabitFrequency.Weekly => 2,         // 2 deferrals for weekly tasks
            HabitFrequency.Monthly => 6,        // 6 deferrals for monthly tasks
            HabitFrequency.Seasonal => 6,       // 6 deferrals for seasonal tasks
            _ => 0
        };
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

    public async Task<SmartDeferralResult> SmartDeferTask(int habitId, DateTime fromDate, string reason)
    {
        var habit = await _context.Habits.FindAsync(habitId);
        if (habit == null)
        {
            return new SmartDeferralResult
            {
                Success = false,
                Message = "Habit not found"
            };
        }

        // Check if habit has remaining deferrals
        var currentDeferralInfo = await CalculateDeferralInfo(habit, fromDate);
        if (currentDeferralInfo.DeferralsUsed >= currentDeferralInfo.MaxDeferrals)
        {
            return new SmartDeferralResult
            {
                Success = false,
                Message = $"No more deferrals available for this task. You've used all {currentDeferralInfo.MaxDeferrals} deferrals."
            };
        }

        // Find next available date
        var nextAvailableDate = await FindNextAvailableDate(habit, fromDate);
        if (nextAvailableDate == null)
        {
            return new SmartDeferralResult
            {
                Success = false,
                Message = GetDeferralBlockedMessage(habit, fromDate)
            };
        }

        // Create the deferral
        await CreateDeferralRecord(habitId, fromDate, nextAvailableDate.Value, reason);

        return new SmartDeferralResult
        {
            Success = true,
            Message = $"Task moved to {nextAvailableDate.Value:dddd, MMM dd}",
            NewDueDate = nextAvailableDate.Value,
            DeferralsUsed = currentDeferralInfo.DeferralsUsed + 1,
            RemainingDeferrals = currentDeferralInfo.MaxDeferrals - (currentDeferralInfo.DeferralsUsed + 1)
        };
    }

    private async Task<DateTime?> FindNextAvailableDate(Habit habit, DateTime fromDate)
    {
        var searchDate = fromDate.AddDays(1); // Start from tomorrow
        var maxSearchDays = GetMaxSearchDays(habit, fromDate);

        for (int i = 0; i < maxSearchDays; i++)
        {
            var checkDate = searchDate.AddDays(i);

            // Check if this date is within the valid period for this habit
            if (!IsDateWithinValidPeriod(habit, checkDate, fromDate))
                break;

            // Check if this habit already exists on this date
            if (!await IsHabitAlreadyScheduled(habit.Id, checkDate))
            {
                return checkDate;
            }
        }

        return null; // No available date found
    }

    private bool IsDateWithinValidPeriod(Habit habit, DateTime checkDate, DateTime originalDate)
    {
        switch (habit.Frequency)
        {
            case HabitFrequency.Daily:
                return false; // Daily tasks can't be moved - they're needed every day

            case HabitFrequency.Weekly:
                // Weekly tasks must stay within the same week
                var weekStart = GetWeekStart(originalDate);
                var weekEnd = weekStart.AddDays(6);
                return checkDate >= weekStart && checkDate <= weekEnd;

            case HabitFrequency.EveryTwoDays:
                // Rolling tasks can move within a 4-day window
                return checkDate <= originalDate.AddDays(3);

            case HabitFrequency.Monthly:
                // Monthly tasks must stay within the same month
                return checkDate.Year == originalDate.Year &&
                       checkDate.Month == originalDate.Month;

            case HabitFrequency.Seasonal:
                // Seasonal tasks must stay within the season (March-October)
                return checkDate.Month >= 3 && checkDate.Month <= 10;

            default:
                return false;
        }
    }

    private async Task<bool> IsHabitAlreadyScheduled(int habitId, DateTime checkDate)
    {
        // Check if habit is already scheduled naturally on this date
        var weekStart = GetWeekStart(checkDate);
        var weekSchedule = await GenerateWeekSchedule(weekStart);

        var daySchedule = weekSchedule.DailySchedules.FirstOrDefault(d => d.Date.Date == checkDate.Date);
        if (daySchedule?.ScheduledHabits.Any(h => h.HabitId == habitId) == true)
            return true;

        // Check if habit is already deferred TO this date
        var existingDeferral = await _context.TaskDeferrals
            .AnyAsync(d => d.HabitId == habitId &&
                          d.DeferredToDate.Date == checkDate.Date &&
                          !d.IsCompleted);

        return existingDeferral;
    }

    private int GetMaxSearchDays(Habit habit, DateTime fromDate)
    {
        switch (habit.Frequency)
        {
            case HabitFrequency.Daily:
                return 0; // Can't move daily tasks
            case HabitFrequency.EveryTwoDays:
                return 3; // 3-day window
            case HabitFrequency.Weekly:
                var weekEnd = GetWeekStart(fromDate).AddDays(6);
                return (int)(weekEnd - fromDate).TotalDays;
            case HabitFrequency.Monthly:
                var monthEnd = new DateTime(fromDate.Year, fromDate.Month, 1).AddMonths(1).AddDays(-1);
                return Math.Min(14, (int)(monthEnd - fromDate).TotalDays); // Max 2 weeks search
            case HabitFrequency.Seasonal:
                return 30; // Search up to 30 days ahead
            default:
                return 7;
        }
    }

    private string GetDeferralBlockedMessage(Habit habit, DateTime fromDate)
    {
        switch (habit.Frequency)
        {
            case HabitFrequency.Daily:
                return "Daily habits cannot be moved - they are required every day.";

            case HabitFrequency.Weekly:
                var weekEnd = GetWeekStart(fromDate).AddDays(6);
                return $"Cannot move this weekly task. All remaining days this week (until {weekEnd:MMM dd}) already have this habit scheduled.";

            case HabitFrequency.EveryTwoDays:
                return "Cannot move this task. All available dates within the 2-day cycle already have this habit scheduled.";

            case HabitFrequency.Monthly:
                return "Cannot move this monthly task. All remaining days this month already have this habit scheduled.";

            case HabitFrequency.Seasonal:
                return "Cannot move this seasonal task. All nearby dates already have this habit scheduled.";

            default:
                return "Cannot move this task. No available dates found.";
        }
    }

    private async Task CreateDeferralRecord(int habitId, DateTime fromDate, DateTime toDate, string reason)
    {
        // Check if deferral record already exists
        var existingDeferral = await _context.TaskDeferrals
            .FirstOrDefaultAsync(d => d.HabitId == habitId &&
                               d.OriginalDate.Date == fromDate.Date &&
                               !d.IsCompleted);

        if (existingDeferral != null)
        {
            // Update existing deferral
            existingDeferral.DeferralsUsed++;
            existingDeferral.DeferredToDate = toDate;
            existingDeferral.Reason = reason;
        }
        else
        {
            // Create new deferral
            _context.TaskDeferrals.Add(new TaskDeferral
            {
                HabitId = habitId,
                OriginalDate = fromDate,
                DeferredToDate = toDate,
                DeferralsUsed = 1,
                Reason = reason,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();
    }

    private DateTime GetWeekStart(DateTime date)
    {
        var dayOfWeek = (int)date.DayOfWeek;
        var mondayOffset = (dayOfWeek == 0) ? -6 : -(dayOfWeek - 1);
        return date.AddDays(mondayOffset);
    }

    // Result model for smart deferral
    public class SmartDeferralResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime? NewDueDate { get; set; }
        public int DeferralsUsed { get; set; }
        public int RemainingDeferrals { get; set; }
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

    // 🔥 ADD MISSING DEFERRAL FIELDS
    public string Frequency { get; set; } = string.Empty;
    public int DeferralsUsed { get; set; } = 0;
    public int MaxDeferrals { get; set; } = 0;
    public bool CanStillBeDeferred { get; set; } = false;
    public DateTime? OriginalScheduledDate { get; set; }
    public DateTime? CurrentDueDate { get; set; }

    // Status fields for frontend compatibility
    public bool IsCompleted { get; set; } = false;
    public bool IsRequired { get; set; } = true;
    public bool IsAdHoc { get; set; } = false;
    public int? AdHocId { get; set; }
}

public enum SchedulePriority
{
    Required,
    Optional,
    Bonus
}