// Add this new controller to your API: Controllers/HabitsController.cs

using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HabitsController : ControllerBase
{
    private readonly DisciplineDbContext _context;

    public HabitsController(DisciplineDbContext context)
    {
        _context = context;
    }

    // GET: api/habits
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetHabits()
    {
        return await _context.Habits
            .OrderBy(h => h.Name)
            .Select(h => new {
                h.Id,
                h.Name,
                h.Description,
                h.Frequency,
                h.IsActive,
                h.IsOptional,
                h.WeeklyTarget,
                h.MonthlyTarget,
                h.SeasonalTarget,
                h.EstimatedDurationMinutes// ✅ ENSURE THIS IS INCLUDED
            })
            .ToListAsync();
    }

    // GET: api/habits/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Habit>> GetHabit(int id)
    {
        var habit = await _context.Habits.FindAsync(id);

        if (habit == null)
        {
            return NotFound();
        }

        return habit;
    }

    // POST: api/habits
    [HttpPost]
    public async Task<ActionResult<Habit>> CreateHabit(CreateHabitRequest request)
    {
        // Validate frequency-specific targets
        if (!IsValidFrequencyTarget(request.Frequency, request.WeeklyTarget, request.MonthlyTarget, request.SeasonalTarget))
        {
            return BadRequest("Invalid target values for the specified frequency.");
        }

        var habit = new Habit
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            Frequency = Enum.Parse<HabitFrequency>(request.Frequency),
            WeeklyTarget = request.WeeklyTarget ?? 0,
            MonthlyTarget = request.MonthlyTarget ?? 0,
            SeasonalTarget = request.SeasonalTarget ?? 0,
            IsActive = true,
            IsLocked = false,
            HasDeadline = request.HasDeadline ?? false,
            DeadlineTime = request.HasDeadline == true && !string.IsNullOrEmpty(request.DeadlineTime)
                ? TimeOnly.Parse(request.DeadlineTime)
                : default,
            CreatedAt = DateTime.UtcNow,
            IsOptional = request.IsOptional,
            EstimatedDurationMinutes = request.EstimatedDurationMinutes ?? 30
        };

        _context.Habits.Add(habit);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetHabit), new { id = habit.Id }, habit);
    }

    // PUT: api/habits/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateHabit(int id, UpdateHabitRequest request)
    {
        var habit = await _context.Habits.FindAsync(id);
        if (habit == null)
        {
            return NotFound();
        }

        // Validate frequency-specific targets
        if (!IsValidFrequencyTarget(request.Frequency, request.WeeklyTarget, request.MonthlyTarget, request.SeasonalTarget))
        {
            return BadRequest("Invalid target values for the specified frequency.");
        }

        habit.Name = request.Name.Trim();
        habit.Description = request.Description?.Trim() ?? string.Empty;
        habit.Frequency = Enum.Parse<HabitFrequency>(request.Frequency);
        habit.WeeklyTarget = request.WeeklyTarget ?? 0;
        habit.MonthlyTarget = request.MonthlyTarget ?? 0;
        habit.SeasonalTarget = request.SeasonalTarget ?? 0;
        habit.IsActive = request.IsActive;
        habit.EstimatedDurationMinutes = request.EstimatedDurationMinutes ?? (habit.EstimatedDurationMinutes != 0 ? habit.EstimatedDurationMinutes : 30);
        habit.HasDeadline = request.HasDeadline ?? false;
        habit.DeadlineTime = request.HasDeadline == true && !string.IsNullOrEmpty(request.DeadlineTime)
            ? TimeOnly.Parse(request.DeadlineTime)
            : default;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!HabitExists(id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

        return Ok(habit);
    }

    // DELETE: api/habits/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteHabit(int id)
    {
        var habit = await _context.Habits.FindAsync(id);
        if (habit == null)
        {
            return NotFound();
        }

        // Check if habit has any completions
        var hasCompletions = await _context.HabitCompletions
            .AnyAsync(hc => hc.HabitId == id);

        if (hasCompletions)
        {
            // Instead of deleting, deactivate the habit to preserve historical data
            habit.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Habit deactivated to preserve historical data", habit });
        }
        else
        {
            // Safe to delete if no completions exist
            _context.Habits.Remove(habit);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Habit deleted successfully" });
        }
    }

    // POST: api/habits/{id}/toggle
    [HttpPost("{id}/toggle")]
    public async Task<IActionResult> ToggleHabitStatus(int id)
    {
        var habit = await _context.Habits.FindAsync(id);
        if (habit == null)
        {
            return NotFound();
        }

        habit.IsActive = !habit.IsActive;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Habit {(habit.IsActive ? "activated" : "deactivated")} successfully",
            habit
        });
    }

    // GET: api/habits/statistics
    [HttpGet("statistics")]
    public async Task<ActionResult<object>> GetHabitStatistics()
    {
        var totalHabits = await _context.Habits.CountAsync();
        var activeHabits = await _context.Habits.CountAsync(h => h.IsActive);
        var habitsByFrequency = await _context.Habits
            .GroupBy(h => h.Frequency)
            .Select(g => new { Frequency = g.Key.ToString(), Count = g.Count() })
            .ToListAsync();

        return Ok(new
        {
            totalHabits,
            activeHabits,
            inactiveHabits = totalHabits - activeHabits,
            habitsByFrequency
        });
    }

    private bool HabitExists(int id)
    {
        return _context.Habits.Any(e => e.Id == id);
    }

    private static bool IsValidFrequencyTarget(string frequency, int? weeklyTarget, int? monthlyTarget, int? seasonalTarget)
    {
        return frequency switch
        {
            "Daily" or "EveryTwoDays" => true, // No specific targets needed
            "Weekly" => weeklyTarget is > 0 and <= 7,
            "Monthly" => monthlyTarget is > 0 and <= 31,
            "Seasonal" => seasonalTarget is > 0 and <= 90,
            _ => false
        };
    }
}

// Request DTOs
public class CreateHabitRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Frequency { get; set; } = "Daily";
    public int? WeeklyTarget { get; set; }
    public int? MonthlyTarget { get; set; }
    public int? SeasonalTarget { get; set; }
    public bool? HasDeadline { get; set; }
    public string? DeadlineTime { get; set; }
    public bool IsOptional { get; set; } = false;
    public int? EstimatedDurationMinutes { get; set; }
}

public class UpdateHabitRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Frequency { get; set; } = "Daily";
    public int? WeeklyTarget { get; set; }
    public int? MonthlyTarget { get; set; }
    public int? SeasonalTarget { get; set; }
    public bool IsActive { get; set; } = true;
    public bool? HasDeadline { get; set; }
    public string? DeadlineTime { get; set; }
    public bool IsOptional { get; set; } = false;
    public int? EstimatedDurationMinutes { get; set; }
}