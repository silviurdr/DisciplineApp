using DisciplineApp.Api.Models;
using DisciplineApp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace DisciplineApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DisciplineController : ControllerBase
    {
        private readonly IDisciplineService _disciplineService;
        private readonly ILogger<DisciplineController> _logger;

        public DisciplineController(IDisciplineService disciplineService, ILogger<DisciplineController> logger)
        {
            _disciplineService = disciplineService;
            _logger = logger;
        }

        /// <summary>
        /// Get calendar data for a specific year
        /// </summary>
        [HttpGet("calendar/{year:int}")]
        public async Task<ActionResult<YearCalendarDto>> GetCalendar(int year)
        {
            try
            {
                if (year < 2020 || year > 2030)
                {
                    return BadRequest("Year must be between 2020 and 2030");
                }

                var calendar = await _disciplineService.GetYearCalendarAsync(year);
                return Ok(calendar);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving calendar for year {Year}", year);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Toggle completion status for a specific day
        /// </summary>
        [HttpPost("toggle")]
        public async Task<ActionResult<CalendarDayDto>> ToggleDay([FromBody] ToggleDayRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var day = await _disciplineService.ToggleDayAsync(request.Date, request.Notes);
                return Ok(day);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling day {Date}", request.Date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Update notes for a specific day
        /// </summary>
        [HttpPut("notes")]
        public async Task<ActionResult<CalendarDayDto>> UpdateNotes([FromBody] UpdateNotesRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var day = await _disciplineService.UpdateNotesAsync(request.Date, request.Notes);
                return Ok(day);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating notes for {Date}", request.Date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get streak statistics
        /// </summary>
        [HttpGet("streaks")]
        public async Task<ActionResult<StreakInfo>> GetStreakInfo()
        {
            try
            {
                var streakInfo = await _disciplineService.GetStreakInfoAsync();
                return Ok(streakInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving streak information");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Health check endpoint
        /// </summary>
        [HttpGet("health")]
        public ActionResult<object> HealthCheck()
        {
            return Ok(new
            {
                status = "healthy",
                timestamp = DateTime.UtcNow,
                version = "1.0.0"
            });
        }
    }
}