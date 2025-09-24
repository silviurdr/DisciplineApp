using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using DisciplineApp.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DisciplineController : ControllerBase
{
    private readonly DisciplineDbContext _context;
    private readonly WeeklyScheduleService _scheduleService;
    private readonly FlexibleTaskService _flexibleTaskService;
    private readonly IDailyStatsService _dailyStatsService;
    private static DateTime? _streakStartDate = DateTime.Now;
    private static bool _streakStartCalculated = false;

    public DisciplineController(DisciplineDbContext context, WeeklyScheduleService scheduleService, FlexibleTaskService flexibleTaskService, IDailyStatsService dailyStatsService)
    {
        _context = context;
        _scheduleService = scheduleService;
        _flexibleTaskService = flexibleTaskService;
        _dailyStatsService = dailyStatsService;
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "API is running", timestamp = DateTime.UtcNow });
    }

    [HttpGet("week/{year}/{month}/{day}")]
    public async Task<IActionResult> GetWeekData(int year, int month, int day)
    {
        try
        {
            var currentDate = new DateTime(year, month, day);
            var weekStart = GetWeekStart(currentDate);

            Console.WriteLine($"🔍 GetWeekData: Loading week starting {weekStart:yyyy-MM-dd}");

            // Generate the smart schedule for this week (includes deferral logic)
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);

            // ✅ NEW: Ensure today's stats are calculated
            var today = DateTime.Today;
            if (!await _dailyStatsService.AreStatsStoredForDate(today))
            {
                await _dailyStatsService.CalculateAndStoreDailyStatsAsync(today);
                Console.WriteLine($"🔄 Auto-calculated today's stats");
            }

            // ✅ NEW: Calculate stats for any missing days in current week
            for (int i = 0; i < 7; i++)
            {
                var date = weekStart.AddDays(i);
                if (date <= today && !await _dailyStatsService.AreStatsStoredForDate(date))
                {
                    await _dailyStatsService.CalculateAndStoreDailyStatsAsync(date);
                    Console.WriteLine($"🔄 Auto-calculated missing stats for {date:yyyy-MM-dd}");
                }
            }

            // Get actual completion data for the entire week
            var completions = await _context.HabitCompletions
                .Where(h => h.Date >= weekStart && h.Date <= weekStart.AddDays(6))
                .ToListAsync();

            // Get ad-hoc tasks for the entire week
            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date >= weekStart && t.Date <= weekStart.AddDays(6))
                .ToListAsync();

            // Build all 7 days data using the WeeklyScheduleService data
            var allDays = new List<object>();

            foreach (var daySchedule in weekSchedule.DailySchedules)
            {
                var dayCompletions = completions.Where(c => c.Date.Date == daySchedule.Date.Date).ToList();
                var dayAdHocTasks = adHocTasks.Where(t => t.Date.Date == daySchedule.Date.Date).ToList();

                // Use the daySchedule from WeeklyScheduleService (which respects deferrals)
                var dayData = await BuildDayResponse(daySchedule.Date, daySchedule, dayCompletions, dayAdHocTasks);
                allDays.Add(dayData);
            }

            // Find current day data
            var currentDayData = allDays.FirstOrDefault(d =>
                ((dynamic)d).date == currentDate.ToString("yyyy-MM-dd"));

            Console.WriteLine($"✅ GetWeekData: Returning {allDays.Count} days, current day tasks: {((dynamic)currentDayData)?.totalHabits ?? 0}");

            // Build response with complete week data
            var response = new
            {
                weekStartDate = weekStart.ToString("yyyy-MM-dd"),
                weekEndDate = weekStart.AddDays(6).ToString("yyyy-MM-dd"),
                currentDay = currentDayData,
                allDays = allDays,
                weeklyStats = new
                {
                    totalDays = 7,
                    completedDays = allDays.Count(d => (bool)((dynamic)d).isCompleted),
                    totalTasks = allDays.Sum(d => (int)((dynamic)d).totalHabits),
                    completedTasks = allDays.Sum(d => (int)((dynamic)d).completedHabits)
                }
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ GetWeekData error: {ex.Message}");
            return StatusCode(500, new { error = "Failed to load week data", details = ex.Message });
        }
    }

    [HttpPost("populate-week-stats")]
    public async Task<IActionResult> PopulateCurrentWeekStats()
    {
        try
        {
            var today = DateTime.Today;
            var weekStart = GetWeekStart(today);

            Console.WriteLine($"📊 Populating stats for week starting {weekStart:yyyy-MM-dd}");

            var populatedDays = new List<object>();

            // Calculate stats for each day of current week (only past and today)
            for (int i = 0; i < 7; i++)
            {
                var date = weekStart.AddDays(i);

                // Only calculate for past days and today, not future days
                if (date <= today)
                {
                    // Check if stats already exist
                    var alreadyExists = await _dailyStatsService.AreStatsStoredForDate(date);

                    if (!alreadyExists)
                    {
                        // Calculate and store new stats
                        var stats = await _dailyStatsService.CalculateAndStoreDailyStatsAsync(date);

                        populatedDays.Add(new
                        {
                            date = date.ToString("yyyy-MM-dd"),
                            status = "calculated",
                            isCompleted = stats.IsDayCompleted,
                            completedTasks = stats.CompletedTasks,
                            totalTasks = stats.TotalTasks,
                            completionPercentage = stats.CompletionPercentage,
                            streakDayNumber = stats.StreakDayNumber
                        });

                        Console.WriteLine($"✅ Calculated stats for {date:yyyy-MM-dd}: {stats.CompletedTasks}/{stats.TotalTasks}");
                    }
                    else
                    {
                        // Stats already exist, get existing data
                        var existingStats = await _context.DailyStats
                            .FirstOrDefaultAsync(d => d.Date.Date == date.Date);

                        populatedDays.Add(new
                        {
                            date = date.ToString("yyyy-MM-dd"),
                            status = "already_exists",
                            isCompleted = existingStats?.IsDayCompleted ?? false,
                            completedTasks = existingStats?.CompletedTasks ?? 0,
                            totalTasks = existingStats?.TotalTasks ?? 0,
                            completionPercentage = existingStats?.CompletionPercentage ?? 0,
                            streakDayNumber = existingStats?.StreakDayNumber ?? 0
                        });

                        Console.WriteLine($"📋 Stats already exist for {date:yyyy-MM-dd}");
                    }
                }
            }

            var response = new
            {
                message = "Current week stats populated successfully",
                weekStart = weekStart.ToString("yyyy-MM-dd"),
                weekEnd = weekStart.AddDays(6).ToString("yyyy-MM-dd"),
                populatedDays = populatedDays,
                summary = new
                {
                    totalDaysProcessed = populatedDays.Count,
                    newlyCalculated = populatedDays.Count(d => ((dynamic)d).status == "calculated"),
                    alreadyExisted = populatedDays.Count(d => ((dynamic)d).status == "already_exists")
                }
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error populating week stats: {ex.Message}");
            return StatusCode(500, new { error = "Failed to populate week stats", details = ex.Message });
        }
    }

    // Add this new helper method to build individual day responses
    // CORRECTED BuildDayResponse - matches your existing structure with performance fix
    private async Task<object> BuildDayResponse(DateTime date, DailySchedule daySchedule,
        List<HabitCompletion> completions, List<AdHocTask> adHocTasks)
    {
        // Map scheduled habits to API response format
        var allHabits = new List<object>();

        foreach (var scheduledHabit in daySchedule.ScheduledHabits)
        {
            // Check if this habit is completed
            var completion = completions.FirstOrDefault(c => c.HabitId == scheduledHabit.HabitId);
            var isCompleted = completion?.IsCompleted ?? false;

            // Get habit from database to check IsOptional (same logic as BuildCurrentDayResponse)
            var habit = await _context.Habits.FindAsync(scheduledHabit.HabitId);
            var isRequired = habit?.IsOptional != true; // If IsOptional is true, then NOT required
            var priority = habit?.IsOptional == true ? "Optional" : "Required";

            // ✅ CALCULATE TIME REMAINING FOR REGULAR HABITS
            string? timeRemaining = null;
            bool isOverdue = false;

            if (scheduledHabit.HasDeadline && !isCompleted)
            {
                var deadlineTime = scheduledHabit.DeadlineTime;
                var todayDeadline = DateTime.Today.Add(deadlineTime.ToTimeSpan());
                var now = DateTime.Now;

                if (now > todayDeadline)
                {
                    // Past deadline = overdue
                    isOverdue = true;
                    timeRemaining = null;
                }
                else
                {
                    // Calculate remaining time
                    var timeDiff = todayDeadline - now;
                    var hoursLeft = (int)timeDiff.TotalHours;
                    var minutesLeft = timeDiff.Minutes;

                    if (hoursLeft > 0)
                    {
                        timeRemaining = minutesLeft > 0 && hoursLeft < 6 ?
                            $"{hoursLeft}h {minutesLeft}m" : $"{hoursLeft}h";
                    }
                    else
                    {
                        timeRemaining = $"{minutesLeft}m";
                    }
                }
            }

            allHabits.Add(new
            {
                habitId = scheduledHabit.HabitId,
                name = scheduledHabit.HabitName,
                description = scheduledHabit.Description,
                isCompleted = isCompleted,
                isRequired = isRequired,
                isLocked = scheduledHabit.IsLocked,
                hasDeadline = scheduledHabit.HasDeadline,
                deadlineTime = scheduledHabit.HasDeadline ? scheduledHabit.DeadlineTime.ToString("HH:mm") : null,
                priority = priority,
                reason = scheduledHabit.Reason,
                frequency = scheduledHabit.Frequency,
                deferralsUsed = scheduledHabit.DeferralsUsed,
                maxDeferrals = scheduledHabit.MaxDeferrals,
                canStillBeDeferred = scheduledHabit.CanStillBeDeferred,
                originalScheduledDate = scheduledHabit.OriginalScheduledDate?.ToString("yyyy-MM-dd"),
                currentDueDate = scheduledHabit.CurrentDueDate?.ToString("yyyy-MM-dd"),
                isAdHoc = false,
                adHocId = (int?)null,
                isOverdue = isOverdue,
                timeRemaining = timeRemaining, // ✅ NOW CALCULATED!,
                estimatedDurationMinutes = habit?.EstimatedDurationMinutes ?? 30
            });
        }

        // ✅ ADD AD-HOC TASKS WITH PROPER TIME REMAINING CALCULATION
        foreach (var adHocTask in adHocTasks)
        {
            string priority = "Required";
            string? timeRemaining = null;
            bool isOverdue = false;

            // ✅ USE DEADLINEDATE TO CALCULATE TIME REMAINING
            if (adHocTask.DeadlineDate != null && !adHocTask.IsCompleted)
            {
                var deadlineDate = adHocTask.DeadlineDate.Value;
                var now = DateTime.Now;

                // Check if deadline is today or future date
                var isToday = deadlineDate.Date == DateTime.Today;

                DateTime deadline;
                if (isToday)
                {
                    // For same-day deadlines, use end of day (23:59)
                    deadline = deadlineDate.Date.AddHours(23).AddMinutes(59);
                }
                else
                {
                    // For future dates, use end of that day
                    deadline = deadlineDate.Date.AddHours(23).AddMinutes(59);
                }

                if (now > deadline)
                {
                    // Past deadline = overdue
                    isOverdue = true;
                    timeRemaining = null;
                }
                else
                {
                    // Calculate remaining time
                    var timeDiff = deadline - now;
                    var daysLeft = (int)timeDiff.TotalDays;
                    var hoursLeft = timeDiff.Hours;
                    var minutesLeft = timeDiff.Minutes;

                    // ✅ ENHANCED: Different format for today vs future days
                    if (isToday)
                    {
                        // Same day - show hours and minutes for precision
                        if (hoursLeft > 0)
                        {
                            if (hoursLeft < 6 && minutesLeft > 0)
                            {
                                timeRemaining = $"{hoursLeft}h {minutesLeft}m"; // "5h 23m"
                            }
                            else
                            {
                                timeRemaining = $"{hoursLeft}h"; // "12h" (for longer periods)
                            }
                        }
                        else
                        {
                            timeRemaining = $"{minutesLeft}m"; // "45m" (less than 1 hour)
                        }
                    }
                    else
                    {
                        // Future days - show day format WITHOUT MINUTES (cleaner for distant tasks)
                        if (daysLeft > 1)
                        {
                            // More than 1 day away - simple format
                            timeRemaining = hoursLeft > 0 ? $"{daysLeft}d {hoursLeft}h" : $"{daysLeft}d";
                        }
                        else if (daysLeft == 1)
                        {
                            // ✅ TOMORROW - NO MINUTES (cleaner for future tasks)
                            timeRemaining = hoursLeft > 0 ? $"1d {hoursLeft}h" : $"1d";
                        }
                        else
                        {
                            // Same day logic (shouldn't reach here for future dates, but just in case)
                            if (hoursLeft > 0)
                            {
                                if (hoursLeft < 12 && minutesLeft > 0)
                                {
                                    timeRemaining = $"{hoursLeft}h {minutesLeft}m";
                                }
                                else
                                {
                                    timeRemaining = $"{hoursLeft}h";
                                }
                            }
                            else
                            {
                                timeRemaining = $"{minutesLeft}m";
                            }
                        }
                    }
                }

                // Set priority based on deadline
                var deadlineDateOnly = adHocTask.DeadlineDate.Value.Date;
                var currentDate = DateTime.Today;

                if (deadlineDateOnly > currentDate)
                {
                    priority = "Optional";
                }
            }

            allHabits.Add(new
            {
                habitId = (int?)null,
                name = adHocTask.Name,
                description = adHocTask.Description,
                isCompleted = adHocTask.IsCompleted,
                isRequired = priority == "Required",
                isLocked = false,
                hasDeadline = adHocTask.DeadlineDate != null,
                deadlineTime = adHocTask.DeadlineDate != null ? "23:59" : null,
                deadlineDate = adHocTask.DeadlineDate?.ToString("yyyy-MM-dd"),
                priority = priority,
                reason = "Ad-hoc task",
                frequency = "Daily",
                deferralsUsed = 0,
                maxDeferrals = 0,
                canStillBeDeferred = false,
                originalScheduledDate = (string?)null,
                currentDueDate = (string?)null,
                isAdHoc = true,
                adHocId = adHocTask.Id,
                isOverdue = isOverdue,
                timeRemaining = timeRemaining, // ✅ NOW WITH MINUTES FOR TODAY!
                estimatedDurationMinutes = adHocTask.EstimatedDurationMinutes ?? 30

            });
        }

        // ✅ CALCULATE DAY STATISTICS
        var totalHabits = allHabits.Count;
        var completedHabits = allHabits.Count(h => (bool)((dynamic)h).isCompleted);
        var requiredHabits = allHabits.Where(h => (bool)((dynamic)h).isRequired).ToList();
        var completedRequired = requiredHabits.Count(h => (bool)((dynamic)h).isCompleted);

        // ✅ PHONE LOCK-BASED COMPLETION (like your original logic)
        var streakStartDate = _streakStartDate;
        var daysSinceStart = streakStartDate.HasValue ? (date.Date - streakStartDate.Value.Date).Days + 1 : 0;
        bool isInFirst7Days = daysSinceStart <= 7;

        bool dayIsCompleted = false;

        if (isInFirst7Days)
        {
            // ✅ FIRST 7 DAYS: Only check Phone Lock task
            var phoneLockHabit = allHabits.FirstOrDefault(h =>
                ((dynamic)h).name.Contains("Phone Lock") ||
                ((dynamic)h).name.Contains("phone") ||
                ((dynamic)h).name.ToLower().Contains("lock"));

            if (phoneLockHabit != null)
            {
                dayIsCompleted = (bool)((dynamic)phoneLockHabit).isCompleted;
            }
        }
        else
        {
            // ✅ AFTER 7 DAYS: All required habits must be completed
            dayIsCompleted = completedRequired == requiredHabits.Count && requiredHabits.Count > 0;
        }

        // ✅ RETURN WITH CORRECT COMPLETION STATUS
        return new
        {
            date = date.ToString("yyyy-MM-dd"),
            allHabits = allHabits,
            isCompleted = dayIsCompleted,        // ✅ Based on Phone Lock for first 7 days!
            isPartiallyCompleted = completedHabits > 0 && !dayIsCompleted,
            totalHabits = totalHabits,
            completedHabits = completedHabits,
            requiredHabitsCount = requiredHabits.Count,
            completedRequiredCount = completedRequired,
            dayInStreak = daysSinceStart
        };
    }

    [HttpGet("month/{year}/{month}")]
    public async Task<ActionResult> GetMonthData(int year, int month)
    {
        try
        {
            Console.WriteLine($"🗓️ GetMonthData called for {month}/{year}");

            // Validate input
            if (month < 1 || month > 12)
            {
                return BadRequest("Month must be between 1 and 12");
            }

            // Calculate month boundaries
            var monthStart = new DateTime(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            Console.WriteLine($"📅 Getting month data from {monthStart:yyyy-MM-dd} to {monthEnd:yyyy-MM-dd}");

            // Get ALL stored daily stats for the month (this gets your historical data)
            var dailyStats = await _dailyStatsService.GetMonthlyStatsAsync(year, month);
            Console.WriteLine($"📊 Found {dailyStats.Count} stored daily stats");

            // ✅ ALSO get any DailyStats from previous/next months that might be displayed in calendar grid
            // This ensures we get data for days like Aug 31, Oct 1 etc. that show in the calendar
            var extendedStartDate = monthStart.AddDays(-10); // Get a few days before month start
            var extendedEndDate = monthEnd.AddDays(10);       // Get a few days after month end

            var extendedStats = await _context.DailyStats
                .Where(d => d.Date >= extendedStartDate && d.Date <= extendedEndDate)
                .OrderBy(d => d.Date)
                .ToListAsync();

            Console.WriteLine($"📊 Found {extendedStats.Count} total daily stats (including adjacent days)");

            // Build response for each day that has DailyStats data
            var monthDays = new List<object>();

            // ✅ CHANGED: Include ALL days that have DailyStats, not just days in current month
            foreach (var dailyStat in extendedStats)
            {
                monthDays.Add(new
                {
                    date = dailyStat.Date.ToString("yyyy-MM-dd"),
                    isCompleted = dailyStat.IsDayCompleted,
                    isPartiallyCompleted = dailyStat.CompletedTasks > 0 && !dailyStat.IsDayCompleted,
                    completedHabits = dailyStat.CompletedTasks,
                    totalHabits = dailyStat.TotalTasks,
                    requiredHabitsCount = dailyStat.RequiredTasks,
                    completedRequiredCount = dailyStat.CompletedRequiredTasks,
                    completionPercentage = dailyStat.CompletionPercentage,
                    streakDayNumber = dailyStat.StreakDayNumber,
                    isInFirst7Days = dailyStat.IsInFirst7Days,
                    completionRules = dailyStat.CompletionRules,
                    dataSource = "stored_daily_stats"
                });

                Console.WriteLine($"📊 {dailyStat.Date:MM-dd}: {dailyStat.CompletedTasks}/{dailyStat.TotalTasks} ({dailyStat.IsDayCompleted})");
            }

            // Handle today if it's not already in DailyStats
            var today = DateTime.Today;
            var todayInMonth = today.Month == month && today.Year == year;
            var todayStats = extendedStats.FirstOrDefault(d => d.Date.Date == today);

            if (todayInMonth && todayStats == null)
            {
                // Calculate today's stats in real-time
                Console.WriteLine($"📊 Calculating real-time stats for today ({today:yyyy-MM-dd})");
                var calculatedStats = await _dailyStatsService.CalculateAndStoreDailyStatsAsync(today);

                monthDays.Add(new
                {
                    date = today.ToString("yyyy-MM-dd"),
                    isCompleted = calculatedStats.IsDayCompleted,
                    isPartiallyCompleted = calculatedStats.CompletedTasks > 0 && !calculatedStats.IsDayCompleted,
                    completedHabits = calculatedStats.CompletedTasks,
                    totalHabits = calculatedStats.TotalTasks,
                    requiredHabitsCount = calculatedStats.RequiredTasks,
                    completedRequiredCount = calculatedStats.CompletedRequiredTasks,
                    completionPercentage = calculatedStats.CompletionPercentage,
                    streakDayNumber = calculatedStats.StreakDayNumber,
                    isInFirst7Days = calculatedStats.IsInFirst7Days,
                    completionRules = calculatedStats.CompletionRules,
                    dataSource = "calculated_for_today"
                });
            }

            // Calculate monthly statistics from the daily stats
            var monthlyStats = CalculateMonthlyStatsFromDailyStats(dailyStats, monthStart, monthEnd);

            var response = new
            {
                year = year,
                month = month,
                monthStart = monthStart.ToString("yyyy-MM-dd"),
                monthEnd = monthEnd.ToString("yyyy-MM-dd"),
                days = monthDays,
                monthlyStats = monthlyStats,
                dataSource = "daily_stats_with_extended_range",
                totalDaysWithStoredStats = extendedStats.Count,
                totalDaysInResponse = monthDays.Count
            };

            Console.WriteLine($"✅ GetMonthData: Returning {monthDays.Count} days with {extendedStats.Count} from stored stats");
            return Ok(response);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ GetMonthData error: {ex.Message}");
            return StatusCode(500, new { error = $"Failed to get month data: {ex.Message}" });
        }
    }

    private object CalculateMonthlyStatsFromDailyStats(List<DailyStats> dailyStats, DateTime monthStart, DateTime monthEnd)
    {
        // Only consider past days for statistics (not today or future)
        var pastDays = dailyStats.Where(d => d.Date < DateTime.Today).ToList();

        var totalDays = pastDays.Count;
        var completedDays = pastDays.Count(d => d.IsDayCompleted);
        var partialDays = pastDays.Count(d => !d.IsDayCompleted && d.CompletedTasks > 0);
        var incompleteDays = pastDays.Count(d => d.CompletedTasks == 0);

        return new
        {
            totalDays = totalDays,
            completedDays = completedDays,
            partialDays = partialDays,
            incompleteDays = incompleteDays,
            completionRate = totalDays > 0 ?
                Math.Round((double)completedDays / totalDays * 100, 1) : 0,
            totalTasks = pastDays.Sum(d => d.TotalTasks),
            completedTasks = pastDays.Sum(d => d.CompletedTasks),
            taskCompletionRate = pastDays.Sum(d => d.TotalTasks) > 0 ?
                Math.Round((double)pastDays.Sum(d => d.CompletedTasks) / pastDays.Sum(d => d.TotalTasks) * 100, 1) : 0,
            averageTasksPerDay = totalDays > 0 ?
                Math.Round((double)pastDays.Sum(d => d.TotalTasks) / totalDays, 1) : 0,
            averageCompletedPerDay = totalDays > 0 ?
                Math.Round((double)pastDays.Sum(d => d.CompletedTasks) / totalDays, 1) : 0,
            currentStreak = CalculateCurrentStreakFromDailyStats(dailyStats),
            monthName = monthStart.ToString("MMMM")
        };
    }

    private int CalculateCurrentStreakFromDailyStats(List<DailyStats> dailyStats)
    {
        var sortedStats = dailyStats
            .Where(d => d.Date < DateTime.Today) // Only consider today and past
            .OrderByDescending(d => d.Date)
            .ToList();

        var streak = 0;
        foreach (var stat in sortedStats)
        {
            if (stat.IsDayCompleted)
            {
                streak++;
            }
            else
            {
                break; // Streak broken
            }
        }

        return streak;
    }

    //// Add this method to your DisciplineController.cs

    //[HttpGet("month/{year}/{month}")]
    //public async Task<IActionResult> GetMonthData(int year, int month)
    //{
    //    try
    //    {
    //        // Calculate month boundaries
    //        var monthStart = new DateTime(year, month, 1);
    //        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

    //        // Get all completion data for the month
    //        var completions = await _context.HabitCompletions
    //            .Where(h => h.Date >= monthStart && h.Date <= monthEnd)
    //            .ToListAsync();

    //        // Get all ad-hoc tasks for the month
    //        var adHocTasks = await _context.AdHocTasks
    //            .Where(t => t.Date >= monthStart && t.Date <= monthEnd)
    //            .ToListAsync();

    //        var monthDays = new List<object>();

    //        // Generate data for each day of the month
    //        for (var date = monthStart; date <= monthEnd; date = date.AddDays(1))
    //        {
    //            // Generate weekly schedule for this day to get the planned habits
    //            var weekStart = GetWeekStart(date);
    //            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);

    //            // Find the day's schedule
    //            var daySchedule = weekSchedule.DailySchedules.FirstOrDefault(d => d.Date.Date == date.Date);

    //            // Get completions and ad-hoc tasks for this specific day
    //            var dayCompletions = completions.Where(c => c.Date.Date == date.Date).ToList();
    //            var dayAdHocTasks = adHocTasks.Where(t => t.Date.Date == date.Date).ToList();

    //            // Build day data
    //            var dayData = await BuildDayResponse(date, daySchedule ?? new DailySchedule
    //            {
    //                Date = date,
    //                ScheduledHabits = new List<ScheduledHabit>()
    //            }, dayCompletions, dayAdHocTasks);

    //            monthDays.Add(dayData);
    //        }

    //        // Calculate monthly statistics
    //        var monthlyStats = CalculateMonthlyStats(monthDays, monthStart, monthEnd);

    //        var response = new
    //        {
    //            year = year,
    //            month = month,
    //            monthStart = monthStart.ToString("yyyy-MM-dd"),
    //            monthEnd = monthEnd.ToString("yyyy-MM-dd"),
    //            days = monthDays,
    //            monthlyStats = monthlyStats
    //        };

    //        return Ok(response);
    //    }
    //    catch (Exception ex)
    //    {
    //        return StatusCode(500, new { error = $"Failed to get month data: {ex.Message}" });
    //    }
    //}

    // Helper method to calculate monthly statistics
    private object CalculateMonthlyStats(List<object> monthDays, DateTime monthStart, DateTime monthEnd)
    {
        var totalDays = monthDays.Count;
        var completedDays = 0;
        var partialDays = 0;
        var totalTasks = 0;
        var completedTasks = 0;

        foreach (dynamic day in monthDays)
        {
            if (day.isCompleted == true) completedDays++;
            else if (day.isPartiallyCompleted == true) partialDays++;

            totalTasks += (int)(day.totalHabits ?? 0);
            completedTasks += (int)(day.completedHabits ?? 0);
        }

        var completionRate = totalDays > 0 ? Math.Round((double)completedDays / totalDays * 100, 1) : 0;
        var taskCompletionRate = totalTasks > 0 ? Math.Round((double)completedTasks / totalTasks * 100, 1) : 0;

        return new
        {
            totalDays = totalDays,
            completedDays = completedDays,
            partialDays = partialDays,
            incompleteDays = totalDays - completedDays - partialDays,
            completionRate = completionRate,
            totalTasks = totalTasks,
            completedTasks = completedTasks,
            taskCompletionRate = taskCompletionRate,
            currentStreak = CalculateCurrentStreak(monthDays),
            monthName = monthStart.ToString("MMMM"),
            averageTasksPerDay = totalDays > 0 ? Math.Round((double)totalTasks / totalDays, 1) : 0
        };
    }

    // Helper method to calculate current streak from month data
    private int CalculateCurrentStreak(List<object> monthDays)
    {
        int streak = 0;
        var today = DateTime.Today;

        // Convert to array and reverse it to count backwards from the last day
        var reversedDays = monthDays.ToArray().Reverse();

        foreach (var dayObj in reversedDays)
        {
            // Cast to dynamic to access properties
            dynamic day = dayObj;

            // Parse the date string safely
            if (DateTime.TryParse((string)day.date, out var dayDate))
            {
                // ✅ SKIP today completely - only count past days
                if (dayDate >= today) continue;

                if (day.isCompleted == true)
                {
                    streak++;
                }
                else
                {
                    break; // Streak is broken by an incomplete past day
                }
            }
        }

        return streak;
    }

    // ✅ UPDATED: Complete habit with automatic stats calculation
    [HttpPost("complete-habit")]
    public async Task<IActionResult> CompleteHabit([FromBody] CompleteHabitRequest request)
    {
        try
        {
            var habit = await _context.Habits.FindAsync(request.HabitId);
            if (habit == null)
            {
                return NotFound(new { error = "Habit not found" });
            }

            if (habit.HasDeadline && request.Date.Date == DateTime.Today)
            {
                var currentTime = TimeOnly.FromDateTime(DateTime.Now);
                var deadlineTime = habit?.DeadlineTime ?? TimeOnly.MaxValue;

                if (currentTime > deadlineTime && request.IsCompleted)
                {
                    return BadRequest($"Cannot complete {habit.Name} after {deadlineTime:HH:mm}. Deadline has passed.");
                }
            }

            var existingCompletion = await _context.HabitCompletions
                .FirstOrDefaultAsync(h => h.HabitId == request.HabitId && h.Date.Date == request.Date.Date);

            if (existingCompletion != null)
            {
                existingCompletion.IsCompleted = request.IsCompleted;
                existingCompletion.CompletedAt = request.IsCompleted ? DateTime.UtcNow : null;
                existingCompletion.Notes = request.Notes ?? "";
            }
            else
            {
                _context.HabitCompletions.Add(new HabitCompletion
                {
                    HabitId = request.HabitId,
                    Date = request.Date.Date,
                    IsCompleted = request.IsCompleted,
                    CompletedAt = request.IsCompleted ? DateTime.UtcNow : null,
                    Notes = request.Notes ?? ""
                });
            }

            await _context.SaveChangesAsync();

            // ✅ NEW: Automatically update daily stats when a habit is completed
            var updatedStats = await _dailyStatsService.CalculateAndStoreDailyStatsAsync(request.Date.Date);

            // Return updated day data using current calculation method
            var weekStart = GetWeekStart(request.Date);
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);
            var completions = await _context.HabitCompletions
                .Where(h => h.Date.Date == request.Date.Date)
                .ToListAsync();
            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date.Date == request.Date.Date)
                .ToListAsync();

            var dayResponse = await BuildCurrentDayResponse(request.Date, weekSchedule, completions, adHocTasks);

            Console.WriteLine($"📊 Updated daily stats: {updatedStats.CompletedTasks}/{updatedStats.TotalTasks}, completed: {updatedStats.IsDayCompleted}");

            return Ok(dayResponse);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }



    [HttpPost("add-adhoc-task")]
    public async Task<IActionResult> AddAdHocTask([FromBody] AddAdHocTaskRequest request)
    {
        try
        {
            var task = new AdHocTask
            {
                Name = request.Name,
                Description = request.Description,
                Date = request.Date == default(DateTime) ? DateTime.Today : request.Date,
                // ✅ NEW: If no deadline provided, automatically set it to today
                DeadlineDate = request.DeadlineDate ?? DateTime.Today,
                CreatedAt = DateTime.UtcNow,
                Notes = "Test",
                EstimatedDurationMinutes = request.EstimatedDurationMinutes ?? 30,
            };

            _context.AdHocTasks.Add(task);
            await _context.SaveChangesAsync();
            var updatedStats = await _dailyStatsService.CalculateAndStoreDailyStatsAsync(task.Date.Date);


            // CRITICAL: Return the created task with its real database ID
            var createdTaskResponse = new
            {
                id = task.Id,           // This is the real database ID we need!
                adHocId = task.Id,      // Use the same ID for adHocId
                habitId = (int?)null,   // Ad-hoc tasks don't have habitId
                name = task.Name,
                description = task.Description,
                date = task.Date.ToString("yyyy-MM-dd"),
                isCompleted = task.IsCompleted,
                isAdHoc = true,
                deadlineDate = task.DeadlineDate?.ToString("yyyy-MM-dd"),
                createdAt = task.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                estimatedDurationMinutes = task.EstimatedDurationMinutes ?? 30
            };

            // Also return updated day status including the new ad-hoc task
            var weekStart = GetWeekStart(request.Date);
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);
            var completions = await _context.HabitCompletions
                .Where(h => h.Date.Date == request.Date.Date)
                .ToListAsync();
            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date.Date == request.Date.Date)
                .ToListAsync();

            var dayResponse = await BuildCurrentDayResponse(request.Date, weekSchedule, completions, adHocTasks);

            // Return both the created task AND the updated day data
            return Ok(new
            {
                task = createdTaskResponse,  // NEW: The created task with real ID
                dayData = dayResponse,       // The updated day data
                message = "Ad-hoc task created successfully"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("calculate-daily-stats")]
    public async Task<IActionResult> CalculateDailyStats([FromBody] CalculateStatsRequest request)
    {
        try
        {
            await _dailyStatsService.RecalculateStatsForPeriodAsync(request.StartDate, request.EndDate);

            var dayCount = (request.EndDate - request.StartDate).Days + 1;

            return Ok(new
            {
                message = $"Successfully calculated daily stats for {dayCount} days",
                startDate = request.StartDate.ToString("yyyy-MM-dd"),
                endDate = request.EndDate.ToString("yyyy-MM-dd"),
                daysProcessed = dayCount
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Failed to calculate daily stats: {ex.Message}" });
        }
    }

    //// ✅ HELPER: Calculate monthly stats from daily stats
    //private object CalculateMonthlyStatsFromDailyStats(List<DailyStats> dailyStats, DateTime monthStart, DateTime monthEnd)
    //{
    //    var pastDays = dailyStats.Where(d => d.Date < DateTime.Today).ToList();

    //    return new
    //    {
    //        totalDays = pastDays.Count,
    //        completedDays = pastDays.Count(d => d.IsDayCompleted),
    //        partialDays = pastDays.Count(d => !d.IsDayCompleted && d.CompletedTasks > 0),
    //        incompleteDays = pastDays.Count(d => d.CompletedTasks == 0),
    //        completionRate = pastDays.Count > 0 ?
    //            Math.Round((double)pastDays.Count(d => d.IsDayCompleted) / pastDays.Count * 100, 1) : 0,
    //        totalTasks = pastDays.Sum(d => d.TotalTasks),
    //        completedTasks = pastDays.Sum(d => d.CompletedTasks),
    //        taskCompletionRate = pastDays.Sum(d => d.TotalTasks) > 0 ?
    //            Math.Round((double)pastDays.Sum(d => d.CompletedTasks) / pastDays.Sum(d => d.TotalTasks) * 100, 1) : 0,
    //        averageTasksPerDay = pastDays.Count > 0 ?
    //            Math.Round((double)pastDays.Sum(d => d.TotalTasks) / pastDays.Count, 1) : 0,
    //        monthName = monthStart.ToString("MMMM")
    //    };
    //}

    // Add to your DisciplineController.cs

    [HttpPut("edit-adhoc-task/{taskId}")]
    public async Task<IActionResult> EditAdHocTask(int taskId, [FromBody] EditAdHocTaskRequest request)
    {
        try
        {
            var task = await _context.AdHocTasks.FindAsync(taskId);
            if (task == null)
            {
                return NotFound(new { error = "Task not found" });
            }

            // Update the task details
            task.Name = request.Name.Trim();
            task.Description = request.Description?.Trim() ?? "";
            task.EstimatedDurationMinutes = request.EstimatedDurationMinutes ?? task.EstimatedDurationMinutes;

            await _context.SaveChangesAsync();

            // Return updated day status
            var weekStart = GetWeekStart(task.Date);
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);
            var completions = await _context.HabitCompletions
                .Where(h => h.Date.Date == task.Date.Date)
                .ToListAsync();
            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date.Date == task.Date.Date)
                .ToListAsync();

            var dayResponse = await BuildCurrentDayResponse(task.Date, weekSchedule, completions, adHocTasks);

            return Ok(new
            {
                message = "Ad-hoc task updated successfully",
                dayData = dayResponse
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // Request model
    public class EditAdHocTaskRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int? EstimatedDurationMinutes { get; set; }
    }

    [HttpPost("complete-adhoc-task")]
    public async Task<IActionResult> CompleteAdHocTask([FromBody] CompleteAdHocTaskRequest request)
    {
        try
        {
            var task = await _context.AdHocTasks.FindAsync(request.TaskId);
            if (task == null)
            {
                return NotFound(new { error = "Task not found" });
            }

            task.IsCompleted = request.IsCompleted;
            task.CompletedAt = request.IsCompleted ? DateTime.UtcNow : null;

            await _context.SaveChangesAsync();

            var updatedStats = await _dailyStatsService.CalculateAndStoreDailyStatsAsync(task.Date.Date);

            return Ok(new { message = "Ad-hoc task updated successfully" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("day/{date}/flexible-tasks")]
    public async Task<ActionResult<List<HabitWithFlexibility>>> GetFlexibleTasksForDay(DateTime date)
    {
        try
        {
            var tasks = await _flexibleTaskService.GetDayTasksWithFlexibility(date);
            return Ok(tasks);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error getting flexible tasks: {ex.Message}");
        }
    }

    [HttpPost("defer-task")]
    public async Task<ActionResult<HabitWithFlexibility>> DeferTask([FromBody] DeferTaskRequest request)
    {
        try
        {
            if (!await _flexibleTaskService.CanDeferTask(request.HabitId, request.FromDate))
            {
                return BadRequest("Cannot defer this task - no deferrals remaining or not allowed");
            }

            var result = await _flexibleTaskService.DeferTaskToTomorrow(
                request.HabitId,
                request.FromDate,
                request.Reason ?? "Moved by user request"
            );

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error deferring task: {ex.Message}");
        }
    }

    [HttpGet("task/{habitId}/can-defer")]
    public async Task<ActionResult<bool>> CanDeferTask(int habitId, DateTime fromDate)
    {
        var canDefer = await _flexibleTaskService.CanDeferTask(habitId, fromDate);
        return Ok(canDefer);
    }

    // In your DisciplineController.cs, update the BuildCurrentDayResponse method signature:

    // CORRECTED BuildCurrentDayResponse - matches your existing structure
    // REPLACE your BuildCurrentDayResponse method in DisciplineController.cs with this fixed version:

    private async Task<object> BuildCurrentDayResponse(DateTime date, WeekSchedule weekSchedule, List<HabitCompletion> completions, List<AdHocTask> adHocTasks)
    {
        var daySchedule = weekSchedule.DailySchedules.FirstOrDefault(d => d.Date.Date == date.Date);
        if (daySchedule == null)
        {
            return new
            {
                allHabits = new List<object>(),
                isCompleted = false,
                totalHabits = 0,
                completedHabits = 0
            };
        }

        var allHabits = new List<object>();

        // Add scheduled habits
        foreach (var scheduledHabit in daySchedule.ScheduledHabits)
        {
            var completion = completions.FirstOrDefault(c => c.HabitId == scheduledHabit.HabitId);
            var isCompleted = completion?.IsCompleted ?? false;

            // Get habit from database to check IsOptional
            var habit = await _context.Habits.FindAsync(scheduledHabit.HabitId);
            var isRequired = habit?.IsOptional != true;
            var priority = habit?.IsOptional == true ? "Optional" : "Required";

            // ✅ CALCULATE TIME REMAINING FOR REGULAR HABITS
            string? timeRemaining = null;
            bool isOverdue = false;

            if (scheduledHabit.HasDeadline && !isCompleted)
            {
                var deadlineTime = scheduledHabit.DeadlineTime;
                var todayDeadline = DateTime.Today.Add(deadlineTime.ToTimeSpan());
                var now = DateTime.Now;

                if (now > todayDeadline)
                {
                    // Past deadline = overdue
                    isOverdue = true;
                    timeRemaining = null;
                }
                else
                {
                    // Calculate remaining time
                    var timeDiff = todayDeadline - now;
                    var hoursLeft = (int)timeDiff.TotalHours;
                    var minutesLeft = timeDiff.Minutes;

                    if (hoursLeft > 0)
                    {
                        timeRemaining = minutesLeft > 0 && hoursLeft < 6 ?
                            $"{hoursLeft}h {minutesLeft}m" : $"{hoursLeft}h";
                    }
                    else
                    {
                        timeRemaining = $"{minutesLeft}m";
                    }
                }
            }

            allHabits.Add(new
            {
                habitId = scheduledHabit.HabitId,
                name = scheduledHabit.HabitName,
                description = scheduledHabit.Description,
                isCompleted = isCompleted,
                isRequired = isRequired,
                isLocked = scheduledHabit.IsLocked,
                hasDeadline = scheduledHabit.HasDeadline,
                deadlineTime = scheduledHabit.HasDeadline ? scheduledHabit.DeadlineTime.ToString("HH:mm") : null,
                priority = priority,
                reason = scheduledHabit.Reason,
                frequency = scheduledHabit.Frequency,
                deferralsUsed = scheduledHabit.DeferralsUsed,
                maxDeferrals = scheduledHabit.MaxDeferrals,
                canStillBeDeferred = scheduledHabit.CanStillBeDeferred,
                originalScheduledDate = scheduledHabit.OriginalScheduledDate?.ToString("yyyy-MM-dd"),
                currentDueDate = scheduledHabit.CurrentDueDate?.ToString("yyyy-MM-dd"),
                isAdHoc = false,
                adHocId = (int?)null,
                isOverdue = isOverdue,
                timeRemaining = timeRemaining // ✅ NOW CALCULATED!
            });
        }

        // Add ad-hoc tasks
        foreach (var adHocTask in adHocTasks)
        {
            string priority = "Required";
            string? timeRemaining = null;
            bool isOverdue = false;

            // ✅ USE DEADLINEDATE TO CALCULATE TIME REMAINING
            if (adHocTask.DeadlineDate != null && !adHocTask.IsCompleted)
            {
                var deadlineDate = adHocTask.DeadlineDate.Value;
                var now = DateTime.Now;

                // Check if deadline is today or future date
                var isToday = deadlineDate.Date == DateTime.Today;

                DateTime deadline;
                if (isToday)
                {
                    // For same-day deadlines, use end of day (23:59)
                    deadline = deadlineDate.Date.AddHours(23).AddMinutes(59);
                }
                else
                {
                    // For future dates, use end of that day
                    deadline = deadlineDate.Date.AddHours(23).AddMinutes(59);
                }

                if (now > deadline)
                {
                    // Past deadline = overdue
                    isOverdue = true;
                    timeRemaining = null;
                }
                else
                {
                    // Calculate remaining time
                    var timeDiff = deadline - now;
                    var daysLeft = (int)timeDiff.TotalDays;
                    var hoursLeft = timeDiff.Hours;
                    var minutesLeft = timeDiff.Minutes;

                    // ✅ UNIFIED LOGIC: Same as regular tasks for consistency
                    if (isToday)
                    {
                        // Same day - use SAME logic as regular tasks
                        if (hoursLeft > 0)
                        {
                            if (hoursLeft < 12 && minutesLeft > 0)
                            {
                                // Show both hours and minutes for tasks due within 12 hours
                                timeRemaining = $"{hoursLeft}h {minutesLeft}m";
                            }
                            else
                            {
                                // For longer periods, just show hours
                                timeRemaining = $"{hoursLeft}h";
                            }
                        }
                        else
                        {
                            // Less than 1 hour - show minutes only
                            timeRemaining = $"{minutesLeft}m";
                        }
                    }
                    else
                    {
                        // Future days - show day format
                        if (daysLeft > 1)
                        {
                            timeRemaining = hoursLeft > 0 ? $"{daysLeft}d {hoursLeft}h" : $"{daysLeft}d";
                        }
                        else if (daysLeft == 1)
                        {
                            timeRemaining = hoursLeft > 0 ? $"1d {hoursLeft}h" : $"1d";
                        }
                        else
                        {
                            // This shouldn't happen for future dates, but just in case
                            if (hoursLeft > 0)
                            {
                                if (hoursLeft < 12 && minutesLeft > 0)
                                {
                                    timeRemaining = $"{hoursLeft}h {minutesLeft}m";
                                }
                                else
                                {
                                    timeRemaining = $"{hoursLeft}h";
                                }
                            }
                            else
                            {
                                timeRemaining = $"{minutesLeft}m";
                            }
                        }
                    }
                }

                // Set priority based on deadline
                var deadlineDateOnly = adHocTask.DeadlineDate.Value.Date;
                var currentDate = DateTime.Today;

                if (deadlineDateOnly > currentDate)
                {
                    priority = "Optional";
                }
            }

            allHabits.Add(new
            {
                habitId = (int?)null,
                name = adHocTask.Name,
                description = adHocTask.Description,
                isCompleted = adHocTask.IsCompleted,
                isRequired = priority == "Required",
                isLocked = false,
                hasDeadline = adHocTask.DeadlineDate != null,
                deadlineTime = adHocTask.DeadlineDate != null ? "23:59" : null,
                deadlineDate = adHocTask.DeadlineDate?.ToString("yyyy-MM-dd"),
                priority = priority,
                reason = "Ad-hoc task",
                frequency = "Daily",
                deferralsUsed = 0,
                maxDeferrals = 0,
                canStillBeDeferred = false,
                originalScheduledDate = (string?)null,
                currentDueDate = (string?)null,
                isAdHoc = true,
                adHocId = adHocTask.Id,
                isOverdue = isOverdue,
                timeRemaining = timeRemaining // ✅ NOW WITH MINUTES MATCHING REGULAR TASKS!
            });
        }

        // Rest of your existing method stays the same...
        var totalHabits = allHabits.Count;
        var completedHabits = allHabits.Count(h => (bool)((dynamic)h).isCompleted);
        var requiredHabits = allHabits.Where(h => (bool)((dynamic)h).isRequired).ToList();
        var completedRequired = requiredHabits.Count(h => (bool)((dynamic)h).isCompleted);

        var streakStartDate = _streakStartDate;
        var daysSinceStart = streakStartDate.HasValue ?
            Math.Max(0, (int)(date.Date - streakStartDate.Value.Date).TotalDays) : 0;

        return new
        {
            allHabits = allHabits,
            isCompleted = requiredHabits.Count > 0 && completedRequired == requiredHabits.Count,
            isPartiallyCompleted = completedHabits > 0 && completedRequired < requiredHabits.Count,
            totalHabits = totalHabits,
            completedHabits = completedHabits,
            requiredHabitsCount = requiredHabits.Count,
            completedRequiredCount = completedRequired,
            dayInStreak = daysSinceStart
        };
    }
    private async Task<List<object>> BuildWeeklyProgress(WeekSchedule weekSchedule, List<HabitCompletion> completions)
    {
        var habits = await _context.Habits.ToListAsync();
        var progress = new List<object>();

        foreach (var habit in habits)
        {
            var weeklyCompletions = completions.Count(c => c.HabitId == habit.Id && c.IsCompleted);
            var target = CalculateWeeklyTarget(habit);
            var percentage = target > 0 ? (double)weeklyCompletions / target * 100 : 0;

            progress.Add(new
            {
                habitId = habit.Id,
                name = habit.Name,
                completions = weeklyCompletions,
                target = target,
                percentage = Math.Round(percentage, 1)
            });
        }

        return progress;
    }

    private async Task<List<object>> BuildDayStatuses(WeekSchedule weekSchedule, List<HabitCompletion> completions)
    {
        var dayStatuses = new List<object>();
        foreach (var daySchedule in weekSchedule.DailySchedules)
        {
            var dayCompletions = completions.Where(c => c.Date.Date == daySchedule.Date.Date).ToList();

            // ✅ NEW: Filter out optional habits from required calculation
            var requiredHabitIds = await _context.Habits
                .Where(h => h.IsActive && !h.IsOptional)
                .Select(h => h.Id)
                .ToListAsync();

            var requiredScheduledHabits = daySchedule.ScheduledHabits
                .Where(h => requiredHabitIds.Contains(h.HabitId))
                .ToList();

            var completedRequired = requiredScheduledHabits.Count(h =>
                dayCompletions.Any(c => c.HabitId == h.HabitId && c.IsCompleted));

            // Get ad-hoc tasks (filtering logic for required vs optional ad-hoc tasks)
            var adHocTasksForDay = await _context.AdHocTasks
                .Where(t => t.Date.Date == daySchedule.Date.Date)
                .ToListAsync();

            var requiredAdHocTasks = adHocTasksForDay.Where(task =>
            {
                if (task.DeadlineDate != null)
                {
                    var deadlineDate = task.DeadlineDate.Value.Date;
                    var currentDate = daySchedule.Date.Date;
                    return deadlineDate <= currentDate; // Required if deadline is today or past
                }
                return true; // Required by default if no deadline
            }).ToList();

            var completedRequiredAdHocTasks = requiredAdHocTasks.Count(t => t.IsCompleted);

            // ✅ UPDATED: Only count required tasks for completion
            var totalRequiredTasks = requiredScheduledHabits.Count + requiredAdHocTasks.Count;
            var totalCompletedRequiredTasks = completedRequired + completedRequiredAdHocTasks;

            // ✅ UPDATED: For display - count all tasks (required + optional)
            var allScheduledHabits = daySchedule.ScheduledHabits.Count;
            var allCompletedScheduledHabits = daySchedule.ScheduledHabits.Count(h =>
                dayCompletions.Any(c => c.HabitId == h.HabitId && c.IsCompleted));
            var allCompletedAdHocTasks = adHocTasksForDay.Count(t => t.IsCompleted);

            dayStatuses.Add(new
            {
                date = daySchedule.Date.ToString("yyyy-MM-dd"),
                isCompleted = totalRequiredTasks > 0 && totalCompletedRequiredTasks == totalRequiredTasks,
                isPartiallyCompleted = totalCompletedRequiredTasks > 0 && totalCompletedRequiredTasks < totalRequiredTasks,
                canUseGrace = false,
                requiredHabitsCount = totalRequiredTasks,
                completedRequiredCount = totalCompletedRequiredTasks,
                totalHabits = allScheduledHabits + adHocTasksForDay.Count, // For UI display
                completedHabits = allCompletedScheduledHabits + allCompletedAdHocTasks // For UI display
            });
        }
        return dayStatuses;
    }
    [HttpPost("move-task-tomorrow")]
    public async Task<IActionResult> MoveTaskToTomorrow([FromBody] MoveTaskRequest request)
    {
        try
        {
            var tomorrow = DateTime.Today.AddDays(1);

            // Check if habit exists and is active
            var habit = await _context.Habits.FindAsync(request.HabitId);
            if (habit == null || !habit.IsActive)
            {
                return BadRequest("Invalid habit ID or habit is not active");
            }

            // Parse the current date from the request
            if (!DateTime.TryParse(request.CurrentDate.ToString(), out var currentDate))
            {
                return BadRequest("Invalid current date format");
            }

            // Check if already deferred from this date
            var existingDeferral = await _context.TaskDeferrals
                .FirstOrDefaultAsync(d => d.HabitId == request.HabitId &&
                                   d.OriginalDate.Date == currentDate.Date);

            if (existingDeferral != null)
            {
                return BadRequest("This task has already been moved from this date");
            }

            // Create the deferral
            await _scheduleService.SmartDeferTask(
                request.HabitId,
                currentDate,
                request.Reason ?? "Moved by user request"
            );

            return Ok(new
            {
                message = "Task successfully moved to tomorrow",
                deferredTo = tomorrow.ToString("yyyy-MM-dd")
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error moving task: {ex.Message}");
        }
    }

    [HttpPost("smart-defer-task")]
    public async Task<IActionResult> SmartDeferTask([FromBody] SmartDeferRequest request)
    {
        try
        {
            Console.WriteLine($"🔄 SmartDeferTask: Moving habit {request.HabitId} from {request.FromDate}");

            var result = await _scheduleService.SmartDeferTask(
                request.HabitId,
                DateTime.Parse(request.FromDate),
                request.Reason ?? "User requested");

            if (result.Success)
            {
                Console.WriteLine($"✅ Task deferred successfully to {result.NewDueDate:yyyy-MM-dd}");
            }
            else
            {
                Console.WriteLine($"❌ Deferral failed: {result.Message}");
            }

            return Ok(new
            {
                success = result.Success,
                message = result.Message,
                newDate = result.NewDueDate?.ToString("yyyy-MM-dd"),
                deferralsUsed = result.DeferralsUsed,
                remainingDeferrals = result.RemainingDeferrals
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ SmartDeferTask error: {ex.Message}");
            return BadRequest(new { success = false, message = "Failed to defer task", error = ex.Message });
        }
    }

    private int CalculateWeeklyTarget(Habit habit)
    {
        return habit.Frequency switch
        {
            HabitFrequency.Daily => 7,
            HabitFrequency.EveryTwoDays => 4, // Approximate
            HabitFrequency.Weekly => habit.WeeklyTarget,
            HabitFrequency.Monthly => habit.MonthlyTarget > 0 ? 1 : 0,
            HabitFrequency.Seasonal => habit.SeasonalTarget > 0 ? 1 : 0,
            _ => 0
        };
    }

    private List<string> GenerateWarnings(List<object> allHabits)
    {
        var warnings = new List<string>();
        var incompleteRequired = allHabits.Where(h =>
            (bool)h.GetType().GetProperty("isRequired").GetValue(h) &&
            !(bool)h.GetType().GetProperty("isCompleted").GetValue(h)).ToList();

        if (incompleteRequired.Count > 0)
        {
            warnings.Add($"{incompleteRequired.Count} required habits still pending");
        }

        return warnings;
    }

    private List<string> GenerateRecommendations(List<object> allHabits)
    {
        var recommendations = new List<string>();
        var completedCount = allHabits.Count(h => (bool)h.GetType().GetProperty("isCompleted").GetValue(h));

        if (completedCount > 0)
        {
            recommendations.Add($"Great progress! {completedCount} habits completed today");
        }

        return recommendations;
    }

    private async Task<bool> CanUseGraceDay(DateTime date)
    {
        var weekStart = GetWeekStart(date);
        var weekEnd = weekStart.AddDays(6);

        var graceUsedThisWeek = await _context.GraceUsages
            .CountAsync(g => g.UsedDate >= weekStart && g.UsedDate <= weekEnd);

        return graceUsedThisWeek < 1;
    }

    private DateTime GetWeekStart(DateTime date)
    {
        var dayOfWeek = (int)date.DayOfWeek;
        var mondayOffset = (dayOfWeek == 0) ? -6 : -(dayOfWeek - 1);
        return date.AddDays(mondayOffset);
    }

    private async Task<bool> IsInFirst7DaysOfStreak(DateTime date)
    {
        // Calculate streak start once and cache it
        if (!_streakStartCalculated)
        {
            _streakStartDate = await CalculateStreakStartDateOnce();
            _streakStartCalculated = true;
        }

        // If no streak start, assume we're in early days
        if (_streakStartDate == null)
        {
            return true;
        }

        // Simple calculation - no database calls
        var daysSinceStreakStart = (date.Date - _streakStartDate.Value.Date).Days + 1;
        return daysSinceStreakStart <= 7;
    }

        private async Task<DateTime?> CalculateStreakStartDateOnce()
        {
            try
            {
                // MUCH SIMPLER: Just get the earliest phone lock completion
                var firstPhoneLockCompletion = await _context.HabitCompletions
                    .Include(h => h.Habit)
                    .Where(h => h.Habit.Name.Contains("Phone Lock") && h.IsCompleted)
                    .OrderBy(h => h.Date)
                    .FirstOrDefaultAsync();

                return firstPhoneLockCompletion?.Date;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error calculating streak start: {ex.Message}");
                return null;
            }
        }

    private async Task<bool> IsDayCompletedNonRecursive(DateTime date)
    {
        try
        {
            // Get the schedule for this day
            var weekStart = GetWeekStart(date);
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);
            var daySchedule = weekSchedule.DailySchedules.FirstOrDefault(d => d.Date.Date == date.Date);

            if (daySchedule == null)
            {
                return false; // No schedule = not completed
            }

            // Get completions for this day
            var completions = await _context.HabitCompletions
                .Where(h => h.Date.Date == date.Date)
                .ToListAsync();

            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date.Date == date.Date)
                .ToListAsync();

            // Build habits list
            var allHabits = new List<object>();

            // Add scheduled habits
            foreach (var scheduledHabit in daySchedule.ScheduledHabits)
            {
                var completion = completions.FirstOrDefault(c => c.HabitId == scheduledHabit.HabitId);
                var isCompleted = completion?.IsCompleted ?? false;
                var habit = await _context.Habits.FindAsync(scheduledHabit.HabitId);
                var isRequired = habit?.IsOptional != true;

                allHabits.Add(new { isCompleted, isRequired, name = habit?.Name ?? "" });
            }

            // Add ad-hoc tasks (all are optional)
            foreach (var adHocTask in adHocTasks)
            {
                allHabits.Add(new { isCompleted = adHocTask.IsCompleted, isRequired = false, name = adHocTask.Name });
            }

            // ✅ SIMPLE LOGIC: Check Phone Lock Box for early days, all required habits for later days
            var totalCompletedDays = await GetTotalCompletedDaysCount(date);

            if (totalCompletedDays <= 7)
            {
                // First 7 days: only check if "Phone Lock Box" is completed
                var phoneLockCompletion = completions.FirstOrDefault(c =>
                    _context.Habits.Any(h => h.Id == c.HabitId && h.Name.Contains("Phone Lock")));

                return phoneLockCompletion?.IsCompleted ?? false;
            }
            else
            {
                // After 7 days: all required habits must be completed
                var requiredHabits = allHabits.Where(h => ((dynamic)h).isRequired).ToList();
                var completedRequiredCount = requiredHabits.Count(h => ((dynamic)h).isCompleted);

                return completedRequiredCount == requiredHabits.Count && requiredHabits.Count > 0;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error checking if day {date:yyyy-MM-dd} was completed (non-recursive): {ex.Message}");
            return false;
        }
    }

    private async Task<int> GetTotalCompletedDaysCount(DateTime upToDate)
    {
        try
        {
            return await _context.HabitCompletions
                .Where(c => c.IsCompleted && c.Date.Date <= upToDate.Date)
                .Select(c => c.Date.Date)
                .Distinct()
                .CountAsync();
        }
        catch
        {
            return 0;
        }
    }


}



public class CompleteHabitRequest
{
    public int HabitId { get; set; }
    public DateTime Date { get; set; }
    public bool IsCompleted { get; set; }
    public string Notes { get; set; } = string.Empty;
}
public class MoveTaskRequest
{
    public int HabitId { get; set; }
    public DateTime CurrentDate { get; set; }
    public string? Reason { get; set; }
}


public class AddAdHocTaskRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; }
    public DateTime Date { get; set; }
    public DateTime? DeadlineDate { get; set; } // FIX: Add this property to match usage
    public bool HasDeadline { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
}

public class CompleteAdHocTaskRequest
{
    public int TaskId { get; set; }
    public bool IsCompleted { get; set; }
    public string Notes { get; set; }
}

public class EditAdHocTaskRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class DeferTaskRequest
{
    public int HabitId { get; set; }
    public DateTime FromDate { get; set; }
    public string? Reason { get; set; }
}


public class SmartDeferRequest
{
    public int HabitId { get; set; }
    public string FromDate { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public class CalculateStatsRequest
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
}


// ==============================================================================
// HELPER METHOD - GetWeekStart (if it doesn't exist)
// ==============================================================================