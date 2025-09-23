// FILE: DisciplineApp.Api/Services/WeeklyScheduleService.cs
// COMPLETE FIX WITH ALL REQUIRED METHODS AND INTERFACES
// ==============================================================================

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
        var weekDeferrals = await GetWeekDeferrals(weekStart);

        Console.WriteLine($"🔍 GenerateWeekSchedule: Found {weekDeferrals.Count} deferrals for week {weekStart:yyyy-MM-dd}");

        // FIRST: Assign regular habits by type
        await AssignDailyHabits(schedule, habits, weekDeferrals);
        await AssignRollingHabits(schedule, habits, recentCompletions, weekDeferrals);
        await AssignWeeklyHabits(schedule, habits, weekDeferrals);
        await AssignMonthlyHabits(schedule, habits, recentCompletions, weekDeferrals);
        await AssignSeasonalHabits(schedule, habits, recentCompletions, weekDeferrals);

        // THEN: Apply deferred tasks (this will remove/add tasks based on deferrals)
        await ApplyDeferredTasks(schedule, weekDeferrals);

        return schedule;
    }

    // ==============================================================================
    // 🔥 THE MAIN FIX: ApplyDeferredTasks that removes AND adds correctly
    // ==============================================================================
    private async Task ApplyDeferredTasks(WeekSchedule schedule, List<TaskDeferral> deferrals)
    {
        var weekStart = schedule.WeekStart;
        var weekEnd = schedule.WeekEnd;

        Console.WriteLine($"🔄 ApplyDeferredTasks: Processing {deferrals.Count} deferrals");

        foreach (var deferral in deferrals)
        {
            // 🔥 CASE 1: Tasks deferred AWAY FROM this week (REMOVE them from original dates)
            if (deferral.OriginalDate >= weekStart && deferral.OriginalDate <= weekEnd)
            {
                var originalDay = schedule.DailySchedules
                    .FirstOrDefault(d => d.Date.Date == deferral.OriginalDate.Date);

                if (originalDay != null)
                {
                    // Find and remove the task from its original date
                    var taskToRemove = originalDay.ScheduledHabits
                        .FirstOrDefault(h => h.HabitId == deferral.HabitId);

                    if (taskToRemove != null)
                    {
                        originalDay.ScheduledHabits.Remove(taskToRemove);
                        Console.WriteLine($"🗑️ REMOVED {deferral.Habit?.Name} from {deferral.OriginalDate:yyyy-MM-dd}");
                    }
                }
            }

            // 🔥 CASE 2: Tasks deferred TO this week (ADD them to new dates)
            if (deferral.DeferredToDate >= weekStart && deferral.DeferredToDate <= weekEnd)
            {
                var targetDay = schedule.DailySchedules
                    .FirstOrDefault(d => d.Date.Date == deferral.DeferredToDate.Date);

                if (targetDay != null && deferral.Habit != null && deferral.Habit.IsActive)
                {
                    // Check if task is already on target day (avoid duplicates)
                    var existingTask = targetDay.ScheduledHabits
                        .FirstOrDefault(h => h.HabitId == deferral.HabitId);

                    if (existingTask == null)
                    {
                        // Calculate deferral info for deferred tasks
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

                            // Deferral fields
                            DeferralsUsed = deferralInfo.DeferralsUsed,
                            MaxDeferrals = deferralInfo.MaxDeferrals,
                            CanStillBeDeferred = deferralInfo.CanStillBeDeferred,
                            Frequency = deferral.Habit.Frequency.ToString(),
                            OriginalScheduledDate = deferral.OriginalDate,
                            CurrentDueDate = deferral.DeferredToDate,

                            // Status fields
                            IsCompleted = false,
                            IsRequired = true,
                            IsAdHoc = false,
                            AdHocId = null
                        });

                        Console.WriteLine($"➕ ADDED {deferral.Habit.Name} to {deferral.DeferredToDate:yyyy-MM-dd}");
                    }
                }
            }
        }
    }

    // ==============================================================================
    // SUPPORTING METHODS (Fixed implementations)
    // ==============================================================================

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

                // Only add if not moved away and not already deferred here
                if (!wasMovedFromThisDay && !isAlreadyDeferredToThisDay)
                {
                    day.ScheduledHabits.Add(new ScheduledHabit
                    {
                        HabitId = habit.Id,
                        HabitName = habit.Name,
                        Description = habit.Description,
                        IsLocked = habit.IsLocked,
                        HasDeadline = habit.HasDeadline,
                        DeadlineTime = habit.DeadlineTime,
                        Priority = SchedulePriority.Required,
                        Reason = "Daily requirement",
                        Frequency = habit.Frequency.ToString(),
                        IsRequired = true,
                        IsCompleted = false,
                        IsAdHoc = false
                    });
                }
            }
        }
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

                    // Skip if moved away from this day
                    var wasMovedFromThisDay = deferrals.Any(d =>
                        d.HabitId == habit.Id &&
                        d.OriginalDate.Date == targetDate.Date);

                    // Skip if already deferred to this day
                    var isAlreadyDeferredToThisDay = deferrals.Any(d =>
                        d.HabitId == habit.Id &&
                        d.DeferredToDate.Date == targetDate.Date);

                    if (!wasMovedFromThisDay && !isAlreadyDeferredToThisDay)
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
                                    : "Never completed",
                                Frequency = habit.Frequency.ToString(),
                                IsRequired = true,
                                IsCompleted = false,
                                IsAdHoc = false
                            });
                            // ✅ REMOVE THE break; STATEMENT HERE
                            // Rolling habits might need to be scheduled multiple times per week
                        }
                    }
                }
            }
        }
    }

    private async Task AssignWeeklyHabits(WeekSchedule schedule, List<Habit> habits, List<TaskDeferral> deferrals)
    {
        var weeklyHabits = habits.Where(h => h.Frequency == HabitFrequency.Weekly).ToList();

        foreach (var habit in weeklyHabits)
        {
            var timesPerWeek = habit.Name.Contains("Gym") ? 4 :
                              habit.Name.Contains("Vacuum") ? 2 :
                              habit.Name.Contains("Bathroom") ? 1 : 1;

            var scheduled = 0;
            foreach (var day in schedule.DailySchedules.OrderBy(d => d.ScheduledHabits.Count))
            {
                if (scheduled >= timesPerWeek) break;

                // Skip if moved away or already deferred here
                var wasMovedFromThisDay = deferrals.Any(d =>
                    d.HabitId == habit.Id && d.OriginalDate.Date == day.Date.Date);
                var isAlreadyDeferredToThisDay = deferrals.Any(d =>
                    d.HabitId == habit.Id && d.DeferredToDate.Date == day.Date.Date);

                if (!wasMovedFromThisDay && !isAlreadyDeferredToThisDay)
                {
                    day.ScheduledHabits.Add(new ScheduledHabit
                    {
                        HabitId = habit.Id,
                        HabitName = habit.Name,
                        Description = habit.Description,
                        Priority = SchedulePriority.Required,
                        Reason = $"Weekly target: {scheduled + 1}/{timesPerWeek}",
                        Frequency = habit.Frequency.ToString(),
                        IsRequired = true,
                        IsCompleted = false,
                        IsAdHoc = false
                    });
                    scheduled++;
                }
            }
        }
    }

    private async Task AssignMonthlyHabits(WeekSchedule schedule, List<Habit> habits,
        List<HabitCompletion> recentCompletions, List<TaskDeferral> deferrals)
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
                var isAlreadyDeferredThisWeek = deferrals.Any(d =>
                    d.HabitId == habit.Id &&
                    d.DeferredToDate >= schedule.WeekStart &&
                    d.DeferredToDate <= schedule.WeekEnd);

                if (!isAlreadyDeferredThisWeek)
                {
                    // Find optimal day (least busy, not moved away from)
                    var optimalDay = schedule.DailySchedules
                        .Where(day => !deferrals.Any(d =>
                            d.HabitId == habit.Id && d.OriginalDate.Date == day.Date.Date))
                        .OrderBy(d => d.ScheduledHabits.Count)
                        .FirstOrDefault();

                    if (optimalDay != null)
                    {
                        optimalDay.ScheduledHabits.Add(new ScheduledHabit
                        {
                            HabitId = habit.Id,
                            HabitName = habit.Name,
                            Description = habit.Description,
                            Priority = SchedulePriority.Required,
                            Reason = "Monthly requirement",
                            Frequency = habit.Frequency.ToString(),
                            IsRequired = true,
                            IsCompleted = false,
                            IsAdHoc = false
                        });
                    }
                }
            }
        }
    }

    private async Task AssignSeasonalHabits(WeekSchedule schedule, List<Habit> habits,
        List<HabitCompletion> recentCompletions, List<TaskDeferral> deferrals)
    {
        var seasonalHabits = habits.Where(h => h.Frequency == HabitFrequency.Seasonal).ToList();

        foreach (var habit in seasonalHabits)
        {
            // Check if completed recently (within 4 months for seasonal tasks)
            var recentCompletion = recentCompletions
                .FirstOrDefault(c => c.HabitId == habit.Id && c.Date >= DateTime.Now.AddMonths(-4));

            if (recentCompletion == null)
            {
                // Similar logic to monthly habits
                var isAlreadyDeferredThisWeek = deferrals.Any(d =>
                    d.HabitId == habit.Id &&
                    d.DeferredToDate >= schedule.WeekStart &&
                    d.DeferredToDate <= schedule.WeekEnd);

                if (!isAlreadyDeferredThisWeek)
                {
                    var optimalDay = schedule.DailySchedules
                        .Where(day => !deferrals.Any(d =>
                            d.HabitId == habit.Id && d.OriginalDate.Date == day.Date.Date))
                        .OrderBy(d => d.ScheduledHabits.Count)
                        .FirstOrDefault();

                    if (optimalDay != null)
                    {
                        optimalDay.ScheduledHabits.Add(new ScheduledHabit
                        {
                            HabitId = habit.Id,
                            HabitName = habit.Name,
                            Description = habit.Description,
                            Priority = SchedulePriority.Required,
                            Reason = "Seasonal requirement",
                            Frequency = habit.Frequency.ToString(),
                            IsRequired = true,
                            IsCompleted = false,
                            IsAdHoc = false
                        });
                    }
                }
            }
        }
    }

    // ==============================================================================
    // MISSING METHOD: CalculateDeferralInfo (Required by ApplyDeferredTasks)
    // ==============================================================================
    private async Task<(int DeferralsUsed, int MaxDeferrals, bool CanStillBeDeferred)> CalculateDeferralInfo(Habit habit, DateTime originalDate)
    {
        // Get deferral count for this habit
        var deferralsUsed = await _context.TaskDeferrals
            .Where(d => d.HabitId == habit.Id)
            .SumAsync(d => d.DeferralsUsed);

        // Max deferrals based on habit frequency
        var maxDeferrals = habit.Frequency switch
        {
            HabitFrequency.Daily => 2,
            HabitFrequency.Weekly => 3,
            HabitFrequency.EveryTwoDays => 2,
            HabitFrequency.Monthly => 5,
            HabitFrequency.Seasonal => 10,
            _ => 2
        };

        var canStillBeDeferred = deferralsUsed < maxDeferrals;

        return (deferralsUsed, maxDeferrals, canStillBeDeferred);
    }

    // ==============================================================================
    // SMART DEFERRAL METHOD (For the API endpoints)
    // ==============================================================================
    public async Task<SmartDeferralResult> SmartDeferTask(int habitId, DateTime fromDate, string reason)
    {
        var habit = await _context.Habits.FindAsync(habitId);
        if (habit == null || !habit.IsActive)
        {
            return new SmartDeferralResult
            {
                Success = false,
                Message = "Habit not found or inactive"
            };
        }

        // ✅ CRITICAL: Daily tasks can NEVER be deferred!
        if (habit.Frequency == HabitFrequency.Daily)
        {
            return new SmartDeferralResult
            {
                Success = false,
                Message = "Daily habits cannot be deferred. They must be completed today to maintain the streak."
            };
        }

        // Calculate deferral info before making changes
        var deferralInfo = await CalculateDeferralInfo(habit, fromDate);
        if (deferralInfo.DeferralsUsed >= deferralInfo.MaxDeferrals)
        {
            return new SmartDeferralResult
            {
                Success = false,
                Message = $"Maximum deferrals ({deferralInfo.MaxDeferrals}) already used for this period"
            };
        }

        // ✅ IMPROVEMENT 1: NO REPLACEMENT TASKS - Simply remove from today
        // The original algorithm was adding replacement tasks, which we don't want

        // ✅ IMPROVEMENT 2: Smart distribution across remaining week
        var nextAvailableDate = await FindOptimalDeferralDate(habit, fromDate);
        if (nextAvailableDate == null)
        {
            return new SmartDeferralResult
            {
                Success = false,
                Message = GetDeferralFailureMessage(habit.Frequency)
            };
        }

        // Create deferral record
        await CreateDeferralRecord(habitId, fromDate, nextAvailableDate.Value, reason);

        // Calculate updated deferral info
        var updatedDeferralInfo = await CalculateDeferralInfo(habit, fromDate);

        return new SmartDeferralResult
        {
            Success = true,
            Message = $"Task moved to {nextAvailableDate.Value:MMM dd}",
            NewDueDate = nextAvailableDate.Value,
            DeferralsUsed = updatedDeferralInfo.DeferralsUsed,
            RemainingDeferrals = updatedDeferralInfo.MaxDeferrals - updatedDeferralInfo.DeferralsUsed
        };
    }

    private async Task<DateTime?> FindOptimalDeferralDate(Habit habit, DateTime fromDate)
    {
        var weekStart = GetWeekStart(fromDate);
        var weekEnd = weekStart.AddDays(6);
        var today = DateTime.Today;

        // Get remaining days in current week (excluding today)
        var remainingDaysThisWeek = new List<DateTime>();
        for (var date = fromDate.AddDays(1); date <= weekEnd; date = date.AddDays(1))
        {
            remainingDaysThisWeek.Add(date);
        }

        // If no remaining days in current week, look at next week
        if (!remainingDaysThisWeek.Any())
        {
            var nextWeekStart = weekEnd.AddDays(1);
            var nextWeekEnd = nextWeekStart.AddDays(6);

            for (var date = nextWeekStart; date <= nextWeekEnd; date = date.AddDays(1))
            {
                remainingDaysThisWeek.Add(date);
            }
        }

        // Calculate task load for each remaining day
        var dayLoads = new Dictionary<DateTime, int>();

        foreach (var date in remainingDaysThisWeek)
        {
            var loadCount = await CalculateDayTaskLoad(date);
            dayLoads[date] = loadCount;
        }

        // Filter out dates that aren't suitable for this habit
        var suitableDates = new List<DateTime>();

        foreach (var date in remainingDaysThisWeek)
        {
            if (await IsDateSuitableForHabit(habit, date))
            {
                suitableDates.Add(date);
            }
        }

        if (!suitableDates.Any())
        {
            return null; // No suitable dates found
        }

        // ✅ SMART DISTRIBUTION: Choose date with lowest task load
        var optimalDate = suitableDates
            .OrderBy(date => dayLoads[date])
            .ThenBy(date => date) // If tie, choose earlier date
            .First();

        Console.WriteLine($"📅 Smart deferral: Moving {habit.Name} to {optimalDate:yyyy-MM-dd} (load: {dayLoads[optimalDate]} tasks)");

        return optimalDate;
    }

    private async Task<int> CalculateDayTaskLoad(DateTime date)
    {
        // Count scheduled habits for this day
        var weekStart = GetWeekStart(date);
        var schedule = await GenerateWeekSchedule(weekStart);

        var daySchedule = schedule.DailySchedules.FirstOrDefault(d => d.Date.Date == date.Date);
        var scheduledCount = daySchedule?.ScheduledHabits?.Count ?? 0;

        // Count deferred tasks coming TO this day
        var deferredToThisDay = await _context.TaskDeferrals
            .CountAsync(d => d.DeferredToDate.Date == date.Date && !d.IsCompleted);

        // Count ad-hoc tasks for this day
        var adHocCount = await _context.AdHocTasks
            .CountAsync(t => t.Date.Date == date.Date && !t.IsCompleted);

        var totalLoad = scheduledCount + deferredToThisDay + adHocCount;

        Console.WriteLine($"📊 Day load for {date:yyyy-MM-dd}: {scheduledCount} scheduled + {deferredToThisDay} deferred + {adHocCount} ad-hoc = {totalLoad} total");

        return totalLoad;
    }

    private async Task<bool> IsDateSuitableForHabit(Habit habit, DateTime date)
    {
        // Check if already deferred to this date
        var existingDeferral = await _context.TaskDeferrals
            .AnyAsync(d => d.HabitId == habit.Id && d.DeferredToDate.Date == date.Date && !d.IsCompleted);

        if (existingDeferral)
        {
            return false; // Already deferred to this date
        }

        // Check if already naturally scheduled for this date
        var weekStart = GetWeekStart(date);
        var schedule = await GenerateWeekSchedule(weekStart);
        var daySchedule = schedule.DailySchedules.FirstOrDefault(d => d.Date.Date == date.Date);

        if (daySchedule?.ScheduledHabits?.Any(h => h.HabitId == habit.Id) == true)
        {
            return false; // Already scheduled naturally
        }

        // Additional frequency-specific logic
        switch (habit.Frequency)
        {
            case HabitFrequency.Daily:
                return false; // ✅ Daily habits should NEVER be deferred - they can't reach this point anyway

            case HabitFrequency.EveryTwoDays:
                // Check if there's a 1-day gap from the last completion
                var lastCompletion = await _context.HabitCompletions
                    .Where(c => c.HabitId == habit.Id && c.IsCompleted)
                    .OrderByDescending(c => c.Date)
                    .FirstOrDefaultAsync();

                if (lastCompletion == null) return true;
                return (date - lastCompletion.Date).Days >= 1;

            case HabitFrequency.Weekly:
                // Weekly habits can be moved within the same week or to next week
                return true;

            case HabitFrequency.Monthly:
                // Monthly habits should stay within the same month if possible
                var originalMonth = DateTime.Today.Month;
                return date.Month == originalMonth || DateTime.Today.Day > 25; // Allow month overflow near end

            default:
                return true;
        }
    }

    private string GetDeferralFailureMessage(HabitFrequency frequency)
    {
        return frequency switch
        {
            HabitFrequency.Daily => "Cannot reschedule daily task. All remaining days in current and next week are fully booked.",
            HabitFrequency.EveryTwoDays => "Cannot reschedule this task. No suitable days available that respect the 2-day cycle.",
            HabitFrequency.Weekly => "Cannot reschedule weekly task. All remaining days this week are unsuitable or overloaded.",
            HabitFrequency.Monthly => "Cannot reschedule monthly task. No suitable days remaining this month.",
            HabitFrequency.Seasonal => "Cannot reschedule seasonal task. No nearby dates are available or suitable.",
            _ => "Cannot reschedule this task. No optimal dates found with current workload distribution."
        };
    }

    private async Task<DateTime?> FindNextAvailableDate(Habit habit, DateTime fromDate)
    {
        // Simple implementation: try tomorrow first
        var candidateDate = fromDate.AddDays(1);

        // Check up to 7 days ahead
        for (int i = 0; i < 7; i++)
        {
            if (await IsDateAvailable(habit, candidateDate))
            {
                return candidateDate;
            }
            candidateDate = candidateDate.AddDays(1);
        }

        return null; // No available date found
    }

    private async Task<bool> IsDateAvailable(Habit habit, DateTime date)
    {
        // Check if already deferred to this date
        var existingDeferral = await _context.TaskDeferrals
            .AnyAsync(d => d.HabitId == habit.Id && d.DeferredToDate.Date == date.Date);

        return !existingDeferral;
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
            // Create new deferral record
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

    // ==============================================================================
    // RESULT MODEL (Required by the service)
    // ==============================================================================
    public class SmartDeferralResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime? NewDueDate { get; set; }
        public int DeferralsUsed { get; set; }
        public int RemainingDeferrals { get; set; }
    }
}


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

    // Deferral fields
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