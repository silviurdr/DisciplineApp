using Microsoft.EntityFrameworkCore;
using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;

namespace DisciplineApp.Api.Services
{
    public interface IDisciplineService
    {
        Task<YearCalendarDto> GetYearCalendarAsync(int year);
        Task<CalendarDayDto> ToggleDayAsync(string dateString);
        Task<CalendarDayDto> UpdateDayAsync(string dateString, bool isCompleted, string? notes = null);
        Task<StreakInfoDto> GetStreakInfoAsync();
        Task<CalendarDayDto?> GetDayAsync(string dateString);
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
            var startDate = new DateOnly(year, 1, 1);
            var endDate = new DateOnly(year, 12, 31);

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

        public async Task<CalendarDayDto> ToggleDayAsync(string dateString)
        {
            var date = DateHelper.ParseDateString(dateString);

            var entry = await _context.DisciplineEntries
                .Include(e => e.Rewards)
                .FirstOrDefaultAsync(e => e.Date == date);

            if (entry == null)
            {
                // Create new entry as completed
                entry = new DisciplineEntry
                {
                    Date = date,
                    IsCompleted = true,
                    CompletedAt = DateTime.UtcNow
                };
                _context.DisciplineEntries.Add(entry);
            }
            else
            {
                // Toggle existing entry
                entry.IsCompleted = !entry.IsCompleted;
                entry.CompletedAt = entry.IsCompleted ? DateTime.UtcNow : null;
            }

            // Check for rewards after toggling
            if (entry.IsCompleted)
            {
                await CheckAndAddRewardsAsync(entry);
            }

            await _context.SaveChangesAsync();

            // Return updated day with proper streak info
            return await ConvertToCalendarDayDtoAsync(entry);
        }

        public async Task<CalendarDayDto> UpdateDayAsync(string dateString, bool isCompleted, string? notes = null)
        {
            var date = DateHelper.ParseDateString(dateString);

            var entry = await _context.DisciplineEntries
                .Include(e => e.Rewards)
                .FirstOrDefaultAsync(e => e.Date == date);

            if (entry == null)
            {
                entry = new DisciplineEntry
                {
                    Date = date,
                    IsCompleted = isCompleted,
                    Notes = notes,
                    CompletedAt = isCompleted ? DateTime.UtcNow : null
                };
                _context.DisciplineEntries.Add(entry);
            }
            else
            {
                entry.IsCompleted = isCompleted;
                entry.Notes = notes;
                entry.CompletedAt = isCompleted ? DateTime.UtcNow : null;
            }

            // Check for rewards if completed
            if (entry.IsCompleted)
            {
                await CheckAndAddRewardsAsync(entry);
            }

            await _context.SaveChangesAsync();

            return await ConvertToCalendarDayDtoAsync(entry);
        }

        public async Task<StreakInfoDto> GetStreakInfoAsync()
        {
            var allEntries = await _context.DisciplineEntries
                .OrderBy(e => e.Date)
                .ToListAsync();

            var currentStreak = CalculateCurrentStreak(allEntries);
            var longestStreak = CalculateLongestStreak(allEntries);
            var totalDays = allEntries.Count(e => e.IsCompleted);

            var rewards = await _context.Rewards.ToListAsync();
            var weeklyRewards = rewards.Count(r => r.Type == "Weekly");
            var monthlyRewards = rewards.Count(r => r.Type == "Monthly");

            var nextMilestone = CalculateNextMilestone(currentStreak);

            return new StreakInfoDto
            {
                CurrentStreak = currentStreak,
                LongestStreak = longestStreak,
                TotalDays = totalDays,
                WeeklyRewards = weeklyRewards,
                MonthlyRewards = monthlyRewards,
                NextMilestone = nextMilestone,
                LastUpdate = DateTime.UtcNow
            };
        }

        public async Task<CalendarDayDto?> GetDayAsync(string dateString)
        {
            var date = DateHelper.ParseDateString(dateString);

            var entry = await _context.DisciplineEntries
                .Include(e => e.Rewards)
                .FirstOrDefaultAsync(e => e.Date == date);

            if (entry == null)
            {
                // Return empty day
                return new CalendarDayDto
                {
                    Date = DateHelper.ToDateString(date),
                    DayOfMonth = date.Day,
                    IsCompleted = false,
                    IsSpecial = false,
                    DayInStreak = 0,
                    Color = StreakColor.None,
                    Rewards = new List<RewardDto>()
                };
            }

            return await ConvertToCalendarDayDtoAsync(entry);
        }

