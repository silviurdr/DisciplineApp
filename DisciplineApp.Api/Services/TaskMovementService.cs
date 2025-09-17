using DisciplineApp.Api.Data;
using System.Data.Entity;

public class TaskMovementService
{
    private readonly DisciplineDbContext _context;

    public async Task MoveOverdueTasksAsync()
    {
        var today = DateTime.Today;
        var yesterday = today.AddDays(-1);

        // Find incomplete ad-hoc tasks from yesterday that have deadlines
        var tasksToMove = await _context.AdHocTasks
            .Where(t => t.Date.Date == yesterday &&
                       !t.IsCompleted &&
                       t.DeadlineDate.HasValue &&
                       t.DeadlineDate.Value.Date >= today) // Only move if deadline hasn't passed
            .ToListAsync();

        foreach (var task in tasksToMove)
        {
            // Store original date if this is the first move
            if (!task.IsAutoMoved)
            {
                task.OriginalDate = task.Date;
            }

            // Move to today
            task.Date = today;
            task.IsAutoMoved = true;
        }

        await _context.SaveChangesAsync();
    }
}