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
    private readonly HabitCalculationService _habitCalculationService;

    public DisciplineController(DisciplineDbContext context, HabitCalculationService habitCalculationService)
    {
        _context = context;
        _habitCalculationService = habitCalculationService;
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

            var dayStatuses = new List<object>();
            var weeklyHabitProgress = new List<object>();

            // Get status for each day of the week
            for (int i = 0; i < 7; i++)
            {
                var date = weekStart.AddDays(i);
                var dayStatus = await _habitCalculationService.GetDayStatus(date);

                dayStatuses.Add(new
                {
                    date = date.ToString("yyyy-MM-dd"),
                    isCompleted = dayStatus.IsCompleted,
                    isPartiallyCompleted = dayStatus.IsPartiallyCompleted,
                    canUseGrace = dayStatus.CanUseGrace,
                    requiredHabitsCount = dayStatus.RequiredHabits.Count,
                    completedRequiredCount = dayStatus.RequiredHabits.Count(h => h.IsCompleted),
                    requiredHabits = dayStatus.RequiredHabits.Select(h => new
                    {
                        habitId = h.HabitId,
                        name = h.HabitName,
                        isCompleted = h.IsCompleted,
                        urgencyLevel = h.UrgencyLevel.ToString()
                    }),
                    optionalHabit = dayStatus.OptionalHabits.Select(oh => new
                    {
                        habitId = oh.HabitId,
                        name = oh.HabitName,
                        isCompleted = oh.IsCompleted,
                        UrgencyLevel = oh.UrgencyLevel.ToString()
                    }),
                    warnings = dayStatus.Warnings
                });
            }

            // Get weekly progress for all habits
            var habits = await _context.Habits.ToListAsync();
            foreach (var habit in habits)
            {
                var progress = await GetWeeklyHabitProgress(habit, weekStart);
                weeklyHabitProgress.Add(progress);
            }

            // Get current day's detailed status
            var currentDayStatus = await _habitCalculationService.GetDayStatus(currentDate);

            var response = new
            {
                weekStartDate = weekStart.ToString("yyyy-MM-dd"),
                weekEndDate = weekStart.AddDays(6).ToString("yyyy-MM-dd"),
                dayStatuses = dayStatuses,
                weeklyHabitProgress = weeklyHabitProgress,
                currentDay = new
                {
                    date = currentDate.ToString("yyyy-MM-dd"),
                    canUseGrace = currentDayStatus.CanUseGrace,
                    isCompleted = currentDayStatus.IsCompleted,
                    isPartiallyCompleted = currentDayStatus.IsPartiallyCompleted,
                    requiredHabits = currentDayStatus.RequiredHabits.Select(h => new
                    {
                        habitId = h.HabitId,
                        name = h.HabitName,
                        description = h.Description,
                        isCompleted = h.IsCompleted,
                        urgencyLevel = h.UrgencyLevel.ToString(),
                        reason = h.Reason,
                        completedAt = h.CompletedAt?.ToString("yyyy-MM-dd HH:mm:ss")
                    }),
                    optionalHabits = currentDayStatus.OptionalHabits.Select(h => new
                    {
                        habitId = h.HabitId,
                        name = h.HabitName,
                        description = h.Description,
                        isCompleted = h.IsCompleted,
                        urgencyLevel = h.UrgencyLevel.ToString(),
                        reason = h.Reason,
                        completedAt = h.CompletedAt?.ToString("yyyy-MM-dd HH:mm:ss")
                    }),
                    warnings = currentDayStatus.Warnings,
                    recommendations = currentDayStatus.Recommendations
                }
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
            var dayStatus = await _habitCalculationService.GetDayStatus(request.Date);
            return Ok(dayStatus);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("use-grace")]
    public async Task<IActionResult> UseGraceDay([FromBody] UseGraceRequest request)
    {
        try
        {
            var canUseGrace = await CanUseGraceDay(request.Date);
            if (!canUseGrace)
            {
                return BadRequest(new { error = "Grace day not available for this week" });
            }

            _context.GraceUsages.Add(new GraceUsage
            {
                UsedDate = request.Date.Date,
                Reason = request.Reason
            });

            await _context.SaveChangesAsync();

            var dayStatus = await _habitCalculationService.GetDayStatus(request.Date);
            return Ok(dayStatus);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private async Task<object> GetWeeklyHabitProgress(Habit habit, DateTime weekStart)
    {
        var weekEnd = weekStart.AddDays(6);
        var completions = await _context.HabitCompletions
            .Where(h => h.HabitId == habit.Id && h.IsCompleted &&
                       h.Date >= weekStart && h.Date <= weekEnd)
            .CountAsync();

        var target = habit.Frequency switch
        {
            HabitFrequency.Daily => 7,
            HabitFrequency.Weekly => habit.WeeklyTarget,
            HabitFrequency.EveryTwoDays => 4, // Approximate for a week
            _ => 1
        };

        return new
        {
            habitId = habit.Id,
            name = habit.Name,
            completions = completions,
            target = target,
            percentage = target > 0 ? (double)completions / target * 100 : 0
        };
    }

    private async Task<bool> CanUseGraceDay(DateTime date)
    {
        var weekStart = GetWeekStart(date);
        var weekEnd = weekStart.AddDays(6);

        var graceUsedThisWeek = await _context.GraceUsages
            .CountAsync(g => g.UsedDate >= weekStart && g.UsedDate <= weekEnd);

        return graceUsedThisWeek < 1; // Max 1 grace per week
    }

    private DateTime GetWeekStart(DateTime date)
    {
        // Get Monday of the current week
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

public class UseGraceRequest
{
    public DateTime Date { get; set; }
    public string Reason { get; set; } = string.Empty;
}