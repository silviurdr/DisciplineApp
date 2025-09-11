using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Data
{
    public static class HabitSeedData
    {
        public static void SeedHabits(ModelBuilder modelBuilder)
        {
            var habits = new List<Habit>
            {
                // Daily: Phone lock box
                new Habit
                {
                    Id = 1,
                    Name = "Lock Phone in Box",
                    Frequency = HabitFrequency.Daily,
                    RequiredCount = 1,
                    WindowDays = 1,
                    IsActive = true
                },

                // Rolling: Clean dishes (every 2 days)
                new Habit
                {
                    Id = 2,
                    Name = "Clean Dishes/Sink",
                    Frequency = HabitFrequency.Rolling,
                    RequiredCount = 1,
                    WindowDays = 2,
                    IsActive = true
                },

                // Weekly: Vacuum/Sweep (2x per week)
                new Habit
                {
                    Id = 3,
                    Name = "Vacuum/Sweep Floors",
                    Frequency = HabitFrequency.Weekly,
                    RequiredCount = 2,
                    WindowDays = 7,
                    IsActive = true
                },

                // Weekly: Gym (4x per week)
                new Habit
                {
                    Id = 4,
                    Name = "Gym Workout",
                    Frequency = HabitFrequency.Weekly,
                    RequiredCount = 4,
                    WindowDays = 7,
                    IsActive = true
                },

                // Weekly: Clean bathroom (1x per week)
                new Habit
                {
                    Id = 5,
                    Name = "Clean Bathroom",
                    Frequency = HabitFrequency.Weekly,
                    RequiredCount = 1,
                    WindowDays = 7,
                    IsActive = true
                },

                // Monthly: Kitchen deep clean
                new Habit
                {
                    Id = 6,
                    Name = "Kitchen Deep Clean",
                    Frequency = HabitFrequency.Monthly,
                    RequiredCount = 1,
                    WindowDays = 30,
                    IsActive = true
                },

                // Seasonal: Clean windows (3x March-October)
                new Habit
                {
                    Id = 7,
                    Name = "Clean Windows",
                    Frequency = HabitFrequency.Seasonal,
                    RequiredCount = 3,
                    WindowDays = 240, // ~8 months
                    StartMonth = 3,   // March
                    EndMonth = 10,    // October
                    IsActive = true
                }
            };

            modelBuilder.Entity<Habit>().HasData(habits);
        }

        public static void SeedSampleCompletions(ModelBuilder modelBuilder)
        {
            // Add some sample completions for testing
            var completions = new List<HabitCompletion>();
            var startDate = DateTime.Today.AddDays(-7); // Last week

            int completionId = 1;

            // Sample phone lock completions (daily)
            for (int i = 0; i < 7; i++)
            {
                completions.Add(new HabitCompletion
                {
                    Id = completionId++,
                    HabitId = 1, // Phone lock
                    Date = startDate.AddDays(i),
                    IsCompleted = i < 5, // Missed weekend
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Sample dish cleaning (rolling every 2 days)
            completions.Add(new HabitCompletion
            {
                Id = completionId++,
                HabitId = 2, // Dishes
                Date = startDate.AddDays(1),
                IsCompleted = true,
                CreatedAt = DateTime.UtcNow
            });

            completions.Add(new HabitCompletion
            {
                Id = completionId++,
                HabitId = 2, // Dishes
                Date = startDate.AddDays(4),
                IsCompleted = true,
                CreatedAt = DateTime.UtcNow
            });

            // Sample gym sessions (4x per week target)
            for (int i = 0; i < 3; i++) // Only 3 out of 4 sessions
            {
                completions.Add(new HabitCompletion
                {
                    Id = completionId++,
                    HabitId = 4, // Gym
                    Date = startDate.AddDays(i * 2),
                    IsCompleted = true,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Sample vacuum/sweep (2x per week target)
            completions.Add(new HabitCompletion
            {
                Id = completionId++,
                HabitId = 3, // Vacuum/Sweep
                Date = startDate.AddDays(2),
                IsCompleted = true,
                CreatedAt = DateTime.UtcNow
            });

            completions.Add(new HabitCompletion
            {
                Id = completionId++,
                HabitId = 3, // Vacuum/Sweep
                Date = startDate.AddDays(5),
                IsCompleted = true,
                CreatedAt = DateTime.UtcNow
            });

            // Sample bathroom cleaning (1x per week)
            completions.Add(new HabitCompletion
            {
                Id = completionId++,
                HabitId = 5, // Bathroom
                Date = startDate.AddDays(3),
                IsCompleted = true,
                CreatedAt = DateTime.UtcNow
            });

            modelBuilder.Entity<HabitCompletion>().HasData(completions);
        }
    }
}