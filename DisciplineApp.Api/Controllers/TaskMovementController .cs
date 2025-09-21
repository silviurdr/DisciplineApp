using Microsoft.AspNetCore.Mvc;
using DisciplineApp.Api.Services;

namespace DisciplineApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TaskMovementController : ControllerBase
    {
        private readonly TaskMovementService _taskMovementService;
        private readonly ILogger<TaskMovementController> _logger;

        public TaskMovementController(TaskMovementService taskMovementService, ILogger<TaskMovementController> logger)
        {
            _taskMovementService = taskMovementService;
            _logger = logger;
        }

        [HttpPost("move-overdue-tasks")]
        public async Task<IActionResult> MoveOverdueTasks()
        {
            try
            {
                var result = await _taskMovementService.TriggerTaskMovementManuallyAsync();
                return Ok(new { message = result, timestamp = DateTime.Now });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error triggering task movement");
                return StatusCode(500, new { error = "Failed to move tasks", details = ex.Message });
            }
        }

        [HttpGet("moved-tasks-summary")]
        public async Task<IActionResult> GetMovedTasksSummary()
        {
            try
            {
                var summary = await _taskMovementService.GetMovedTasksSummaryAsync();
                return Ok(summary);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting moved tasks summary");
                return StatusCode(500, new { error = "Failed to get moved tasks summary", details = ex.Message });
            }
        }
    }
}