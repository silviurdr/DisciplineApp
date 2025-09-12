using Microsoft.EntityFrameworkCore;
using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;

namespace DisciplineApp.Api.Data
{
    public static class HabitSeedData
    {
        /// <summary>
        /// Seeds the database with your specific habits configuration
        /// Can be called multiple times safely - won't create duplicates
        /// </summary>
        public static async Task SeedHabitsAsync(DisciplineDbContext context)
        {
            try
            {
                // Check if habits already exist
                if (await context.Set<Habit>().AnyAsync())
                {
                    Console.WriteLine("Habits already exist, skipping seed data");
                    return;
                }

                var habits = CreateHabitsData();

                await context.Set<Habit>().AddRangeAsync(habits);
                await context.SaveChangesAsync();

                Console.WriteLine($"Successfully seeded {habits.Count} habits");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error seeding habits: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Creates sample habit completions for testing the system
        /// </summary>
        public static async Task SeedSampleCompletionsAsync(DisciplineDbContext context)
        {
            try
            {
                // Check if sample completions already exist
                if (await context.Set<HabitCompletion>().AnyAsync())
                {
                    Console.WriteLine("Habit completions already exist, skipping sample data");
                    return;
                }

                var sampleCompletions = CreateSampleCompletionsData();

                await context.Set<HabitCompletion>().AddRangeAsync(sampleCompletions);
                await context.SaveChangesAsync();

                Console.WriteLine($"Successfully seeded {sampleCompletions.Count} sample habit completions");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error seeding sample completions: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Complete seed process - habits and sample data
        /// </summary>
        public static async Task SeedAllAsync(DisciplineDbContext context)
        {
            await SeedHabitsAsync(context);
            await SeedSampleCompletionsAsync(context);
        }

        private static List<Habit> CreateHabitsData()
        {
            return new List<Habit>
            {
                // 1. Phone Lock Box - Daily habit (most important)
                new Habit
                {
                    Id = 1,
                    Name = "Phone Lock Box",
                    Description = "Lock iPhone in the lockbox every day starting 6 PM",
                    Category = HabitCategory.Daily,
                    FrequencyType = FrequencyType.Daily,
                    RequiredCount = 1,
                    WindowDays = 1,
                    IsRequired = true,
                    CreatedAt = DateTime.UtcNow
                },

                // 2. Clean Dishes - Rolling 2-day habit
                new Habit
                {
                    Id = 2,
                    Name = "Clean Dishes",
                    Description = "Wash dishes and maintain clean sink (no dishes allowed for more than 1 day)",
                    Category = HabitCategory.Rolling,
                    FrequencyType = FrequencyType.EveryNDays,
                    RequiredCount = 1,
                    WindowDays = 2, // Must be done at least every 2 days
                    IsRequired = true,
                    CreatedAt = DateTime.UtcNow
                },

                // 3. Gym Workout - Weekly habit (4 times per week)
                new Habit
                {
                    Id = 3,
                    Name = "Gym Workout",
                    Description = "Go to the gym for workout session",
                    Category = HabitCategory.Weekly,
                    FrequencyType = FrequencyType.Weekly,
                    RequiredCount = 4, // 4 times per week
                    WindowDays = 7,
                    IsRequired = true,
                    CreatedAt = DateTime.UtcNow
                },

                // 4. Vacuum/Sweep Floors - Weekly habit (2 times per week)
                new Habit
                {
                    Id = 4,
                    Name = "Vacuum & Sweep Floors",
                    Description = "Vacuum and sweep all floors in the house",
                    Category = HabitCategory.Weekly,
                    FrequencyType = FrequencyType.Weekly,
                    RequiredCount = 2, // 2 times per week
                    WindowDays = 7,
                    IsRequired = true,
                    CreatedAt = DateTime.UtcNow
                },

                // 5. Clean Bathroom - Weekly habit (once per week)
                new Habit
                {
                    Id = 5,
                    Name = "Clean Bathroom",
                    Description = "Complete bathroom cleaning including toilet, shower, sink, and floor",
                    Category = HabitCategory.Weekly,
                    FrequencyType = FrequencyType.Weekly,
                    RequiredCount = 1, // Once per week
                    WindowDays = 7,
                    IsRequired = true,
                    CreatedAt = DateTime.UtcNow
                },

                // 6. Kitchen Deep Clean - Monthly habit
                new Habit
                {
                    Id = 6,
                    Name = "Kitchen Deep Clean",
                    Description = "Monthly general kitchen deep cleaning - counters, appliances, cabinets",
                    Category = HabitCategory.Monthly,
                    FrequencyType = FrequencyType.Monthly,
                    RequiredCount = 1, // Once per month
                    WindowDays = 30,
                    IsRequired = true,
                    CreatedAt = DateTime.UtcNow
                },

                // 7. Clean Windows - Seasonal habit (3 times March-October)
                new Habit
                {
                    Id = 7,
                    Name = "Clean Windows",
                    Description = "Clean all windows in the house (active during warm months March-October)",
                    Category = HabitCategory.Seasonal,
                    FrequencyType = FrequencyType.Seasonal,
                    RequiredCount = 3, // 3 times during the season
                    WindowDays = 240, // March to October (~8 months)
                    SeasonalMonths = "3,4,5,6,7,8,9,10", // March to October
                    IsRequired = false, // Not required during off-season
                    CreatedAt = DateTime.UtcNow
                }
            };
        }

        private static List<HabitCompletion> CreateSampleCompletionsData()
        {
            var today = DateOnly.FromDateTime(DateTime.Today);
            var completions = new List<HabitCompletion>();

            // Create sample data for the past 14 days to demonstrate the system
            for (int daysBack = 14; daysBack >= 1; daysBack--)
            {
                var date = today.AddDays(-daysBack);
                var completionTime = DateTime.Now.AddDays(-daysBack);

                // Phone Lock Box - Daily (90% completion rate)
                if (Random.Shared.Next(1, 11) <= 9) // 90% chance
                {
                    completions.Add(new HabitCompletion
                    {
                        HabitId = 1,
                        Date = date,
                        CompletedAt = completionTime.AddHours(18), // 6 PM
                        Notes = $"Phone locked at 6 PM on {date:yyyy-MM-dd}",
                        CreatedAt = completionTime.AddHours(18)
                    });
                }

                // Clean Dishes - Every 2 days pattern (realistic pattern)
                if (daysBack % 2 == 0 || Random.Shared.Next(1, 5) == 1) // Every 2 days + some random
                {
                    completions.Add(new HabitCompletion
                    {
                        HabitId = 2,
                        Date = date,
                        CompletedAt = completionTime.AddHours(19), // 7 PM
                        Notes = $"Kitchen sink clean and all dishes washed",
                        CreatedAt = completionTime.AddHours(19)
                    });
                }

                // Gym - Target 4 times per week (realistic schedule: Mon, Tue, Thu, Sat)
                var dayOfWeek = date.DayOfWeek;
                if (dayOfWeek == DayOfWeek.Monday || dayOfWeek == DayOfWeek.Tuesday ||
                    dayOfWeek == DayOfWeek.Thursday || dayOfWeek == DayOfWeek.Saturday)
                {
                    if (Random.Shared.Next(1, 5) <= 3) // 75% chance on gym days
                    {
                        completions.Add(new HabitCompletion
                        {
                            HabitId = 3,
                            Date = date,
                            CompletedAt = completionTime.AddHours(17), // 5 PM
                            Notes = $"Completed workout session - {GetRandomWorkoutType()}",
                            CreatedAt = completionTime.AddHours(17)
                        });
                    }
                }

                // Vacuum/Sweep - Target 2 times per week (Wed, Sun)
                if (dayOfWeek == DayOfWeek.Wednesday || dayOfWeek == DayOfWeek.Sunday)
                {
                    if (Random.Shared.Next(1, 4) <= 2) // 67% chance
                    {
                        completions.Add(new HabitCompletion
                        {
                            HabitId = 4,
                            Date = date,
                            CompletedAt = completionTime.AddHours(14), // 2 PM
                            Notes = "Vacuumed all rooms and swept kitchen/bathroom floors",
                            CreatedAt = completionTime.AddHours(14)
                        });
                    }
                }

                // Bathroom Cleaning - Once per week (Saturdays)
                if (dayOfWeek == DayOfWeek.Saturday)
                {
                    if (Random.Shared.Next(1, 3) <= 1) // 50% chance (some weeks missed)
                    {
                        completions.Add(new HabitCompletion
                        {
                            HabitId = 5,
                            Date = date,
                            CompletedAt = completionTime.AddHours(11), // 11 AM
                            Notes = "Deep cleaned bathroom - toilet, shower, sink, mirrors, floor",
                            CreatedAt = completionTime.AddHours(11)
                        });
                    }
                }
            }

            // Add a monthly kitchen clean from 10 days ago
            if (completions.Any())
            {
                completions.Add(new HabitCompletion
                {
                    HabitId = 6,
                    Date = today.AddDays(-10),
                    CompletedAt = DateTime.Now.AddDays(-10).AddHours(10), // 10 AM
                    Notes = "Monthly deep kitchen clean - all surfaces, appliances, inside/outside cabinets",
                    CreatedAt = DateTime.Now.AddDays(-10).AddHours(10)
                });
            }

            // Add seasonal window cleaning (if in season)
            var currentMonth = today.Month;
            if (currentMonth >= 3 && currentMonth <= 10) // March to October
            {
                // Add one from 20 days ago if we have enough history
                if (today.AddDays(-20).Month >= 3)
                {
                    completions.Add(new HabitCompletion
                    {
                        HabitId = 7,
                        Date = today.AddDays(-20),
                        CompletedAt = DateTime.Now.AddDays(-20).AddHours(9), // 9 AM
                        Notes = "Cleaned all windows inside and outside - spring cleaning session",
                        CreatedAt = DateTime.Now.AddDays(-20).AddHours(9)
                    });
                }
            }

            return completions;
        }

        private static string GetRandomWorkoutType()
        {
            var workouts = new[]
            {
                "Upper body strength training",
                "Lower body and legs",
                "Full body circuit training",
                "Cardio and core workout",
                "Push/pull split",
                "Functional fitness",
                "HIIT session"
            };

            return workouts[Random.Shared.Next(workouts.Length)];
        }

        /// <summary>
        /// Seeds habits if they don't exist (safe to call on startup)
        /// </summary>
        public static async Task EnsureHabitsSeededAsync(DisciplineDbContext context)
        {
            try
            {
                var habitsExist = await context.Set<Habit>().AnyAsync();
                if (!habitsExist)
                {
                    await SeedHabitsAsync(context);
                }

                // Optionally seed sample completions for new databases
                var completionsExist = await context.Set<HabitCompletion>().AnyAsync();
                if (!completionsExist)
                {
                    Console.WriteLine("No habit completions found. Seeding sample data for demonstration...");
                    await SeedSampleCompletionsAsync(context);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error ensuring habits seeded: {ex.Message}");
                // Don't throw - let the app continue even if seeding fails
            }
        }
    }
}