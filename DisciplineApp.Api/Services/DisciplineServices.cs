using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Services
{
    public interface IDisciplineService
    {
        Task<YearCalendarDto> GetYearCalendarAsync(int year);
        Task<CalendarDayDto> ToggleDayAsync(DateTime date, string? notes = null);
        Task<CalendarDayDto> UpdateNotesAsync(DateTime date, string? notes);
        Task<StreakInfo> GetStreakInfoAsync();
    }

    public class DisciplineService : IDisciplineService
    {
        private readonly DisciplineDbContext _context;

        public DisciplineService(DisciplineDbContext context)
        {
            _context = context;
        }

        public async Task<YearCalendarDto> GetYearCalendarAsync(int year)
        {
            var startDate = new DateTime(year, 1, 1);
            var endDate = new DateTime(year, 12, 31);

            // Get all entries for the year
            var entries = await _context.DisciplineEntries
                .Include(e => e.Rewards)
                .Where(e => e.Date >= startDate && e.Date <= endDate)
                .ToListAsync();

            var yearCalendar = new YearCalendarDto
            {
                Year = year,
                Months = new List<MonthDataDto>(),
                StreakInfo = await GetStreakInfoAsync()
            };

            // Generate months
            for (int month = 1; month <= 12; month++)
            {
                var monthData = await GenerateMonthDataAsync(year, month, entries);
                yearCalendar.Months.Add(monthData);
            }

            return yearCalendar;
        }

        private async Task<MonthDataDto> GenerateMonthDataAsync(int year, int month, List<DisciplineEntry> entries)
        {
            var monthData = new MonthDataDto
            {
                Year = year,
                Month = month,
                MonthName = new DateTime(year, month, 1).ToString("MMMM").ToUpper(),
                Days = new List<CalendarDayDto>()
            };

            var daysInMonth = DateTime.DaysInMonth(year, month);
            var streakPeriods = await CalculateStreakPeriodsAsync();

            for (int day = 1; day <= daysInMonth; day++)
            {
                var date = new DateTime(year, month, day);
                var entry = entries.FirstOrDefault(e => e.Date.Date == date.Date);

                var dayDto = new CalendarDayDto
                {
                    Date = date,
                    IsCompleted = entry?.IsCompleted ?? false,
                    Notes = entry?.Notes
                };

                // Calculate streak information
                var streakInfo = GetStreakInfoForDate(date, streakPeriods);
                dayDto.IsInStreak = streakInfo != null;
                dayDto.DayInStreak = streakInfo?.DayInStreak ?? 0;
                dayDto.StreakColor = streakInfo?.Color ?? StreakColor.None;

                // Add rewards
                if (entry?.Rewards != null)
                {
                    dayDto.Rewards = entry.Rewards.Select(r => r.Type).ToList();
                }

                // Special days
                if (date == new DateTime(2025, 1, 23))
                {
                    dayDto.IsSpecialDay = true;
                    dayDto.SpecialDayType = "streak-break";
                }
                else if (date == new DateTime(2025, 3, 23))
                {
                    dayDto.IsSpecialDay = true;
                    dayDto.SpecialDayType = "book-cover";
                }

                monthData.Days.Add(dayDto);
            }

            return monthData;
        }

        private async Task<List<StreakPeriod>> CalculateStreakPeriodsAsync()
        {
            var completedEntries = await _context.DisciplineEntries
                .Where(e => e.IsCompleted)
                .OrderBy(e => e.Date)
                .ToListAsync();

            var streakPeriods = new List<StreakPeriod>();
            if (!completedEntries.Any()) return streakPeriods;

            var currentStart = completedEntries[0].Date;
            var currentEnd = completedEntries[0].Date;

            for (int i = 1; i < completedEntries.Count; i++)
            {
                var currentDate = completedEntries[i].Date;
                var previousDate = completedEntries[i - 1].Date;

                if (currentDate == previousDate.AddDays(1))
                {
                    // Continue current streak
                    currentEnd = currentDate;
                }
                else
                {
                    // End current streak and start a new one
                    var streakLength = (currentEnd - currentStart).Days + 1;
                    streakPeriods.Add(new StreakPeriod
                    {
                        StartDate = currentStart,
                        EndDate = currentEnd,
                        Length = streakLength,
                        Color = GetStreakColor(streakLength)
                    });

                    currentStart = currentDate;
                    currentEnd = currentDate;
                }
            }

            // Add the last streak
            var lastStreakLength = (currentEnd - currentStart).Days + 1;
            streakPeriods.Add(new StreakPeriod
            {
                StartDate = currentStart,
                EndDate = currentEnd,
                Length = lastStreakLength,
                Color = GetStreakColor(lastStreakLength)
            });

            return streakPeriods;
        }

        private StreakColor GetStreakColor(int dayInStreak)
        {
            if (dayInStreak >= 1 && dayInStreak <= 7) return StreakColor.Salmon;
            if (dayInStreak >= 8 && dayInStreak <= 30) return StreakColor.Orange;
            if (dayInStreak >= 31 && dayInStreak <= 90) return StreakColor.Yellow;
            return StreakColor.White;
        }

        private (int DayInStreak, StreakColor Color)? GetStreakInfoForDate(DateTime date, List<StreakPeriod> streakPeriods)
        {
            foreach (var period in streakPeriods)
            {
                if (date >= period.StartDate && date <= period.EndDate)
                {
                    var dayInStreak = (date - period.StartDate).Days + 1;
                    return (dayInStreak, GetStreakColor(dayInStreak));
                }
            }
            return null;
        }

        public async Task<CalendarDayDto> ToggleDayAsync(DateTime date, string? notes = null)
        {
            var entry = await _context.DisciplineEntries
                .Include(e => e.Rewards)
                .FirstOrDefaultAsync(e => e.Date.Date == date.Date);

            if (entry == null)
            {
                // Create new entry
                entry = new DisciplineEntry
                {
                    Date = date.Date,
                    IsCompleted = true,
                    Notes = notes,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.DisciplineEntries.Add(entry);
            }
            else
            {
                // Toggle existing entry
                entry.IsCompleted = !entry.IsCompleted;
                entry.Notes = notes ?? entry.Notes;
                entry.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            // Calculate and add rewards if needed
            if (entry.IsCompleted)
            {
                await UpdateRewardsAsync(entry);
            }
            else
            {
                // Remove rewards if day is unmarked
                _context.Rewards.RemoveRange(entry.Rewards);
                await _context.SaveChangesAsync();
            }

            // Return updated day info
            var streakPeriods = await CalculateStreakPeriodsAsync();
            var streakInfo = GetStreakInfoForDate(date, streakPeriods);

            return new CalendarDayDto
            {
                Date = date,
                IsCompleted = entry.IsCompleted,
                IsInStreak = streakInfo != null,
                DayInStreak = streakInfo?.DayInStreak ?? 0,
                StreakColor = streakInfo?.Color ?? StreakColor.None,
                Rewards = entry.Rewards?.Select(r => r.Type).ToList() ?? new List<RewardType>(),
                Notes = entry.Notes
            };
        }

        private async Task UpdateRewardsAsync(DisciplineEntry entry)
        {
            var streakPeriods = await CalculateStreakPeriodsAsync();
            var streakInfo = GetStreakInfoForDate(entry.Date, streakPeriods);

            if (streakInfo == null) return;

            var dayInStreak = streakInfo.Value.DayInStreak;
            var rewardsToAdd = new List<RewardType>();

            if (dayInStreak == 7) rewardsToAdd.Add(RewardType.Coffee);
            if (dayInStreak == 14) rewardsToAdd.Add(RewardType.Book);
            if (dayInStreak == 30) rewardsToAdd.Add(RewardType.Clothing);
            if (dayInStreak == 90) rewardsToAdd.Add(RewardType.Tennis);

            foreach (var rewardType in rewardsToAdd)
            {
                if (!entry.Rewards.Any(r => r.Type == rewardType))
                {
                    entry.Rewards.Add(new Reward
                    {
                        Type = rewardType,
                        DisciplineEntryId = entry.Id,
                        EarnedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();
        }

        public async Task<CalendarDayDto> UpdateNotesAsync(DateTime date, string? notes)
        {
            var entry = await _context.DisciplineEntries
                .Include(e => e.Rewards)
                .FirstOrDefaultAsync(e => e.Date.Date == date.Date);

            if (entry == null)
            {
                entry = new DisciplineEntry
                {
                    Date = date.Date,
                    IsCompleted = false,
                    Notes = notes,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.DisciplineEntries.Add(entry);
            }
            else
            {
                entry.Notes = notes;
                entry.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            var streakPeriods = await CalculateStreakPeriodsAsync();
            var streakInfo = GetStreakInfoForDate(date, streakPeriods);

            return new CalendarDayDto
            {
                Date = date,
                IsCompleted = entry.IsCompleted,
                IsInStreak = streakInfo != null,
                DayInStreak = streakInfo?.DayInStreak ?? 0,
                StreakColor = streakInfo?.Color ?? StreakColor.None,
                Rewards = entry.Rewards?.Select(r => r.Type).ToList() ?? new List<RewardType>(),
                Notes = entry.Notes
            };
        }

        public async Task<StreakInfo> GetStreakInfoAsync()
        {
            var streakPeriods = await CalculateStreakPeriodsAsync();
            var completedEntries = await _context.DisciplineEntries
                .Where(e => e.IsCompleted)
                .OrderByDescending(e => e.Date)
                .ToListAsync();

            var streakInfo = new StreakInfo
            {
                TotalDays = completedEntries.Count,
                LastCompletedDate = completedEntries.FirstOrDefault()?.Date,
                StreakPeriods = streakPeriods
            };

            // Calculate current streak
            var today = DateTime.Today;
            var currentStreak = 0;

            for (var date = today; date >= new DateTime(2025, 1, 1); date = date.AddDays(-1))
            {
                if (completedEntries.Any(e => e.Date.Date == date.Date))
                    currentStreak++;
                else
                    break;
            }

            streakInfo.CurrentStreak = currentStreak;
            streakInfo.LongestStreak = streakPeriods.Any() ? streakPeriods.Max(s => s.Length) : 0;

            return streakInfo;
        }
    }
}