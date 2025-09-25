using DisciplineApp.Api.Services;

public class FirstDailyRunMiddleware
{
    private readonly RequestDelegate _next;
    private static DateTime _lastRunDate = DateTime.MinValue;
    private static bool _isRunning = false;

    public FirstDailyRunMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var today = DateTime.Today;

        // ⚡ FIRE-AND-FORGET: Don't wait for task movement
        if (_lastRunDate < today && !_isRunning)
        {
            _isRunning = true;
            _lastRunDate = today;

            // 🚀 Run in background - doesn't block the request
            _ = Task.Run(async () =>
            {
                try
                {
                    var scope = context.RequestServices.CreateScope();
                    var taskMovementService = scope.ServiceProvider.GetRequiredService<TaskMovementService>();
                    var logger = scope.ServiceProvider.GetRequiredService<ILogger<FirstDailyRunMiddleware>>();

                    logger.LogInformation("🌅 First request of day - moving tasks in background");
                    await taskMovementService.MoveOverdueTasksAsync();
                    logger.LogInformation("✅ Background task movement completed");
                }
                catch (Exception ex)
                {
                    // Log error but don't crash
                    var logger = context.RequestServices.GetRequiredService<ILogger<FirstDailyRunMiddleware>>();
                    logger.LogError(ex, "❌ Error in background task movement");
                }
                finally
                {
                    _isRunning = false;
                }
            });
        }

        // ⚡ Continue processing request immediately
        await _next(context);
    }
}