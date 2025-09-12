using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Services;

public static class HabitSeedData
{
    public static async Task SeedHabitsAsync(DisciplineDbContext context)
    {
        if (await context.Habits.AnyAsync())
        {
            Console.WriteLine($"Database already contains {await context.Habits.CountAsync()} habits");
            return;
        }

        var habits = new List<Habit>
        {
            new Habit
            {
                Name = "Phone Lock Box",
                Description = "Lock iPhone in the lock box for the day",
                Frequency = HabitFrequency.Daily,
                WeeklyTarget = 7,
                MonthlyTarget = 30,
                SeasonalTarget = 0,
                IsActive = true
            },
            new Habit
            {
                Name = "Clean Dishes",
                Description = "Ensure sink is clean, no dishes left",
                Frequency = HabitFrequency.EveryTwoDays,
                WeeklyTarget = 4,
                MonthlyTarget = 15,
                SeasonalTarget = 0,
                IsActive = true
            },
            new Habit
            {
                Name = "Gym Workout",
                Description = "Complete workout session at the gym",
                Frequency = HabitFrequency.Weekly,
                WeeklyTarget = 4,
                MonthlyTarget = 16,
                SeasonalTarget = 0,
                IsActive = true
            },
            new Habit
            {
                Name = "Vacuum/Sweep Floors",
                Description = "Vacuum and sweep all floors",
                Frequency = HabitFrequency.Weekly,
                WeeklyTarget = 2,
                MonthlyTarget = 8,
                SeasonalTarget = 0,
                IsActive = true
            },
            new Habit
            {
                Name = "Clean Bathroom",
                Description = "Complete bathroom cleaning",
                Frequency = HabitFrequency.Weekly,
                WeeklyTarget = 1,
                MonthlyTarget = 4,
                SeasonalTarget = 0,
                IsActive = true
            },
            new Habit
            {
                Name = "Kitchen Deep Clean",
                Description = "Monthly deep clean of kitchen",
                Frequency = HabitFrequency.Monthly,
                WeeklyTarget = 0,
                MonthlyTarget = 1,
                SeasonalTarget = 0,
                IsActive = true
            },
            new Habit
            {
                Name = "Clean Windows",
                Description = "Clean all windows (seasonal)",
                Frequency = HabitFrequency.Seasonal,
                WeeklyTarget = 0,
                MonthlyTarget = 0,
                SeasonalTarget = 3,
                IsActive = true
            }
        };

        await context.Habits.AddRangeAsync(habits);
        await context.SaveChangesAsync();

        Console.WriteLine($"Successfully seeded {habits.Count} habits");
    }
}