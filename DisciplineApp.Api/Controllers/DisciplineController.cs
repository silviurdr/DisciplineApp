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

            // Build response
            var response = new
            {
                weekStartDate = weekStart.ToString("yyyy-MM-dd"),
                weekEndDate = weekStart.AddDays(6).ToString("yyyy-MM-dd"),
                currentDay = await BuildCurrentDayResponse(currentDate, weekSchedule, completions),
                weeklyHabitProgress = await BuildWeeklyProgress(weekSchedule, completions),
                dayStatuses = BuildDayStatuses(weekSchedule, completions)
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

            var dayResponse = await BuildCurrentDayResponse(request.Date, weekSchedule, completions);
            return Ok(dayResponse);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private async Task<object> BuildCurrentDayResponse(DateTime date, WeekSchedule weekSchedule, List<HabitCompletion> completions)
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
                completedAt = completion?.CompletedAt?.ToString("yyyy-MM-dd HH:mm:ss")
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

    private List<object> BuildDayStatuses(WeekSchedule weekSchedule, List<HabitCompletion> completions)
    {
        var dayStatuses = new List<object>();

        foreach (var daySchedule in weekSchedule.DailySchedules)
        {
            var dayCompletions = completions.Where(c => c.Date.Date == daySchedule.Date.Date).ToList();
            var requiredHabits = daySchedule.ScheduledHabits.Where(h => h.Priority == SchedulePriority.Required).ToList();
            var completedRequired = requiredHabits.Count(h => dayCompletions.Any(c => c.HabitId == h.HabitId && c.IsCompleted));

            dayStatuses.Add(new
            {
                date = daySchedule.Date.ToString("yyyy-MM-dd"),
                isCompleted = requiredHabits.Count > 0 && completedRequired == requiredHabits.Count,
                isPartiallyCompleted = completedRequired > 0 && completedRequired < requiredHabits.Count,
                canUseGrace = false, // Implement grace logic
                requiredHabitsCount = requiredHabits.Count,
                completedRequiredCount = completedRequired
            });
        }

        return dayStatuses;
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