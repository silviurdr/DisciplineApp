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

            // Generate the smart schedule for this week
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);

            // Get actual completion data for the entire week
            var completions = await _context.HabitCompletions
                .Where(h => h.Date >= weekStart && h.Date <= weekStart.AddDays(6))
                .ToListAsync();

            // Get ad-hoc tasks for the entire week
            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date >= weekStart && t.Date <= weekStart.AddDays(6))
                .ToListAsync();

            // Build all 7 days data
            var allDays = new List<object>();

            foreach (var daySchedule in weekSchedule.DailySchedules)
            {
                var dayCompletions = completions.Where(c => c.Date.Date == daySchedule.Date.Date).ToList();
                var dayAdHocTasks = adHocTasks.Where(t => t.Date.Date == daySchedule.Date.Date).ToList();

                var dayData = await BuildDayResponse(daySchedule.Date, daySchedule, dayCompletions, dayAdHocTasks);
                allDays.Add(dayData);
            }

            // Find current day data
            var currentDayData = allDays.FirstOrDefault(d =>
                ((dynamic)d).date == currentDate.ToString("yyyy-MM-dd"));

            // Build response with complete week data
            var response = new
            {
                weekStartDate = weekStart.ToString("yyyy-MM-dd"),
                weekEndDate = weekStart.AddDays(6).ToString("yyyy-MM-dd"),
                currentDay = currentDayData,
                allDays = allDays, // ← This is the key addition!
                weeklyStats = new
                {
                    totalDays = 7,
                    completedDays = allDays.Count(d => ((dynamic)d).isCompleted == true),
                    partialDays = allDays.Count(d => ((dynamic)d).isPartiallyCompleted == true),
                    incompleteDays = allDays.Count(d => ((dynamic)d).isCompleted == false && ((dynamic)d).isPartiallyCompleted == false)
                }
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = $"Failed to get week data: {ex.Message}" });
        }
    }

    // Add this new helper method to build individual day responses
    private async Task<object> BuildDayResponse(DateTime date, DailySchedule daySchedule, List<HabitCompletion> completions, List<AdHocTask> adHocTasks)
    {
        var allHabits = new List<object>();

        // Add regular scheduled habits
        foreach (var scheduledHabit in daySchedule.ScheduledHabits)
        {
            var completion = completions.FirstOrDefault(c => c.HabitId == scheduledHabit.HabitId);

            // Determine if the habit is locked based on the deadline
            var isLocked = false;
            string timeRemaining = null;

            if (scheduledHabit.HasDeadline && date.Date == DateTime.Today)
            {
                var currentTime = TimeOnly.FromDateTime(DateTime.Now);
                var deadlineTime = scheduledHabit?.DeadlineTime ?? TimeOnly.MaxValue;

                isLocked = currentTime > deadlineTime;

                // Calculate time remaining until deadline
                if (!isLocked && deadlineTime != TimeOnly.MaxValue)
                {
                    var now = DateTime.Now;
                    var deadlineDateTime = date.Date.Add(deadlineTime.ToTimeSpan());
                    var timeDiff = deadlineDateTime - now;

                    if (timeDiff.TotalMinutes > 0)
                    {
                        if (timeDiff.TotalHours >= 1)
                        {
                            timeRemaining = $"{(int)timeDiff.TotalHours}h {timeDiff.Minutes}m";
                        }
                        else
                        {
                            timeRemaining = $"{(int)timeDiff.TotalMinutes}m";
                        }
                    }
                }
            }

            allHabits.Add(new
            {
                habitId = scheduledHabit.HabitId,
                name = scheduledHabit.HabitName,
                description = scheduledHabit.Description,
                isCompleted = completion?.IsCompleted ?? false,
                isRequired = scheduledHabit.Priority == SchedulePriority.Required,
                isLocked = isLocked,
                reason = scheduledHabit.Reason,
                priority = scheduledHabit.Priority.ToString(),
                completedAt = completion?.CompletedAt?.ToString("yyyy-MM-dd HH:mm:ss"),
                hasDeadline = scheduledHabit.HasDeadline,
                deadlineTime = scheduledHabit.DeadlineTime.ToString("HH:mm"),
                timeRemaining = timeRemaining, // 🔥 ADD THIS LINE
                isOverdue = scheduledHabit.HasDeadline && date.Date == DateTime.Today &&
                           TimeOnly.FromDateTime(DateTime.Now) > (scheduledHabit?.DeadlineTime ?? TimeOnly.MaxValue) &&
                           !(completion?.IsCompleted ?? false),
                frequency = scheduledHabit.Frequency
            });
        }

        // Add ad-hoc tasks (unchanged)
        foreach (var adHocTask in adHocTasks)
        {
            allHabits.Add(new
            {
                habitId = -1,
                adHocId = adHocTask.Id,
                name = adHocTask.Name,
                description = adHocTask.Description,
                isCompleted = adHocTask.IsCompleted,
                isRequired = false,
                isLocked = false,
                isAdHoc = true,
                completedAt = adHocTask.CompletedAt?.ToString("yyyy-MM-dd HH:mm:ss"),
                hasDeadline = false,
                deadlineTime = "",
                timeRemaining = "", // 🔥 ADD THIS LINE
                isOverdue = false
            });
        }

        // Calculate completion statistics
        var totalHabits = allHabits.Count;
        var completedHabits = allHabits.Count(h => ((dynamic)h).isCompleted == true);
        var requiredHabits = allHabits.Where(h => ((dynamic)h).isRequired == true).ToList();
        var completedRequired = requiredHabits.Count(h => ((dynamic)h).isCompleted == true);

        return new
        {
            date = date.ToString("yyyy-MM-dd"),
            isCompleted = totalHabits > 0 && completedHabits == totalHabits,
            isPartiallyCompleted = completedHabits > 0 && completedHabits < totalHabits,
            totalHabits = totalHabits,
            completedHabits = completedHabits,
            requiredHabitsCount = requiredHabits.Count,
            completedRequiredCount = completedRequired,
            allHabits = allHabits,
            warnings = new List<string>(),
            recommendations = new List<string>()
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
                Description = request.Description ?? "",
                Date = request.Date.Date,
                IsCompleted = false,
                Notes = ""
            };

            _context.AdHocTasks.Add(task);
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
            task.Notes = request.Notes ?? task.Notes;

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
        if (daySchedule == null)
        {
            return new
            {
                date = date.ToString("yyyy-MM-dd"),
                allHabits = new List<object>(),
                warnings = new List<string>(),
                recommendations = new List<string>()
            };
        }

        var allHabits = new List<object>();

        // Add regular scheduled habits
        foreach (var scheduledHabit in daySchedule.ScheduledHabits)
        {
            var completion = completions.FirstOrDefault(c => c.HabitId == scheduledHabit.HabitId && c.Date.Date == date.Date);

            // Determine if the habit is locked based on the deadline
            var isLocked = false;
            if (scheduledHabit.HasDeadline && date.Date == DateTime.Today)
            {
                var currentTime = TimeOnly.FromDateTime(DateTime.Now);
                var deadlineTime = scheduledHabit?.DeadlineTime ?? TimeOnly.MaxValue;
                isLocked = currentTime > deadlineTime;
            }

            allHabits.Add(new
            {
                habitId = scheduledHabit.HabitId,
                name = scheduledHabit.HabitName,
                description = scheduledHabit.Description,
                isCompleted = completion?.IsCompleted ?? false,
                isRequired = scheduledHabit.Priority == SchedulePriority.Required,
                isLocked = isLocked,
                reason = scheduledHabit.Reason,
                priority = scheduledHabit.Priority.ToString(),
                completedAt = completion?.CompletedAt?.ToString("yyyy-MM-dd HH:mm:ss"),
                hasDeadline = scheduledHabit.HasDeadline,
                deadlineTime = scheduledHabit.DeadlineTime.ToString("HH:mm"),
                //here is the logic for overdue and problem with time zone differences
                isOverdue = scheduledHabit.HasDeadline && date.Date == DateTime.Today &&
                           TimeOnly.FromDateTime(DateTime.Now) > (scheduledHabit?.DeadlineTime ?? TimeOnly.MaxValue) &&
                           !(completion?.IsCompleted ?? false),
                isAdHoc = false // Regular habits are not ad-hoc
            });
        }

        // Add ad-hoc tasks
        foreach (var adHocTask in adHocTasks)
        {
            allHabits.Add(new
            {
                habitId = 0, // Ad-hoc tasks don't have habit IDs
                name = adHocTask.Name,
                description = adHocTask.Description,
                isCompleted = adHocTask.IsCompleted,
                isRequired = true, // Ad-hoc tasks are not required for day completion
                isLocked = false, // Ad-hoc tasks are never locked
                reason = "Ad-hoc task",
                priority = "Required",
                completedAt = adHocTask.CompletedAt?.ToString("yyyy-MM-dd HH:mm:ss"),
                hasDeadline = false,
                deadlineTime = (string)null,
                isOverdue = false,
                isAdHoc = true, // Mark as ad-hoc
                adHocId = adHocTask.Id // Include the ad-hoc task ID
            });
        }

        // Generate warnings and recommendations
        var warnings = GenerateWarnings(allHabits);
        var recommendations = GenerateRecommendations(allHabits);

        return new
        {
            date = date.ToString("yyyy-MM-dd"),
            allHabits = allHabits,
            warnings = warnings,
            recommendations = recommendations,
            canUseGrace = await CanUseGraceDay(date),
            isCompleted = allHabits.Where(h => (bool)h.GetType().GetProperty("isRequired").GetValue(h))
                                   .All(h => (bool)h.GetType().GetProperty("isCompleted").GetValue(h)),
            isPartiallyCompleted = allHabits.Any(h => (bool)h.GetType().GetProperty("isCompleted").GetValue(h))
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
            var requiredHabits = daySchedule.ScheduledHabits.Where(h => h.Priority == SchedulePriority.Required).ToList();
            var completedRequired = requiredHabits.Count(h => dayCompletions.Any(c => c.HabitId == h.HabitId && c.IsCompleted));

            // ✅ ADD: Get ad-hoc tasks for this day
            var adHocTasksForDay = await _context.AdHocTasks
                .Where(t => t.Date.Date == daySchedule.Date.Date)
                .ToListAsync();
            var completedAdHocTasks = adHocTasksForDay.Count(t => t.IsCompleted);

            // ✅ UPDATE: Calculate total tasks including ad-hoc
            var totalRequiredTasks = requiredHabits.Count + adHocTasksForDay.Count; // Include ad-hoc in total
            var totalCompletedTasks = completedRequired + completedAdHocTasks;

            dayStatuses.Add(new
            {
                date = daySchedule.Date.ToString("yyyy-MM-dd"),
                isCompleted = totalRequiredTasks > 0 && totalCompletedTasks == totalRequiredTasks,
                isPartiallyCompleted = totalCompletedTasks > 0 && totalCompletedTasks < totalRequiredTasks,
                canUseGrace = false, // Implement grace logic
                requiredHabitsCount = totalRequiredTasks, // ✅ Now includes ad-hoc tasks
                completedRequiredCount = totalCompletedTasks // ✅ Now includes ad-hoc tasks
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
            await _scheduleService.DeferTask(
                request.HabitId,
                currentDate,
                tomorrow,
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