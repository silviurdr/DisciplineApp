using DisciplineApp.Api.Data;
using DisciplineApp.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace DisciplineApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HabitTrackingController : ControllerBase
{
    private readonly HabitCalculationService _habitCalculationService;
    private readonly DisciplineDbContext _context;
    private readonly ILogger<HabitTrackingController> _logger;

    public HabitTrackingController(
        HabitCalculationService habitCalculationService,
        DisciplineDbContext context,
        ILogger<HabitTrackingController> logger)
    {
        _habitCalculationService = habitCalculationService;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get comprehensive day status including all habits and recommendations
    /// </summary>
    [HttpGet("day/{date}")]
    public async Task<ActionResult<DayStatusResponse>> GetDayStatus(string date)
    {
        try
        {
            if (!DateTime.TryParse(date, out var parsedDate))
            {
                return BadRequest("Invalid date format. Use YYYY-MM-DD.");
            }

            var dayStatus = await _habitCalculationService.GetDayStatus(parsedDate);
            return Ok(dayStatus);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting day status for {Date}", date);
            return StatusCode(500, "Internal server error");
        }
    }
}