        private async Task<MonthDataDto> GenerateMonthDataAsync(int year, int month, List<DisciplineEntry> entries)
        {
            var monthNames = new[]
            {
                "", "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            };

            var daysInMonth = DateTime.DaysInMonth(year, month);
            var monthData = new MonthDataDto
            {
                Month = month,
                Year = year,
                MonthName = monthNames[month],
                Days = new List<CalendarDayDto>()
            };

            for (int day = 1; day <= daysInMonth; day++)
            {
                var date = new DateOnly(year, month, day);
                var entry = entries.FirstOrDefault(e => e.Date == date);

                CalendarDayDto dayDto;
                if (entry != null)
                {
                    dayDto = await ConvertToCalendarDayDtoAsync(entry);
                }
                else
                {
                    // Create empty day
                    dayDto = new CalendarDayDto
                    {
                        Date = DateHelper.ToDateString(date),
                        DayOfMonth = day,
                        IsCompleted = false,
                        IsSpecial = false,
                        DayInStreak = 0,
                        Color = StreakColor.None,
                        Rewards = new List<RewardDto>()
                    };
                }

                monthData.Days.Add(dayDto);
            }

            return monthData;
        }

        private async Task<CalendarDayDto> ConvertToCalendarDayDtoAsync(DisciplineEntry entry)
        {
            var streakInfo = GetStreakInfoForDate(entry.Date);

            return new CalendarDayDto
            {
                Date = DateHelper.ToDateString(entry.Date),
                DayOfMonth = entry.Date.Day,
                IsCompleted = entry.IsCompleted,
                IsSpecial = entry.IsSpecial,
                DayInStreak = streakInfo?.DayInStreak ?? 0,
                Color = streakInfo?.Color ?? StreakColor.None,
                Rewards = entry.Rewards.Select(r => new RewardDto
                {
                    Id = r.Id,
                    Type = r.Type,
                    Description = r.Description,
                    EarnedAt = r.EarnedAt
                }).ToList()
            };
        }

        private (int DayInStreak, StreakColor Color)? GetStreakInfoForDate(DateOnly date)
        {
            // Get all completed entries up to and including this date
            var entries = _context.DisciplineEntries
                .Where(e => e.Date <= date && e.IsCompleted)
                .OrderByDescending(e => e.Date)
                .ToList();

            if (!entries.Any() || !entries.Any(e => e.Date == date))
            {
                return null; // This date is not completed
            }

            // Calculate streak from this date backwards
            int dayInStreak = 1;
            var currentDate = date.AddDays(-1);

            while (entries.Any(e => e.Date == currentDate))
            {
                dayInStreak++;
                currentDate = currentDate.AddDays(-1);
            }

            // Determine color based on streak length
            var color = dayInStreak switch
            {
                1 => StreakColor.Blue,
                >= 2 and <= 6 => StreakColor.Blue,
                >= 7 and <= 29 => StreakColor.Green,
                >= 30 and <= 89 => StreakColor.Orange,
                >= 90 => StreakColor.Red,
                _ => StreakColor.None
            };

            return (dayInStreak, color);
        }

        private int CalculateCurrentStreak(List<DisciplineEntry> allEntries)
        {
            if (!allEntries.Any()) return 0;

            var today = DateHelper.GetToday();
            var streak = 0;
            var currentDate = today;

            // Count backwards from today
            while (true)
            {
                var entry = allEntries.FirstOrDefault(e => e.Date == currentDate && e.IsCompleted);
                if (entry == null) break;

                streak++;
                currentDate = currentDate.AddDays(-1);
            }

            return streak;
        }

        private int CalculateLongestStreak(List<DisciplineEntry> allEntries)
        {
            if (!allEntries.Any()) return 0;

            var completedEntries = allEntries
                .Where(e => e.IsCompleted)
                .OrderBy(e => e.Date)
                .ToList();

            if (!completedEntries.Any()) return 0;

            int longestStreak = 1;
            int currentStreak = 1;

            for (int i = 1; i < completedEntries.Count; i++)
            {
                var previousDate = completedEntries[i - 1].Date;
                var currentDate = completedEntries[i].Date;

                // Check if dates are consecutive
                if (currentDate == previousDate.AddDays(1))
                {
                    currentStreak++;
                    longestStreak = Math.Max(longestStreak, currentStreak);
                }
                else
                {
                    currentStreak = 1;
                }
            }

            return longestStreak;
        }

        private int? CalculateNextMilestone(int currentStreak)
        {
            var milestones = new[] { 7, 14, 30, 60, 90, 180, 365 };
            return milestones.FirstOrDefault(m => m > currentStreak);
        }

        private async Task CheckAndAddRewardsAsync(DisciplineEntry entry)
        {
            var currentStreak = CalculateCurrentStreak(await _context.DisciplineEntries.ToListAsync());

            // Weekly rewards (every 7 days)
            if (currentStreak % 7 == 0 && currentStreak > 0)
            {
                var weeklyReward = new Reward
                {
                    DisciplineEntryId = entry.Id,
                    Type = "Weekly",
                    Description = $"{currentStreak}-day streak reward!",
                    EarnedAt = DateTime.UtcNow
                };

                _context.Rewards.Add(weeklyReward);
                entry.IsSpecial = true;
            }

            // Monthly rewards (every 30 days)
            if (currentStreak % 30 == 0 && currentStreak > 0)
            {
                var monthlyReward = new Reward
                {
                    DisciplineEntryId = entry.Id,
                    Type = "Monthly",
                    Description = $"{currentStreak}-day milestone achieved!",
                    EarnedAt = DateTime.UtcNow
                };

                _context.Rewards.Add(monthlyReward);
                entry.IsSpecial = true;
            }
        }
    }
}