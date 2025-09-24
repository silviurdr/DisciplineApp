using DisciplineApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Services
{
    public class TaskMovementService
    {
        private readonly DisciplineDbContext _context;
        private readonly ILogger<TaskMovementService> _logger;

        public TaskMovementService(DisciplineDbContext context, ILogger<TaskMovementService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task MoveOverdueTasksAsync()
        {
            var today = DateTime.Today;
            var yesterday = today.AddDays(-1);

            _logger.LogInformation($"Moving overdue tasks from {yesterday:yyyy-MM-dd} to {today:yyyy-MM-dd}");

            // Find incomplete ad-hoc tasks from yesterday that have deadlines
            var tasksToMove = await _context.AdHocTasks
                .Where(t => t.Date.Date < today &&
                           !t.IsCompleted &&
                           t.DeadlineDate.HasValue &&
                           t.DeadlineDate.Value.Date >= today) // Only move if deadline hasn't passed completely
                .ToListAsync();

            _logger.LogInformation($"Found {tasksToMove.Count} tasks to move");

            foreach (var task in tasksToMove)
            {
                _logger.LogInformation($"Moving task: {task.Name} (ID: {task.Id}) from {task.Date:yyyy-MM-dd} to {today:yyyy-MM-dd}");

                // Store original date if this is the first move
                if (!task.IsAutoMoved)
                {
                    task.OriginalDate = task.Date;
                    _logger.LogInformation($"Storing original date: {task.OriginalDate:yyyy-MM-dd} for task {task.Name}");
                }

                // Move to today
                task.Date = today;
                task.IsAutoMoved = true;

                // Check if this is the deadline day
                if (task.DeadlineDate.HasValue && task.DeadlineDate.Value.Date == today)
                {
                    _logger.LogInformation($"Task {task.Name} moved to its deadline day: {today:yyyy-MM-dd}");
                    // Optionally, you could mark it as high priority or send a notification
                }
            }

            if (tasksToMove.Any())
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Successfully moved {tasksToMove.Count} tasks to today");
            }
            else
            {
                _logger.LogInformation("No tasks needed to be moved today");
            }
        }

        public async Task<List<object>> GetMovedTasksSummaryAsync()
        {
            var today = DateTime.Today;

            var movedTasks = await _context.AdHocTasks
                .Where(t => t.Date.Date == today && t.IsAutoMoved)
                .Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.Description,
                    CurrentDate = t.Date,
                    OriginalDate = t.OriginalDate,
                    DeadlineDate = t.DeadlineDate,
                    IsCompleted = t.IsCompleted,
                    DaysMovedForward = t.OriginalDate.HasValue ?
                        (t.Date.Date - t.OriginalDate.Value.Date).Days : 0
                })
                .ToListAsync();

            return movedTasks.Cast<object>().ToList();
        }

        // Manual trigger method for testing
        public async Task<string> TriggerTaskMovementManuallyAsync()
        {
            try
            {
                await MoveOverdueTasksAsync();
                var summary = await GetMovedTasksSummaryAsync();
                return $"Task movement completed. {summary.Count} tasks are currently moved forward today.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during manual task movement trigger");
                return $"Error during task movement: {ex.Message}";
            }
        }
    }
}