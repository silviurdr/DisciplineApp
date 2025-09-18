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

    public DisciplineController(DisciplineDbContext context, WeeklyScheduleService scheduleService, FlexibleTaskService flexibleTaskService)
    {
        _context = context;
        _scheduleService = scheduleService;
        _flexibleTaskService = flexibleTaskService;
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

            // 🔥 KEY FIX: Generate the smart schedule for this week (includes deferral logic)
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);

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

                // 🔥 FIX: Use the daySchedule from WeeklyScheduleService (which respects deferrals)
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
    // Add this new helper method to build individual day responses
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

            allHabits.Add(new
            {
                habitId = scheduledHabit.HabitId,
                name = scheduledHabit.HabitName,
                description = scheduledHabit.Description,
                isCompleted = isCompleted,
                isRequired = scheduledHabit.IsRequired,
                isLocked = scheduledHabit.IsLocked,
                hasDeadline = scheduledHabit.HasDeadline,
                deadlineTime = scheduledHabit.HasDeadline ? scheduledHabit.DeadlineTime.ToString("HH:mm") : null,
                priority = scheduledHabit.Priority.ToString(),
                reason = scheduledHabit.Reason,

                // Deferral info
                frequency = scheduledHabit.Frequency,
                deferralsUsed = scheduledHabit.DeferralsUsed,
                maxDeferrals = scheduledHabit.MaxDeferrals,
                canStillBeDeferred = scheduledHabit.CanStillBeDeferred,
                originalScheduledDate = scheduledHabit.OriginalScheduledDate?.ToString("yyyy-MM-dd"),
                currentDueDate = scheduledHabit.CurrentDueDate?.ToString("yyyy-MM-dd"),

                // Status fields
                isAdHoc = false,
                adHocId = (int?)null
            });
        }

        // Add ad-hoc tasks
        foreach (var adHocTask in adHocTasks)
        {
            // Determine priority based on deadline
            string priority = "Required"; // Default priority

            if (adHocTask.DeadlineDate != null)
            {
                var deadlineDate = adHocTask.DeadlineDate.Value.Date;
                var currentDate = DateTime.Today;

                // If deadline is later than current day, make it optional
                if (deadlineDate > currentDate)
                {
                    priority = "Optional";
                }
            }

            allHabits.Add(new
            {
                habitId = 0, // Ad-hoc tasks don't have habit IDs
                name = adHocTask.Name,
                description = adHocTask.Description,
                isCompleted = adHocTask.IsCompleted,
                isRequired = priority == "Required", // Update this based on calculated priority
                isLocked = false,
                hasDeadline = adHocTask.DeadlineDate != null,
                deadlineTime = "23:59",
                priority = priority, // Use calculated priority instead of hardcoded "Required"
                reason = "Ad-hoc task",
                deadlineDate = adHocTask.DeadlineDate?.ToString("yyyy-MM-dd"),

                // Deferral info (not applicable for ad-hoc)
                frequency = "AdHoc",
                deferralsUsed = 0,
                maxDeferrals = 0,
                canStillBeDeferred = false,
                originalScheduledDate = (string?)null,

                // Identification
                isAdHoc = true,
                adHocId = adHocTask.Id,

                // Timing and urgency
                isOverdue = false, // You can implement overdue logic later if needed
                timeRemaining = (string?)null
            });
        }

        // Calculate day statistics
        var totalHabits = allHabits.Count;
        var completedHabits = allHabits.Count(h => (bool)((dynamic)h).isCompleted);
        var requiredHabits = allHabits.Where(h => (bool)((dynamic)h).isRequired).ToList();
        var completedRequired = requiredHabits.Count(h => (bool)((dynamic)h).isCompleted);

        return new
        {
            date = date.ToString("yyyy-MM-dd"),
            isCompleted = completedRequired == requiredHabits.Count && requiredHabits.Count > 0,
            isPartiallyCompleted = completedHabits > 0 && completedHabits < totalHabits,
            completedHabits = completedHabits,
            totalHabits = totalHabits,
            requiredHabitsCount = requiredHabits.Count,
            completedRequiredCount = completedRequired,
            allHabits = allHabits,
            warnings = new List<string>(), // You can add warning logic here
            recommendations = new List<string>() // You can add recommendation logic here
        };
    }


    // Add this method to your DisciplineController.cs

    [HttpGet("month/{year}/{month}")]
    public async Task<IActionResult> GetMonthData(int year, int month)
    {
        try
        {
            // Calculate month boundaries
            var monthStart = new DateTime(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            // Get all completion data for the month
            var completions = await _context.HabitCompletions
                .Where(h => h.Date >= monthStart && h.Date <= monthEnd)
                .ToListAsync();

            // Get all ad-hoc tasks for the month
            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date >= monthStart && t.Date <= monthEnd)
                .ToListAsync();

            var monthDays = new List<object>();

            // Generate data for each day of the month
            for (var date = monthStart; date <= monthEnd; date = date.AddDays(1))
            {
                // Generate weekly schedule for this day to get the planned habits
                var weekStart = GetWeekStart(date);
                var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);

                // Find the day's schedule
                var daySchedule = weekSchedule.DailySchedules.FirstOrDefault(d => d.Date.Date == date.Date);

                // Get completions and ad-hoc tasks for this specific day
                var dayCompletions = completions.Where(c => c.Date.Date == date.Date).ToList();
                var dayAdHocTasks = adHocTasks.Where(t => t.Date.Date == date.Date).ToList();

                // Build day data
                var dayData = await BuildDayResponse(date, daySchedule ?? new DailySchedule
                {
                    Date = date,
                    ScheduledHabits = new List<ScheduledHabit>()
                }, dayCompletions, dayAdHocTasks);

                monthDays.Add(dayData);
            }

            // Calculate monthly statistics
            var monthlyStats = CalculateMonthlyStats(monthDays, monthStart, monthEnd);

            var response = new
            {
                year = year,
                month = month,
                monthStart = monthStart.ToString("yyyy-MM-dd"),
                monthEnd = monthEnd.ToString("yyyy-MM-dd"),
                days = monthDays,
                monthlyStats = monthlyStats
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = $"Failed to get month data: {ex.Message}" });
        }
    }

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
                // Only count days up to today
                if (dayDate > today) continue;

                if (day.isCompleted == true)
                {
                    streak++;
                }
                else
                {
                    break; // Streak is broken
                }
            }
        }

        return streak;
    }

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
                existingCompletion.Notes = request.Notes;
            }
            else
            {
                _context.HabitCompletions.Add(new HabitCompletion
                {
                    HabitId = request.HabitId,
                    Date = request.Date.Date,
                    IsCompleted = request.IsCompleted,
                    CompletedAt = request.IsCompleted ? DateTime.UtcNow : null,
                    Notes = request.Notes
                });
            }

            await _context.SaveChangesAsync();

            // Return updated day status
            var weekStart = GetWeekStart(request.Date);
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);
            var completions = await _context.HabitCompletions
                .Where(h => h.Date.Date == request.Date.Date)
                .ToListAsync();

            var adHocTasks = await _context.AdHocTasks
            .Where(t => t.Date.Date == request.Date.Date)
            .ToListAsync();

            var dayResponse = await BuildCurrentDayResponse(request.Date, weekSchedule, completions, adHocTasks);
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
                DeadlineDate = request.DeadlineDate, // NEW
                CreatedAt = DateTime.UtcNow,
                Notes = "Test"
            };

            _context.AdHocTasks.Add(task);
            // Replace this line in AddAdHocTask method:
            // Date = request.Date ?? DateTime.Today,

            // With this fix:
            
            await _context.SaveChangesAsync();

            // Return updated day status including the new ad-hoc task
            var weekStart = GetWeekStart(request.Date);
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);
            var completions = await _context.HabitCompletions
                .Where(h => h.Date.Date == request.Date.Date)
                .ToListAsync();
            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date.Date == request.Date.Date)
                .ToListAsync();

            var dayResponse = await BuildCurrentDayResponse(request.Date, weekSchedule, completions, adHocTasks);
            return Ok(dayResponse);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

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

    private async Task<object> BuildCurrentDayResponse(DateTime date, WeekSchedule weekSchedule, List<HabitCompletion> completions, List<AdHocTask> adHocTasks)
    {
        var daySchedule = weekSchedule.DailySchedules.FirstOrDefault(d => d.Date.Date == date.Date);
        if (daySchedule == null) return new { allHabits = new List<object>() };

        var allHabits = new List<object>();

        // Add scheduled habits
        foreach (var scheduledHabit in daySchedule.ScheduledHabits)
        {
            var completion = completions.FirstOrDefault(c => c.HabitId == scheduledHabit.HabitId && c.Date.Date == date.Date);
            var isCompleted = completion?.IsCompleted ?? false;

            allHabits.Add(new
            {
                habitId = scheduledHabit.HabitId,
                name = scheduledHabit.HabitName,
                description = scheduledHabit.Description,
                isCompleted = isCompleted,
                isRequired = scheduledHabit.Priority == SchedulePriority.Required,
                isLocked = scheduledHabit.IsLocked,
                hasDeadline = scheduledHabit.HasDeadline,
                deadlineTime = scheduledHabit.DeadlineTime.ToString("HH:mm"),
                priority = scheduledHabit.Priority.ToString(),
                reason = scheduledHabit.Reason,
                deadlineDate = (string?)null,
                frequency = scheduledHabit.Frequency,
                deferralsUsed = scheduledHabit.DeferralsUsed,
                maxDeferrals = scheduledHabit.MaxDeferrals,
                canStillBeDeferred = scheduledHabit.CanStillBeDeferred,
                originalScheduledDate = scheduledHabit.OriginalScheduledDate?.ToString("yyyy-MM-dd"),
                isAdHoc = false,
                adHocId = (int?)null,
                isOverdue = false,
                timeRemaining = (string?)null
            });
        }

        // Add ad-hoc tasks with priority logic
        foreach (var adHocTask in adHocTasks)
        {
            // ✅ Apply the same priority logic here
            string priority = "Required";
            if (adHocTask.DeadlineDate != null)
            {
                var deadlineDate = adHocTask.DeadlineDate.Value.Date;
                var currentDate = date.Date;

                if (deadlineDate > currentDate)
                {
                    priority = "Optional";
                }
            }

            allHabits.Add(new
            {
                habitId = 0,
                name = adHocTask.Name,
                description = adHocTask.Description,
                isCompleted = adHocTask.IsCompleted,
                isRequired = priority == "Required",
                isLocked = false,
                hasDeadline = adHocTask.DeadlineDate != null,
                deadlineTime = "23:59",
                priority = priority,
                reason = "Ad-hoc task",
                deadlineDate = adHocTask.DeadlineDate?.ToString("yyyy-MM-dd"),
                frequency = "AdHoc",
                deferralsUsed = 0,
                maxDeferrals = 0,
                canStillBeDeferred = false,
                originalScheduledDate = (string?)null,
                isAdHoc = true,
                adHocId = adHocTask.Id,
                isOverdue = false,
                timeRemaining = (string?)null
            });
        }

        return new { allHabits = allHabits };
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
            var requiredHabits = daySchedule.ScheduledHabits.Where(h => h.Priority == SchedulePriority.Required).ToList();
            var completedRequired = requiredHabits.Count(h => dayCompletions.Any(c => c.HabitId == h.HabitId && c.IsCompleted));

            // Get ad-hoc tasks for this day
            var adHocTasksForDay = await _context.AdHocTasks
                .Where(t => t.Date.Date == daySchedule.Date.Date)
                .ToListAsync();

            // ✅ NEW LOGIC: Only count REQUIRED ad-hoc tasks (ignore optional ones)
            var requiredAdHocTasks = adHocTasksForDay.Where(task =>
            {
                // Determine if this ad-hoc task is required or optional
                if (task.DeadlineDate != null)
                {
                    var deadlineDate = task.DeadlineDate.Value.Date;
                    var currentDate = daySchedule.Date.Date; // Use the day we're calculating for

                    // If deadline is later than the day we're calculating, it's optional
                    return deadlineDate <= currentDate;
                }

                // If no deadline date, it's required by default
                return true;
            }).ToList();

            var completedRequiredAdHocTasks = requiredAdHocTasks.Count(t => t.IsCompleted);

            // ✅ UPDATED: Only count required tasks in completion calculation
            var totalRequiredTasks = requiredHabits.Count + requiredAdHocTasks.Count;
            var totalCompletedTasks = completedRequired + completedRequiredAdHocTasks;

            // ✅ FOR DISPLAY: Count ALL tasks (required + optional) for UI counters
            var allAdHocTasks = adHocTasksForDay.Count;
            var allCompletedAdHocTasks = adHocTasksForDay.Count(t => t.IsCompleted);
            var allTasks = daySchedule.ScheduledHabits.Count + allAdHocTasks;
            var allCompletedTasks = daySchedule.ScheduledHabits.Count(h => dayCompletions.Any(c => c.HabitId == h.HabitId && c.IsCompleted)) + allCompletedAdHocTasks;

            dayStatuses.Add(new
            {
                date = daySchedule.Date.ToString("yyyy-MM-dd"),
                isCompleted = totalRequiredTasks > 0 && totalCompletedTasks == totalRequiredTasks, // ✅ Based only on required tasks
                isPartiallyCompleted = totalCompletedTasks > 0 && totalCompletedTasks < totalRequiredTasks,
                canUseGrace = false,
                requiredHabitsCount = totalRequiredTasks, // ✅ Only required tasks
                completedRequiredCount = totalCompletedTasks, // ✅ Only required completed tasks

                // ✅ ADD: Separate counters for display purposes (includes optional tasks)
                totalHabits = allTasks, // For UI display - shows all tasks
                completedHabits = allCompletedTasks // For UI display - shows all completed tasks
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

// ==============================================================================
// HELPER METHOD - GetWeekStart (if it doesn't exist)
// ==============================================================================