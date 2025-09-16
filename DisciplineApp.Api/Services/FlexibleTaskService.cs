using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Services
{
    public interface IFlexibleTaskService
    {
        Task<List<HabitWithFlexibility>> GetDayTasksWithFlexibility(DateTime date);
        Task<bool> CanDeferTask(int habitId, DateTime fromDate);
        Task<HabitWithFlexibility> DeferTaskToTomorrow(int habitId, DateTime fromDate, string reason);
        Task<HabitWithFlexibility> CalculateTaskFlexibility(Habit habit, DateTime scheduledDate);
    }

    public class FlexibleTaskService : IFlexibleTaskService
    {
        private readonly DisciplineDbContext _context;

        public FlexibleTaskService(DisciplineDbContext context)
        {
            _context = context;
        }

        public async Task<List<HabitWithFlexibility>> GetDayTasksWithFlexibility(DateTime date)
        {
            var habits = await _context.Habits
                .Where(h => h.IsActive)
                .Include(h => h.Deferrals)
                .Include(h => h.Completions)
                .ToListAsync();

            var flexibleTasks = new List<HabitWithFlexibility>();

            foreach (var habit in habits)
            {
                // Check if this habit should appear on this date
                if (await ShouldHabitAppearOnDate(habit, date))
                {
                    var flexibleTask = await CalculateTaskFlexibility(habit, date);
                    flexibleTasks.Add(flexibleTask);
                }
            }

            return flexibleTasks;
        }

        public async Task<bool> CanDeferTask(int habitId, DateTime fromDate)
        {
            var habit = await _context.Habits.FindAsync(habitId);
            if (habit == null) return false;

            // Ensure MaxDeferrals is set
            if (habit.MaxDeferrals == 0)
            {
                habit.MaxDeferrals = GetMaxDeferralsForFrequency(habit.Frequency);
            }

            // Get existing deferral for this specific date
            var existingDeferral = await _context.TaskDeferrals
                .FirstOrDefaultAsync(d => d.HabitId == habitId &&
                                   d.OriginalDate.Date == fromDate.Date &&
                                   !d.IsCompleted);

            if (existingDeferral != null)
            {
                return existingDeferral.DeferralsUsed < habit.MaxDeferrals;
            }

            return habit.MaxDeferrals > 0; // Can defer if max deferrals > 0
        }

        public async Task<HabitWithFlexibility> DeferTaskToTomorrow(int habitId, DateTime fromDate, string reason)
        {
            var habit = await _context.Habits.FindAsync(habitId);
            if (habit == null)
                throw new InvalidOperationException("Habit not found");

            if (!await CanDeferTask(habitId, fromDate))
                throw new InvalidOperationException("Cannot defer this task - no deferrals remaining");

            var existingDeferral = await _context.TaskDeferrals
                .FirstOrDefaultAsync(d => d.HabitId == habitId &&
                                   d.OriginalDate.Date == fromDate.Date &&
                                   !d.IsCompleted);

            if (existingDeferral != null)
            {
                // Update existing deferral
                existingDeferral.DeferralsUsed++;
                existingDeferral.DeferredToDate = existingDeferral.DeferredToDate.AddDays(1);
                existingDeferral.Reason = reason;
            }
            else
            {
                // Create new deferral
                var newDeferral = new TaskDeferral
                {
                    HabitId = habitId,
                    OriginalDate = fromDate,
                    DeferredToDate = fromDate.AddDays(1),
                    DeferralsUsed = 1,
                    Reason = reason,
                    CreatedAt = DateTime.UtcNow
                };
                _context.TaskDeferrals.Add(newDeferral);
            }

            await _context.SaveChangesAsync();

            return await CalculateTaskFlexibility(habit, fromDate);
        }

        public async Task<HabitWithFlexibility> CalculateTaskFlexibility(Habit habit, DateTime scheduledDate)
        {
            // Ensure MaxDeferrals is set based on frequency if not already set
            if (habit.MaxDeferrals == 0)
            {
                habit.MaxDeferrals = GetMaxDeferralsForFrequency(habit.Frequency);
                _context.Habits.Update(habit);
                await _context.SaveChangesAsync();
            }

            // Get ALL deferrals for this habit and date combination
            var deferrals = await _context.TaskDeferrals
                .Where(d => d.HabitId == habit.Id &&
                       (d.OriginalDate.Date == scheduledDate.Date ||
                        d.DeferredToDate.Date == scheduledDate.Date))
                .OrderBy(d => d.CreatedAt)
                .ToListAsync();

            // Calculate total deferrals used for this specific task instance
            var totalDeferralsUsed = 0;
            DateTime currentDueDate = scheduledDate;

            if (deferrals.Any())
            {
                // Find the deferral chain starting from the original date
                var currentDeferral = deferrals.FirstOrDefault(d => d.OriginalDate.Date == scheduledDate.Date);
                if (currentDeferral != null)
                {
                    totalDeferralsUsed = currentDeferral.DeferralsUsed;
                    currentDueDate = currentDeferral.DeferredToDate;
                }
            }

            // Check if completed on current due date
            var isCompleted = await _context.HabitCompletions
                .AnyAsync(c => c.HabitId == habit.Id &&
                             c.Date.Date == currentDueDate.Date &&
                             c.IsCompleted);

            var flexibleTask = new HabitWithFlexibility
            {
                HabitId = habit.Id,
                Name = habit.Name,
                Description = habit.Description,
                Frequency = habit.Frequency.ToString(),
                OriginalScheduledDate = scheduledDate,
                CurrentDueDate = currentDueDate,
                DeferralsUsed = totalDeferralsUsed,
                MaxDeferrals = habit.MaxDeferrals,
                CanStillBeDeferred = totalDeferralsUsed < habit.MaxDeferrals,
                IsCompleted = isCompleted,
                IsLocked = habit.IsLocked,
                HasDeadline = habit.HasDeadline,
                DeadlineTime = habit.DeadlineTime
            };

            // Calculate urgency and labels
            CalculateUrgencyAndLabels(flexibleTask);

            return flexibleTask;
        }

        private async Task<bool> ShouldHabitAppearOnDate(Habit habit, DateTime date)
        {
            // Simplified logic - you can enhance this based on your existing scheduling logic
            switch (habit.Frequency)
            {
                case HabitFrequency.Daily:
                    return true;
                case HabitFrequency.Weekly:
                    // Check if it's scheduled for this week and not completed
                    return true; // Simplify for now
                case HabitFrequency.Monthly:
                case HabitFrequency.Seasonal:
                    // Check if it should appear based on your monthly/seasonal logic
                    return true; // Simplify for now
                default:
                    return false;
            }
        }

        private int GetMaxDeferralsForFrequency(HabitFrequency frequency)
        {
            return frequency switch
            {
                HabitFrequency.Daily => 0,      // No deferrals for daily
                HabitFrequency.EveryTwoDays => 1, // Limited deferrals for rolling
                HabitFrequency.Weekly => 2,     // 2 deferrals for weekly
                HabitFrequency.Monthly => 6,    // 6 deferrals for monthly
                HabitFrequency.Seasonal => 6,   // 6 deferrals for seasonal
                _ => 0
            };
        }

        private void CalculateUrgencyAndLabels(HabitWithFlexibility task)
        {
            if (task.MaxDeferrals == 0)
            {
                // Daily tasks
                task.UrgencyLevel = "urgent";
                task.StatusLabel = "Due today";
                task.FlexibilityIcon = "🔥";
                task.FlexibilityColor = "#fd7e14";
                return;
            }

            var remainingDeferrals = task.MaxDeferrals - task.DeferralsUsed;
            var usagePercentage = (double)task.DeferralsUsed / task.MaxDeferrals;

            if (remainingDeferrals == 0)
            {
                task.UrgencyLevel = "critical";
                task.StatusLabel = "MUST complete today";
                task.FlexibilityIcon = "🚨";
                task.FlexibilityColor = "#dc3545";
            }
            else if (usagePercentage >= 0.66)
            {
                task.UrgencyLevel = "urgent";
                task.StatusLabel = remainingDeferrals == 1 ? "Can move 1 more time" : $"Can move {remainingDeferrals} more times";
                task.FlexibilityIcon = "🔥";
                task.FlexibilityColor = "#fd7e14";
            }
            else if (usagePercentage >= 0.33)
            {
                task.UrgencyLevel = "warning";
                task.StatusLabel = remainingDeferrals == 1 ? "Can move 1 more time" : $"Can move {remainingDeferrals} more times";
                task.FlexibilityIcon = "⚠️";
                task.FlexibilityColor = "#ffc107";
            }
            else
            {
                task.UrgencyLevel = "safe";
                task.StatusLabel = remainingDeferrals == 1 ? "Can move 1 more time" : $"Can move {remainingDeferrals} more times";
                task.FlexibilityIcon = "✅";
                task.FlexibilityColor = "#28a745";
            }
        }
    }
}
