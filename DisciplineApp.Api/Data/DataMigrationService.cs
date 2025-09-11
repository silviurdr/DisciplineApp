using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Services
{
    public interface IDataMigrationService
    {
        Task MigrateExistingDataAsync();
        Task SetupInitialHabitsAsync();
    }

    public class DataMigrationService : IDataMigrationService
    {
        private readonly DisciplineDbContext _context;
        private readonly ILogger<DataMigrationService> _logger;

        public DataMigrationService(DisciplineDbContext context, ILogger<DataMigrationService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task MigrateExistingDataAsync()
        {
            _logger.LogInformation("Starting data migration...");

            // Check if habits already exist
            var existingHabits = await _context.Habits.AnyAsync();
            if (!existingHabits)
            {
                await SetupInitialHabitsAsync();
            }

            // Migrate existing DisciplineEntry data to new habit system
            await MigrateStreakDataAsync();

            _logger.LogInformation("Data migration completed.");
        }

        public async Task SetupInitialHabitsAsync()
        {
            _logger.LogInformation("Setting up initial habits...");

            var habits = new List<Habit>
            {
                // Daily: Phone lock box
                new Habit
                {
                    Name = "Lock Phone in Box",
                    Frequency = HabitFrequency.Daily,
                    RequiredCount = 1,
                    WindowDays = 1,
                    IsActive = true
                },

                // Rolling: Clean dishes (every 2 days)
                new Habit
                {
                    Name = "Clean Dishes/Sink",
                    Frequency = HabitFrequency.Rolling,
                    RequiredCount = 1,
                    WindowDays = 2,
                    IsActive = true
                },

                // Weekly: Vacuum/Sweep (2x per week)
                new Habit
                {
                    Name = "Vacuum/Sweep Floors",
                    Frequency = HabitFrequency.Weekly,
                    RequiredCount = 2,
                    WindowDays = 7,
                    IsActive = true
                },

                // Weekly: Gym (4x per week)
                new Habit
                {
                    Name = "Gym Workout",
                    Frequency = HabitFrequency.Weekly,
                    RequiredCount = 4,
                    WindowDays = 7,
                    IsActive = true
                },

                // Weekly: Clean bathroom (1x per week)
                new Habit
                {
                    Name = "Clean Bathroom",
                    Frequency = HabitFrequency.Weekly,
                    RequiredCount = 1,
                    WindowDays = 7,
                    IsActive = true
                },

                // Monthly: Kitchen deep clean
                new Habit
                {
                    Name = "Kitchen Deep Clean",
                    Frequency = HabitFrequency.Monthly,
                    RequiredCount = 1,
                    WindowDays = 30,
                    IsActive = true
                },

                // Seasonal: Clean windows (3x March-October)
                new Habit
                {
                    Name = "Clean Windows",
                    Frequency = HabitFrequency.Seasonal,
                    RequiredCount = 3,
                    WindowDays = 240, // ~8 months
                    StartMonth = 3,   // March
                    EndMonth = 10,    // October
                    IsActive = true
                }
            };

            _context.Habits.AddRange(habits);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Created {habits.Count} initial habits.");
        }

        private async Task MigrateStreakDataAsync()
        {
            _logger.LogInformation("Migrating existing streak data...");

            // Get all existing completed discipline entries
            var existingEntries = await _context.DisciplineEntries
                .Where(e => e.IsCompleted)
                .OrderBy(e => e.Date)
                .ToListAsync();

            if (!existingEntries.Any())
            {
                _logger.LogInformation("No existing entries to migrate.");
                return;
            }

            // Get the phone lock habit (assuming it's the primary habit for existing streaks)
            var phoneLockHabit = await _context.Habits
                .FirstOrDefaultAsync(h => h.Name == "Lock Phone in Box");

            if (phoneLockHabit == null)
            {
                _logger.LogWarning("Phone lock habit not found, cannot migrate data.");
                return;
            }

            // Convert existing entries to habit completions
            var habitCompletions = new List<HabitCompletion>();

            foreach (var entry in existingEntries)
            {
                // Check if completion already exists
                var existingCompletion = await _context.HabitCompletions
                    .AnyAsync(c => c.HabitId == phoneLockHabit.Id && c.Date.Date == entry.Date.Date);

                if (!existingCompletion)
                {
                    habitCompletions.Add(new HabitCompletion
                    {
                        HabitId = phoneLockHabit.Id,
                        Date = entry.Date.Date,
                        IsCompleted = entry.IsCompleted,
                        Notes = entry.Notes ?? "Migrated from old system",
                        CreatedAt = entry.CreatedAt
                    });
                }
            }

            if (habitCompletions.Any())
            {
                _context.HabitCompletions.AddRange(habitCompletions);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Migrated {habitCompletions.Count} habit completions.");
            }

            // Create some sample data for other habits to demonstrate the system
            await CreateSampleHabitDataAsync();
        }

        private async Task CreateSampleHabitDataAsync()
        {
            _logger.LogInformation("Creating sample habit data for last week...");

            var startDate = DateTime.Today.AddDays(-7);
            var habits = await _context.Habits.ToListAsync();
            var sampleCompletions = new List<HabitCompletion>();

            foreach (var habit in habits)
            {
                switch (habit.Name)
                {
                    case "Clean Dishes/Sink":
                        // Every 2 days pattern
                        for (int i = 1; i < 7; i += 2)
                        {
                            sampleCompletions.Add(new HabitCompletion
                            {
                                HabitId = habit.Id,
                                Date = startDate.AddDays(i),
                                IsCompleted = true,
                                Notes = "Sample dish cleaning"
                            });
                        }
                        break;

                    case "Gym Workout":
                        // 4 times this week
                        for (int i = 0; i < 4; i++)
                        {
                            sampleCompletions.Add(new HabitCompletion
                            {
                                HabitId = habit.Id,
                                Date = startDate.AddDays(i * 2), // Every other day
                                IsCompleted = true,
                                Notes = "Sample gym session"
                            });
                        }
                        break;

                    case "Vacuum/Sweep Floors":
                        // 2 times this week
                        sampleCompletions.Add(new HabitCompletion
                        {
                            HabitId = habit.Id,
                            Date = startDate.AddDays(2),
                            IsCompleted = true,
                            Notes = "Sample vacuum"
                        });
                        sampleCompletions.Add(new HabitCompletion
                        {
                            HabitId = habit.Id,
                            Date = startDate.AddDays(5),
                            IsCompleted = true,
                            Notes = "Sample sweep"
                        });
                        break;

                    case "Clean Bathroom":
                        // Once this week
                        sampleCompletions.Add(new HabitCompletion
                        {
                            HabitId = habit.Id,
                            Date = startDate.AddDays(3),
                            IsCompleted = true,
                            Notes = "Sample bathroom cleaning"
                        });
                        break;

                    case "Kitchen Deep Clean":
                        // Monthly task - add one from last month
                        sampleCompletions.Add(new HabitCompletion
                        {
                            HabitId = habit.Id,
                            Date = DateTime.Today.AddDays(-15),
                            IsCompleted = true,
                            Notes = "Sample kitchen deep clean"
                        });
                        break;

                    case "Clean Windows":
                        // Seasonal task - add one from earlier this season
                        if (DateTime.Today.Month >= 3 && DateTime.Today.Month <= 10)
                        {
                            sampleCompletions.Add(new HabitCompletion
                            {
                                HabitId = habit.Id,
                                Date = DateTime.Today.AddDays(-30),
                                IsCompleted = true,
                                Notes = "Sample window cleaning"
                            });
                        }
                        break;
                }
            }

            // Remove duplicates and existing completions
            var uniqueCompletions = new List<HabitCompletion>();
            foreach (var completion in sampleCompletions)
            {
                var exists = await _context.HabitCompletions
                    .AnyAsync(c => c.HabitId == completion.HabitId && c.Date.Date == completion.Date.Date);

                if (!exists)
                {
                    uniqueCompletions.Add(completion);
                }
            }

            if (uniqueCompletions.Any())
            {
                _context.HabitCompletions.AddRange(uniqueCompletions);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Created {uniqueCompletions.Count} sample habit completions.");
            }
        }
    }
}