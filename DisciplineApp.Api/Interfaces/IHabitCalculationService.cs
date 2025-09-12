using DisciplineApp.Api.Services;

namespace DisciplineApp.Api.Services;

public interface IHabitCalculationService
{
    Task<DayStatusResponse> GetDayStatus(DateTime date);
}