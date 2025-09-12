using DisciplineApp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace DisciplineApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MigrationController : ControllerBase
{
    private readonly DataMigrationService _migrationService;

    public MigrationController(DataMigrationService migrationService)
    {
        _migrationService = migrationService;
    }

    /// <summary>
    /// Migrate existing discipline entries to the new habit-based system
    /// </summary>
    [HttpPost("migrate-data")]
    public async Task<IActionResult> MigrateData()
    {
        try
        {
            var result = await _migrationService.MigrateExistingDataAsync();
            return Ok(new { message = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Add sample completions for testing the habit system
    /// </summary>
    [HttpPost("add-sample-data")]
    public async Task<IActionResult> AddSampleData()
    {
        try
        {
            var result = await _migrationService.AddSampleCompletionsAsync();
            return Ok(new { message = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}