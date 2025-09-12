using Microsoft.AspNetCore.Mvc;
using DisciplineApp.Api.Services;
using DisciplineApp.Api.Models;

namespace DisciplineApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HabitTrackingController : ControllerBase
    {
        private readonly IHabitCalculationService _habitCalculationService;
        private readonly IDataMigrationService _dataMigrationService;
        private readonly ILogger<HabitTrackingController> _logger;

        public HabitTrackingController(
            IHabitCalculationService habitCalculationService,
            IDataMigrationService dataMigrationService,
            ILogger<HabitTrackingController> logger)
        {
            _habitCalculationService = habitCalculationService;
            _dataMigrationService = dataMigrationService;
            _logger = logger;
        }

        /// <summary>
        /// Get comprehensive day status including all habits and recommendations
        /// </summary>
        [HttpGet("day/{date}")]
        public async Task<ActionResult<DayStatusDto>> GetDayStatus(string date)
        {
            try
            {
                if (string.IsNullOrEmpty(date))
                {
                    return BadRequest("Date is required in format YYYY-MM-DD");
                }

                var parsedDate = DateHelper.ParseDateString(date);
                var dayStatus = await _habitCalculationService.CalculateDayStatusAsync(parsedDate);

                return Ok(dayStatus);
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Invalid date format: {Date}", date);
                return BadRequest($"Invalid date format: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting day status for {Date}", date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get today's status (convenience endpoint)
        /// </summary>
        [HttpGet("today")]
        public async Task<ActionResult<DayStatusDto>> GetTodayStatus()
        {
            try
            {
                var today = DateHelper.GetToday();
                var dayStatus = await _habitCalculationService.CalculateDayStatusAsync(today);

                return Ok(dayStatus);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting today's status");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost("complete")]
        public async Task<ActionResult<DayStatusDto>> CompleteHabit([FromBody] CompleteHabitRequest request)
        {
            try
            {
                if (request.HabitId <= 0)
                {
                    return BadRequest("HabitId must be greater than 0");
                }

                if (string.IsNullOrEmpty(request.Date))
                {
                    return BadRequest("Date is required in format YYYY-MM-DD");
                }

                var date = DateHelper.ParseDateString(request.Date);

                var success = await _habitCalculationService.CompleteHabitAsync(
                    request.HabitId,
                    date,
                    request.Notes);

                // Remove this check since CompleteHabitAsync now handles toggling
                // if (!success)
                // {
                //     return BadRequest("Failed to complete habit - may already be completed");
                // }

                // Always return updated day status regardless of toggle direction
                var updatedDayStatus = await _habitCalculationService.CalculateDayStatusAsync(date);
                return Ok(updatedDayStatus);
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Invalid request: {Message}", ex.Message);
                return BadRequest($"Invalid request: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling habit {HabitId} for {Date}",
                    request.HabitId, request.Date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get week overview with all habit progress
        /// </summary>
        [HttpGet("week/{date}")]
        public async Task<ActionResult<WeekStatusDto>> GetWeekStatus(string date)
        {
            try
            {
                if (string.IsNullOrEmpty(date))
                {
                    return BadRequest("Date is required in format YYYY-MM-DD");
                }

                var parsedDate = DateHelper.ParseDateString(date);
                var weekStatus = await _habitCalculationService.GetWeekStatusAsync(parsedDate);

                return Ok(weekStatus);
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Invalid date format: {Date}", date);
                return BadRequest($"Invalid date format: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting week status for {Date}", date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get this week's status (convenience endpoint)
        /// </summary>
        [HttpGet("week/current")]
        public async Task<ActionResult<WeekStatusDto>> GetCurrentWeekStatus()
        {
            try
            {
                var today = DateHelper.GetToday();
                var weekStatus = await _habitCalculationService.GetWeekStatusAsync(today);

                return Ok(weekStatus);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current week status");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get smart reminders for today
        /// </summary>
        [HttpGet("reminders")]
        public async Task<ActionResult<List<string>>> GetTodayReminders()
        {
            try
            {
                var today = DateHelper.GetToday();
                var reminders = await _habitCalculationService.GetSmartRemindersAsync(today);

                return Ok(reminders);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting today's reminders");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get reminders for a specific date
        /// </summary>
        [HttpGet("reminders/{date}")]
        public async Task<ActionResult<List<string>>> GetRemindersForDate(string date)
        {
            try
            {
                if (string.IsNullOrEmpty(date))
                {
                    return BadRequest("Date is required in format YYYY-MM-DD");
                }

                var parsedDate = DateHelper.ParseDateString(date);
                var reminders = await _habitCalculationService.GetSmartRemindersAsync(parsedDate);

                return Ok(reminders);
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Invalid date format: {Date}", date);
                return BadRequest($"Invalid date format: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting reminders for {Date}", date);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get grace period status
        /// </summary>
        [HttpGet("grace")]
        public async Task<ActionResult<GracePeriodStatusDto>> GetGracePeriodStatus()
        {
            try
            {
                var graceStatus = await _habitCalculationService.GetGracePeriodStatusAsync();
                return Ok(graceStatus);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting grace period status");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Trigger data migration from old discipline system to new habit system
        /// </summary>
        [HttpPost("migrate")]
        public async Task<ActionResult<object>> MigrateData()
        {
            try
            {
                _logger.LogInformation("Starting data migration...");

                var success = await _dataMigrationService.MigrateExistingDataAsync();

                if (success)
                {
                    return Ok(new
                    {
                        message = "Data migration completed successfully",
                        timestamp = DateTime.UtcNow
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = "Data migration failed - check logs for details",
                        timestamp = DateTime.UtcNow
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during data migration");
                return StatusCode(500, new
                {
                    message = "Internal server error during migration",
                    error = ex.Message,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        /// <summary>
        /// Setup initial habits (can be called multiple times safely)
        /// </summary>
        [HttpPost("setup-habits")]
        public async Task<ActionResult<object>> SetupHabits()
        {
            try
            {
                _logger.LogInformation("Setting up initial habits...");

                var success = await _dataMigrationService.SetupHabitsAsync();

                if (success)
                {
                    return Ok(new
                    {
                        message = "Habits setup completed successfully",
                        timestamp = DateTime.UtcNow
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        message = "Habits setup failed - check logs for details",
                        timestamp = DateTime.UtcNow
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during habits setup");
                return StatusCode(500, new
                {
                    message = "Internal server error during habits setup",
                    error = ex.Message,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        /// <summary>
        /// Health check for habit tracking system
        /// </summary>
        [HttpGet("health")]
        public async Task<IActionResult> HealthCheck()
        {
            try
            {
                // Test database connectivity and basic functionality
                var today = DateHelper.GetToday();
                var todayStatus = await _habitCalculationService.CalculateDayStatusAsync(today);

                return Ok(new
                {
                    status = "healthy",
                    timestamp = DateTime.UtcNow,
                    todayDate = DateHelper.ToDateString(today),
                    habitSystemOperational = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Health check failed");
                return StatusCode(500, new
                {
                    status = "unhealthy",
                    timestamp = DateTime.UtcNow,
                    error = ex.Message
                });
            }
        }
    }
}