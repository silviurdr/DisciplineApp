using DisciplineApp.Api.Services;

namespace DisciplineApp.Api.Services
{
    public class DailyTaskMovementService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DailyTaskMovementService> _logger;

        public DailyTaskMovementService(IServiceProvider serviceProvider, ILogger<DailyTaskMovementService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Daily Task Movement Service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Calculate delay until next 00:01 AM
                    var now = DateTime.Now;
                    var nextRun = now.Date.AddDays(1).AddMinutes(1); // Tomorrow at 00:01
                    var delay = nextRun - now;

                    _logger.LogInformation($"Next task movement scheduled for: {nextRun}, waiting {delay.TotalHours:F1} hours");

                    // Wait until it's time to run
                    await Task.Delay(delay, stoppingToken);

                    // Execute the task movement
                    using var scope = _serviceProvider.CreateScope();
                    var taskMovementService = scope.ServiceProvider.GetRequiredService<TaskMovementService>();

                    _logger.LogInformation("Executing daily task movement...");
                    await taskMovementService.MoveOverdueTasksAsync();

                    _logger.LogInformation("Daily task movement completed successfully at {time}", DateTime.Now);
                }
                catch (OperationCanceledException)
                {
                    _logger.LogInformation("Daily task movement service is stopping");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during daily task movement");
                    // Wait 1 hour before retrying if there's an error
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
            }
        }
    }
}