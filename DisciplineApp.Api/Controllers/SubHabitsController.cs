// Controllers/SubHabitsController.cs - NEW FILE

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;

namespace DisciplineApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SubHabitsController : ControllerBase
{
    private readonly DisciplineDbContext _context;
    private readonly IDailyStatsService _dailyStatsService;

    public SubHabitsController(DisciplineDbContext context, IDailyStatsService dailyStatsService)
    {
        _context = context;
        _dailyStatsService = dailyStatsService;
    }

    // GET: api/subhabits/habit/{habitId}
    [HttpGet("habit/{habitId}")]
    public async Task<ActionResult<IEnumerable<object>>> GetSubHabitsByHabit(int habitId)
    {
        var subHabits = await _context.SubHabits
            .Where(sh => sh.ParentHabitId == habitId && sh.IsActive)
            .OrderBy(sh => sh.OrderIndex)
            .Select(sh => new
            {
                id = sh.Id,
                parentHabitId = sh.ParentHabitId,
                name = sh.Name,
                description = sh.Description,
                orderIndex = sh.OrderIndex,
                isActive = sh.IsActive,
                createdAt = sh.CreatedAt
            })
            .ToListAsync();

        return Ok(subHabits);
    }

    // GET: api/subhabits/habit/{habitId}/date/{date}
    [HttpGet("habit/{habitId}/date/{date}")]
    public async Task<ActionResult<object>> GetSubHabitsWithCompletions(int habitId, string date)
    {
        if (!DateTime.TryParse(date, out var parsedDate))
        {
            return BadRequest("Invalid date format. Use YYYY-MM-DD.");
        }

        var subHabitsWithCompletions = await _context.SubHabits
            .Where(sh => sh.ParentHabitId == habitId && sh.IsActive)
            .OrderBy(sh => sh.OrderIndex)
            .Select(sh => new
            {
                id = sh.Id,
                parentHabitId = sh.ParentHabitId,
                name = sh.Name,
                description = sh.Description,
                orderIndex = sh.OrderIndex,
                isCompleted = sh.Completions.Any(c => c.Date.Date == parsedDate.Date && c.IsCompleted),
                completedAt = sh.Completions
                    .Where(c => c.Date.Date == parsedDate.Date && c.IsCompleted)
                    .Select(c => c.CompletedAt)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(new
        {
            habitId = habitId,
            date = date,
            subHabits = subHabitsWithCompletions
        });
    }

    // POST: api/subhabits
    [HttpPost]
    public async Task<ActionResult<object>> CreateSubHabit(CreateSubHabitRequest request)
    {
        // Validate parent habit exists
        var parentHabit = await _context.Habits.FindAsync(request.ParentHabitId);
        if (parentHabit == null)
        {
            return NotFound($"Parent habit with ID {request.ParentHabitId} not found.");
        }

        // Get next order index
        var maxOrder = await _context.SubHabits
            .Where(sh => sh.ParentHabitId == request.ParentHabitId)
            .MaxAsync(sh => (int?)sh.OrderIndex) ?? 0;

        var subHabit = new SubHabit
        {
            ParentHabitId = request.ParentHabitId,
            Name = request.Name,
            Description = request.Description ?? string.Empty,
            OrderIndex = maxOrder + 1,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.SubHabits.Add(subHabit);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSubHabitById), new { id = subHabit.Id }, new
        {
            id = subHabit.Id,
            parentHabitId = subHabit.ParentHabitId,
            name = subHabit.Name,
            description = subHabit.Description,
            orderIndex = subHabit.OrderIndex,
            isActive = subHabit.IsActive,
            createdAt = subHabit.CreatedAt
        });
    }

    // PUT: api/subhabits/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<object>> UpdateSubHabit(int id, UpdateSubHabitRequest request)
    {
        var subHabit = await _context.SubHabits.FindAsync(id);
        if (subHabit == null)
        {
            return NotFound($"Sub-habit with ID {id} not found.");
        }

        subHabit.Name = request.Name;
        subHabit.Description = request.Description ?? string.Empty;
        subHabit.IsActive = request.IsActive;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            id = subHabit.Id,
            parentHabitId = subHabit.ParentHabitId,
            name = subHabit.Name,
            description = subHabit.Description,
            orderIndex = subHabit.OrderIndex,
            isActive = subHabit.IsActive,
            createdAt = subHabit.CreatedAt,
            message = "Sub-habit updated successfully"
        });
    }

    // POST: api/subhabits/{id}/complete
    [HttpPost("{id}/complete")]
    public async Task<ActionResult<object>> CompleteSubHabit(int id, CompleteSubHabitRequest request)
    {
        var subHabit = await _context.SubHabits.FindAsync(id);
        if (subHabit == null)
        {
            return NotFound($"Sub-habit with ID {id} not found.");
        }

        if (!DateTime.TryParse(request.Date, out var parsedDate))
        {
            return BadRequest("Invalid date format. Use YYYY-MM-DD.");
        }

        // Find or create completion record
        var completion = await _context.SubHabitCompletions
            .FirstOrDefaultAsync(c => c.SubHabitId == id && c.Date.Date == parsedDate.Date);

        if (completion == null)
        {
            completion = new SubHabitCompletion
            {
                SubHabitId = id,
                Date = parsedDate.Date,
                IsCompleted = request.IsCompleted,
                CompletedAt = request.IsCompleted ? DateTime.UtcNow : null,
                Notes = request.Notes ?? string.Empty
            };
            _context.SubHabitCompletions.Add(completion);
        }
        else
        {
            completion.IsCompleted = request.IsCompleted;
            completion.CompletedAt = request.IsCompleted ? DateTime.UtcNow : null;
            completion.Notes = request.Notes ?? string.Empty;
        }

        await _context.SaveChangesAsync();

        // Check if parent habit should be completed (all sub-habits completed)
        var parentHabitCompleted = await CheckParentHabitCompletion(subHabit.ParentHabitId, parsedDate);

        return Ok(new
        {
            subHabitId = id,
            date = request.Date,
            isCompleted = completion.IsCompleted,
            completedAt = completion.CompletedAt,
            parentHabitCompleted = parentHabitCompleted,
            message = $"Sub-habit {(completion.IsCompleted ? "completed" : "uncompleted")} successfully"
        });
    }

    // POST: api/subhabits/habit/{habitId}/complete-all
    [HttpPost("habit/{habitId}/complete-all")]
    public async Task<ActionResult<object>> CompleteAllSubHabits(int habitId, CompleteAllSubHabitsRequest request)
    {
        if (!DateTime.TryParse(request.Date, out var parsedDate))
        {
            return BadRequest("Invalid date format. Use YYYY-MM-DD.");
        }

        var subHabits = await _context.SubHabits
            .Where(sh => sh.ParentHabitId == habitId && sh.IsActive)
            .ToListAsync();

        if (!subHabits.Any())
        {
            return NotFound($"No active sub-habits found for habit ID {habitId}.");
        }

        var completedCount = 0;

        foreach (var subHabit in subHabits)
        {
            var completion = await _context.SubHabitCompletions
                .FirstOrDefaultAsync(c => c.SubHabitId == subHabit.Id && c.Date.Date == parsedDate.Date);

            if (completion == null)
            {
                completion = new SubHabitCompletion
                {
                    SubHabitId = subHabit.Id,
                    Date = parsedDate.Date,
                    IsCompleted = true,
                    CompletedAt = DateTime.UtcNow,
                    Notes = "Completed via quick-complete"
                };
                _context.SubHabitCompletions.Add(completion);
            }
            else
            {
                completion.IsCompleted = true;
                completion.CompletedAt = DateTime.UtcNow;
                completion.Notes = "Completed via quick-complete";
            }

            completedCount++;
        }

        await _context.SaveChangesAsync();

        // Mark parent habit as completed
        var parentHabitCompleted = await CheckParentHabitCompletion(habitId, parsedDate);

        return Ok(new
        {
            habitId = habitId,
            date = request.Date,
            completedSubHabits = completedCount,
            totalSubHabits = subHabits.Count,
            parentHabitCompleted = parentHabitCompleted,
            message = $"All {completedCount} sub-habits completed successfully"
        });
    }

    // DELETE: api/subhabits/{id}
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteSubHabit(int id)
    {
        var subHabit = await _context.SubHabits.FindAsync(id);
        if (subHabit == null)
        {
            return NotFound($"Sub-habit with ID {id} not found.");
        }

        _context.SubHabits.Remove(subHabit);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Sub-habit deleted successfully" });
    }

    // GET: api/subhabits/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetSubHabitById(int id)
    {
        var subHabit = await _context.SubHabits.FindAsync(id);
        if (subHabit == null)
        {
            return NotFound($"Sub-habit with ID {id} not found.");
        }

        return Ok(new
        {
            id = subHabit.Id,
            parentHabitId = subHabit.ParentHabitId,
            name = subHabit.Name,
            description = subHabit.Description,
            orderIndex = subHabit.OrderIndex,
            isActive = subHabit.IsActive,
            createdAt = subHabit.CreatedAt
        });
    }

    // PRIVATE: Check if parent habit should be completed
    private async Task<bool> CheckParentHabitCompletion(int habitId, DateTime date)
    {
        var subHabits = await _context.SubHabits
            .Where(sh => sh.ParentHabitId == habitId && sh.IsActive)
            .ToListAsync();

        if (!subHabits.Any())
        {
            return false; // No sub-habits, so parent can't be auto-completed
        }

        var allCompleted = true;

        foreach (var subHabit in subHabits)
        {
            var completion = await _context.SubHabitCompletions
                .FirstOrDefaultAsync(c => c.SubHabitId == subHabit.Id &&
                                        c.Date.Date == date.Date &&
                                        c.IsCompleted);

            if (completion == null)
            {
                allCompleted = false;
                break;
            }
        }

        if (allCompleted)
        {
            // Mark parent habit as completed
            var habitCompletion = await _context.HabitCompletions
                .FirstOrDefaultAsync(c => c.HabitId == habitId && c.Date.Date == date.Date);

            if (habitCompletion == null)
            {
                habitCompletion = new HabitCompletion
                {
                    HabitId = habitId,
                    Date = date.Date,
                    IsCompleted = true,
                    CompletedAt = DateTime.UtcNow,
                    Notes = "Auto-completed: all sub-habits completed"
                };
                _context.HabitCompletions.Add(habitCompletion);
            }
            else
            {
                habitCompletion.IsCompleted = true;
                habitCompletion.CompletedAt = DateTime.UtcNow;
                habitCompletion.Notes = "Auto-completed: all sub-habits completed";
            }

            await _context.SaveChangesAsync();
            try
            {
                var updatedStats = await _dailyStatsService.CalculateAndStoreDailyStatsAsync(date.Date);
                Console.WriteLine($"📊 Updated daily stats after parent habit completion: {updatedStats.CompletedTasks}/{updatedStats.TotalTasks}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error updating daily stats: {ex.Message}");
                // Don't fail the entire operation if stats update fails
            }
        }

        return allCompleted;
    }
}

// Request DTOs
public class CreateSubHabitRequest
{
    public int ParentHabitId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class UpdateSubHabitRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class CompleteSubHabitRequest
{
    public string Date { get; set; } = string.Empty; // YYYY-MM-DD
    public bool IsCompleted { get; set; }
    public string? Notes { get; set; }
}

public class CompleteAllSubHabitsRequest
{
    public string Date { get; set; } = string.Empty; // YYYY-MM-DD
}