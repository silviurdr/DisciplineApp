using DisciplineApp.Api.Models;
using DisciplineApp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace DisciplineApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HabitTrackingController : ControllerBase
    {
        private readonly IHabitCalculationService _habitService;
        private readonly ILogger<HabitTrackingController> _logger;

        public HabitTrackingController(IHabitCalculationService habitService, ILogger<HabitTrackingController> logger)
        {
            _habitService = habitService;
            _logger = logger;
        }

        /// <summary>
        /// Get the status for a specific day - which habits are required, completed, etc.
        /// </summary>
        [HttpGet("day/{date:datetime}")]
        public async Task<ActionResult<DayStatus>> GetDayStatus(DateTime date)
        {
            try
            {
                var dayStatus = await _habitService.CalculateDayStatusAsync(date.Date);
                return Ok(dayStatus);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating day status for {Date}", date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get weekly progress for the week containing the specified date
        /// </summary>
        [HttpGet("week/{date:datetime}")]
        public async Task<ActionResult<WeeklyProgress>> GetWeeklyProgress(DateTime date)
        {
            try
            {
                var progress = await _habitService.GetWeeklyProgressAsync(date.Date);
                return Ok(progress);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating weekly progress for {Date}", date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Calculate overall streak statistics
        /// </summary>
        [HttpGet("streak")]
        public async Task<ActionResult<StreakCalculationResult>> GetStreakInfo()
        {
            try
            {
                var streak = await _habitService.CalculateStreakAsync();
                return Ok(streak);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating streak information");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get smart reminders based on current progress
        /// </summary>
        [HttpGet("reminders")]
        public async Task<ActionResult<List<string>>> GetSmartReminders()
        {
            try
            {
                var reminders = await _habitService.GetSmartRemindersAsync();
                return Ok(reminders);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating smart reminders");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Mark a habit as completed for a specific date
        /// </summary>
        [HttpPost("complete")]
        public async Task<ActionResult> CompleteHabit([FromBody] CompleteHabitRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var success = await _habitService.CompleteHabitAsync(request);
                if (success)
                {
                    // Return updated day status
                    var dayStatus = await _habitService.CalculateDayStatusAsync(request.Date);
                    return Ok(dayStatus);
                }

                return BadRequest("Failed to complete habit");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error completing habit {HabitId} for {Date}", request.HabitId, request.Date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Use a grace day for the specified date
        /// </summary>
        [HttpPost("grace")]
        public async Task<ActionResult> UseGraceDay([FromBody] UseGraceRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var success = await _habitService.UseGraceDayAsync(request);
                if (success)
                {
                    var dayStatus = await _habitService.CalculateDayStatusAsync(request.Date);
                    return Ok(dayStatus);
                }

                return BadRequest("No grace days remaining this week");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error using grace day for {Date}", request.Date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get calendar data with habit completion status for a full month
        /// </summary>
        [HttpGet("calendar/{year:int}/{month:int}")]
        public async Task<ActionResult<List<DayStatus>>> GetMonthCalendar(int year, int month)
        {
            try
            {
                if (month < 1 || month > 12)
                {
                    return BadRequest("Month must be between 1 and 12");
                }

                var monthData = new List<DayStatus>();
                var daysInMonth = DateTime.DaysInMonth(year, month);

                for (int day = 1; day <= daysInMonth; day++)
                {
                    var date = new DateTime(year, month, day);
                    var dayStatus = await _habitService.CalculateDayStatusAsync(date);
                    monthData.Add(dayStatus);
                }

                return Ok(monthData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating month calendar for {Year}-{Month}", year, month);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get all active habits
        /// </summary>
        [HttpGet("habits")]
        public async Task<ActionResult<List<Habit>>> GetHabits()
        {
            try
            {
                // You'll need to add this method to your service or directly query the context
                // For now, I'll add a placeholder
                return Ok(new List<Habit>());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving habits");
                return StatusCode(500, "Internal server error");
            }
        }
    }
}