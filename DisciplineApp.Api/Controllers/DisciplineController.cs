using Microsoft.AspNetCore.Mvc;
using DisciplineApp.Api.Services;
using DisciplineApp.Api.Models;

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
        /// Health check endpoint
        /// </summary>
        [HttpGet("health")]
        public IActionResult Health()
        {
            return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
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
                _logger.LogError(ex, "Error getting calendar for year {Year}", year);
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
                if (string.IsNullOrEmpty(request.Date))
                {
                    return BadRequest("Date is required in format YYYY-MM-DD");
                }

                _logger.LogInformation("Toggling day: {Date}", request.Date);

                var updatedDay = await _disciplineService.ToggleDayAsync(request.Date);
                return Ok(updatedDay);
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Invalid date format: {Date}", request.Date);
                return BadRequest($"Invalid date format: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling day {Date}", request.Date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Update a specific day's completion status and notes
        /// </summary>
        [HttpPut("day")]
        public async Task<ActionResult<CalendarDayDto>> UpdateDay([FromBody] UpdateDayRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Date))
                {
                    return BadRequest("Date is required in format YYYY-MM-DD");
                }

                _logger.LogInformation("Updating day: {Date}, Completed: {IsCompleted}", request.Date, request.IsCompleted);

                var updatedDay = await _disciplineService.UpdateDayAsync(request.Date, request.IsCompleted, request.Notes);
                return Ok(updatedDay);
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Invalid date format: {Date}", request.Date);
                return BadRequest($"Invalid date format: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating day {Date}", request.Date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get current streak information
        /// </summary>
        [HttpGet("streak")]
        public async Task<ActionResult<StreakInfoDto>> GetStreakInfo()
        {
            try
            {
                var streakInfo = await _disciplineService.GetStreakInfoAsync();
                return Ok(streakInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting streak info");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get details for a specific day
        /// </summary>
        [HttpGet("day/{date}")]
        public async Task<ActionResult<CalendarDayDto>> GetDay(string date)
        {
            try
            {
                if (string.IsNullOrEmpty(date))
                {
                    return BadRequest("Date is required in format YYYY-MM-DD");
                }

                var day = await _disciplineService.GetDayAsync(date);
                if (day == null)
                {
                    return NotFound($"No data found for date {date}");
                }

                return Ok(day);
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Invalid date format: {Date}", date);
                return BadRequest($"Invalid date format: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting day {Date}", date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get today's completion status
        /// </summary>
        [HttpGet("today")]
        public async Task<ActionResult<CalendarDayDto>> GetToday()
        {
            try
            {
                var today = DateHelper.GetToday();
                var todayString = DateHelper.ToDateString(today);

                var day = await _disciplineService.GetDayAsync(todayString);
                return Ok(day);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting today's data");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Mark today as completed (quick action endpoint)
        /// </summary>
        [HttpPost("complete-today")]
        public async Task<ActionResult<CalendarDayDto>> CompleteToday()
        {
            try
            {
                var today = DateHelper.GetToday();
                var todayString = DateHelper.ToDateString(today);

                _logger.LogInformation("Marking today as completed: {Date}", todayString);

                var updatedDay = await _disciplineService.UpdateDayAsync(todayString, true);
                return Ok(updatedDay);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error completing today");
                return StatusCode(500, "Internal server error");
            }
        }
    }
}