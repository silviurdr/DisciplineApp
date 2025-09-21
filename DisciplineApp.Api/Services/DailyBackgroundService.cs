public class DailyStatsBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DailyStatsBackgroundService> _logger;

    public DailyStatsBackgroundService(IServiceProvider serviceProvider, ILogger<DailyStatsBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Calculate at midnight every day
                var now = DateTime.Now;
                var nextMidnight = DateTime.Today.AddDays(1);
                var delay = nextMidnight - now;

                _logger.LogInformation($"⏰ Scheduled daily stats calculation in {delay.TotalHours:F1} hours");

                await Task.Delay(delay, stoppingToken);

                // Calculate yesterday's stats (today becomes yesterday)
                var yesterday = DateTime.Today.AddDays(-1);

                using (var scope = _serviceProvider.CreateScope())
                {
                    var dailyStatsService = scope.ServiceProvider.GetRequiredService<IDailyStatsService>();

                    if (!await dailyStatsService.AreStatsStoredForDate(yesterday))
                    {
                        await dailyStatsService.CalculateAndStoreDailyStatsAsync(yesterday);
                        _logger.LogInformation($"📊 Auto-calculated daily stats for {yesterday:yyyy-MM-dd}");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error in daily stats background service");
                // Wait 1 hour before retrying
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }
    }
}

// =====================================================
// 5. REQUEST MODELS
// =====================================================

public class CalculateStatsRequest
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool ForceRecalculate { get; set; } = false;
}

public class CompleteAdHocTaskRequest
{
    public int TaskId { get; set; }
    public bool IsCompleted { get; set; }
    public string? Notes { get; set; }
}