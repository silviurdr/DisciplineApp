using DisciplineApp.Api.Models;

public interface IDailyStatsService
{
    Task<DailyStats> CalculateAndStoreDailyStatsAsync(DateTime date);
    Task<DailyStats?> GetStoredDailyStatsAsync(DateTime date);
    Task<List<DailyStats>> GetMonthlyStatsAsync(int year, int month);
    Task<bool> AreStatsStoredForDate(DateTime date);
    Task RecalculateStatsForPeriodAsync(DateTime startDate, DateTime endDate);
    Task<int> GetCurrentStreakLengthAsync(DateTime asOfDate);
}