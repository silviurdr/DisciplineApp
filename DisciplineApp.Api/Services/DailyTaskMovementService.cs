public class DailyTaskMovementService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DailyTaskMovementService> _logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Run at 00:01 every day
                var now = DateTime.Now;
                var nextRun = now.Date.AddDays(1).AddMinutes(1);
                var delay = nextRun - now;

                await Task.Delay(delay, stoppingToken);

                using var scope = _serviceProvider.CreateScope();
                var taskMovementService = scope.ServiceProvider.GetRequiredService<TaskMovementService>();

                await taskMovementService.MoveOverdueTasksAsync();

                _logger.LogInformation("Daily task movement completed at {time}", DateTime.Now);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during daily task movement");
            }
        }
    }
}