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

    public DisciplineController(DisciplineDbContext context, WeeklyScheduleService scheduleService)
    {
        _context = context;
        _scheduleService = scheduleService;
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

            // Get actual completion data
            var completions = await _context.HabitCompletions
                .Where(h => h.Date >= weekStart && h.Date <= weekStart.AddDays(6))
                .ToListAsync();

            // ✅ ADD: Get ad-hoc tasks for current day
            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date.Date == currentDate.Date)
                .ToListAsync();

            // Build response
            var response = new
            {
                weekStartDate = weekStart.ToString("yyyy-MM-dd"),
                weekEndDate = weekStart.AddDays(6).ToString("yyyy-MM-dd"),
                currentDay = await BuildCurrentDayResponse(currentDate, weekSchedule, completions, adHocTasks), // ✅ ADD adHocTasks parameter
                weeklyHabitProgress = await BuildWeeklyProgress(weekSchedule, completions),
                dayStatuses = await BuildDayStatuses(weekSchedule, completions)
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
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
            var habit = await _context.Habits.FindAsync(request.HabitId);
            if (habit == null)
            {
                return NotFound(new { error = "Habit not found" });
            }

            var currentDate = DateTime.Parse(request.CurrentDate);
            var tomorrow = currentDate.AddDays(1);

            // Remove from current day (mark as deferred, not failed)
            await _scheduleService.DeferTask(request.HabitId, currentDate, tomorrow, request.Reason);

            // Get updated schedules
            var weekStart = GetWeekStart(currentDate);
            var weekSchedule = await _scheduleService.GenerateWeekSchedule(weekStart);
            var completions = await _context.HabitCompletions
                .Where(h => h.Date.Date == currentDate.Date || h.Date.Date == tomorrow.Date)
                .ToListAsync();

            var adHocTasks = await _context.AdHocTasks
                .Where(t => t.Date.Date == currentDate.Date)
                .ToListAsync();

            // Return both today and tomorrow's updated status
            var todayResponse = await BuildCurrentDayResponse(currentDate, weekSchedule, completions, adHocTasks);
            var tomorrowResponse = await BuildCurrentDayResponse(tomorrow, weekSchedule, completions, adHocTasks);

            return Ok(new
            {
                today = todayResponse,
                tomorrow = tomorrowResponse,
                message = $"{habit.Name} moved to tomorrow"
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
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
}public class MoveTaskRequest
{
    public int HabitId { get; set; }
    public string CurrentDate { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
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
