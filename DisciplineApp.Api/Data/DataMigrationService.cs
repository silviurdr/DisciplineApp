using Microsoft.EntityFrameworkCore;
using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;

namespace DisciplineApp.Api.Services
{
    public interface IDataMigrationService
    {
        Task<bool> MigrateExistingDataAsync();
        Task<bool> SetupHabitsAsync();
        Task<bool> ConvertStreakDataToHabitsAsync();
    }

    public class DataMigrationService : IDataMigrationService
    {
        private readonly DisciplineDbContext _disciplineContext;
        private readonly ILogger<DataMigrationService> _logger;

        public DataMigrationService(DisciplineDbContext disciplineContext, ILogger<DataMigrationService> logger)
        {
            _disciplineContext = disciplineContext;
            _logger = logger;
        }

        public async Task<bool> MigrateExistingDataAsync()
        {
            try
            {
                _logger.LogInformation("Starting data migration process...");

                // Step 1: Setup base habits
                await SetupHabitsAsync();

                // Step 2: Convert existing streak data
                await ConvertStreakDataToHabitsAsync();

                _logger.LogInformation("Data migration completed successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during data migration");
                return false;
            }
        }

        public async Task<bool> SetupHabitsAsync()
        {
            try
            {
                // Check if habits already exist
                var existingHabitsCount = await _disciplineContext.Set<Habit>().CountAsync();
                if (existingHabitsCount > 0)
                {
                    _logger.LogInformation("Habits already exist, skipping setup");
                    return true;
                }

                var habits = new List<Habit>
                {
                    new Habit
                    {
                        Id = 1,
                        Name = "Phone Lock Box",
                        Description = "Lock iPhone in the lockbox daily",
                        Category = HabitCategory.Daily,
                        FrequencyType = FrequencyType.Daily,
                        RequiredCount = 1,
                        WindowDays = 1,
                        IsRequired = true,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Habit
                    {
                        Id = 2,
                        Name = "Clean Dishes",
                        Description = "Wash dishes and have clean sink",
                        Category = HabitCategory.Rolling,
                        FrequencyType = FrequencyType.EveryNDays,
                        RequiredCount = 1,
                        WindowDays = 2, // Every 2 days
                        IsRequired = true,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Habit
                    {
                        Id = 3,
                        Name = "Gym Workout",
                        Description = "Go to the gym for workout",
                        Category = HabitCategory.Weekly,
                        FrequencyType = FrequencyType.Weekly,
                        RequiredCount = 4, // 4 times per week
                        WindowDays = 7,
                        IsRequired = true,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Habit
                    {
                        Id = 4,
                        Name = "Vacuum/Sweep Floors",
                        Description = "Vacuum and sweep all floors",
                        Category = HabitCategory.Weekly,
                        FrequencyType = FrequencyType.Weekly,
                        RequiredCount = 2, // 2 times per week
                        WindowDays = 7,
                        IsRequired = true,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Habit
                    {
                        Id = 5,
                        Name = "Clean Bathroom",
                        Description = "Complete bathroom cleaning",
                        Category = HabitCategory.Weekly,
                        FrequencyType = FrequencyType.Weekly,
                        RequiredCount = 1, // Once per week
                        WindowDays = 7,
                        IsRequired = true,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Habit
                    {
                        Id = 6,
                        Name = "Kitchen Deep Clean",
                        Description = "Monthly general kitchen cleaning",
                        Category = HabitCategory.Monthly,
                        FrequencyType = FrequencyType.Monthly,
                        RequiredCount = 1, // Once per month
                        WindowDays = 30,
                        IsRequired = true,
                        CreatedAt = DateTime.UtcNow
                    },
                    new Habit
                    {
                        Id = 7,
                        Name = "Clean Windows",
                        Description = "Clean all windows (March-October only)",
                        Category = HabitCategory.Seasonal,
                        FrequencyType = FrequencyType.Seasonal,
                        RequiredCount = 3, // 3 times during season
                        WindowDays = 240, // March to October (~8 months)
                        SeasonalMonths = "3,4,5,6,7,8,9,10", // March to October
                        IsRequired = false, // Optional during off-season
                        CreatedAt = DateTime.UtcNow
                    }
                };

                _disciplineContext.Set<Habit>().AddRange(habits);
                await _disciplineContext.SaveChangesAsync();

                _logger.LogInformation("Successfully created {Count} habits", habits.Count);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting up habits");
                return false;
            }
        }

        public async Task<bool> ConvertStreakDataToHabitsAsync()
        {
            try
            {
                // Get existing discipline entries
                var existingEntries = await _disciplineContext.DisciplineEntries
                    .Where(e => e.IsCompleted)
                    .OrderBy(e => e.Date)
                    .ToListAsync();

                if (!existingEntries.Any())
                {
                    _logger.LogInformation("No existing streak data to convert");
                    return true;
                }

                // Get the phone lock habit (ID = 1)
                var phoneLockHabit = await _disciplineContext.Set<Habit>().FindAsync(1);
                if (phoneLockHabit == null)
                {
                    _logger.LogError("Phone lock habit not found");
                    return false;
                }

                // Convert each completed discipline entry to a phone lock habit completion
                var habitCompletions = new List<HabitCompletion>();

                foreach (var entry in existingEntries)
                {
                    // Check if habit completion already exists for this date
                    var existingCompletion = await _disciplineContext.Set<HabitCompletion>()
                        .FirstOrDefaultAsync(hc => hc.HabitId == 1 && hc.Date == entry.Date);

                    if (existingCompletion == null)
                    {
                        habitCompletions.Add(new HabitCompletion
                        {
                            HabitId = 1, // Phone lock habit
                            Date = entry.Date, // Use DateOnly directly
                            CompletedAt = entry.CompletedAt ?? DateTime.UtcNow,
                            Notes = $"Migrated from discipline entry: {entry.Notes}",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                if (habitCompletions.Any())
                {
                    _disciplineContext.Set<HabitCompletion>().AddRange(habitCompletions);
                    await _disciplineContext.SaveChangesAsync();

                    _logger.LogInformation("Successfully migrated {Count} discipline entries to habit completions",
                        habitCompletions.Count);
                }

                // Create some sample data for other habits to demonstrate the system
                await CreateSampleHabitDataAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error converting streak data to habits");
                return false;
            }
        }

        private async Task CreateSampleHabitDataAsync()
        {
            try
            {
                var today = DateHelper.GetToday();
                var sampleCompletions = new List<HabitCompletion>();

                // Add some sample completions for the past week to demonstrate the system
                for (int daysBack = 7; daysBack >= 1; daysBack--)
                {
                    var date = today.AddDays(-daysBack);

                    // Sample dish cleaning (every 2 days pattern)
                    if (daysBack % 2 == 0)
                    {
                        sampleCompletions.Add(new HabitCompletion
                        {
                            HabitId = 2, // Dishes
                            Date = date,
                            CompletedAt = DateTime.UtcNow.AddDays(-daysBack).AddHours(10),
                            Notes = "Sample dish cleaning",
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    // Sample gym sessions (scattered through week)
                    if (daysBack == 6 || daysBack == 4 || daysBack == 2)
                    {
                        sampleCompletions.Add(new HabitCompletion
                        {
                            HabitId = 3, // Gym
                            Date = date,
                            CompletedAt = DateTime.UtcNow.AddDays(-daysBack).AddHours(18),
                            Notes = "Sample gym session",
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    // Sample floor cleaning (twice per week)
                    if (daysBack == 5 || daysBack == 2)
                    {
                        sampleCompletions.Add(new HabitCompletion
                        {
                            HabitId = 4, // Vacuum/Sweep
                            Date = date,
                            CompletedAt = DateTime.UtcNow.AddDays(-daysBack).AddHours(16),
                            Notes = "Sample floor cleaning",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }

                // Bathroom cleaning (once per week)
                sampleCompletions.Add(new HabitCompletion
                {
                    HabitId = 5, // Bathroom
                    Date = today.AddDays(-3),
                    CompletedAt = DateTime.UtcNow.AddDays(-3).AddHours(14),
                    Notes = "Sample bathroom cleaning",
                    CreatedAt = DateTime.UtcNow
                });

                // Filter out any duplicates that might exist
                var filteredCompletions = new List<HabitCompletion>();
                foreach (var completion in sampleCompletions)
                {
                    var exists = await _disciplineContext.Set<HabitCompletion>()
                        .AnyAsync(hc => hc.HabitId == completion.HabitId && hc.Date == completion.Date);

                    if (!exists)
                    {
                        filteredCompletions.Add(completion);
                    }
                }

                if (filteredCompletions.Any())
                {
                    _disciplineContext.Set<HabitCompletion>().AddRange(filteredCompletions);
                    await _disciplineContext.SaveChangesAsync();

                    _logger.LogInformation("Created {Count} sample habit completions", filteredCompletions.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating sample habit data: {Message}", ex.Message);
            }
        }
    }
}