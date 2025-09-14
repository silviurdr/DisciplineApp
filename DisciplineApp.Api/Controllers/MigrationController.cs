// Create Controllers/MigrationController.cs

using DisciplineApp.Api.Data;
using DisciplineApp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace DisciplineApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MigrationController : ControllerBase
{
    private readonly DisciplineDbContext _context;

    public MigrationController(DisciplineDbContext context)
    {
        _context = context;
    }

    [HttpPost("seed-habits")]
    public async Task<IActionResult> SeedHabits()
    {
        try
        {
            await HabitSeedData.SeedHabitsAsync(_context);
            return Ok(new { message = "Habits seeded successfully!" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("database-status")]
    public async Task<IActionResult> GetDatabaseStatus()
    {
        var habitCount = _context.Habits.Count();
        var completionCount = _context.HabitCompletions.Count();

        return Ok(new
        {
            habits = habitCount,
            completions = completionCount,
            message = habitCount == 0 ? "Database is empty - run seed-habits endpoint" : "Database has data"
        });
    }
}