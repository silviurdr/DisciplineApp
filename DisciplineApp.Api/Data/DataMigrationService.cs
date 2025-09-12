using DisciplineApp.Api.Data;
using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Services;

public class DataMigrationService
{
    private readonly DisciplineDbContext _context;

    public DataMigrationService(DisciplineDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Migrate existing DisciplineEntry data to new habit-based system
    /// </summary>
    public async Task<string> MigrateExistingDataAsync()
    {
        var migrationResults = new List<string>();

        try
        {
            // Get all existing discipline entries
            var disciplineEntries = await _context.DisciplineEntries
                .Where(d => d.IsCompleted)
                .OrderBy(d => d.Date)
                .ToListAsync();

            if (!disciplineEntries.Any())
            {
                return "No existing discipline entries found to migrate.";
            }

            // Get the Phone Lock Box habit (daily habit)
            var phoneLockHabit = await _context.Habits
                .FirstOrDefaultAsync(h => h.Name == "Phone Lock Box");

            if (phoneLockHabit == null)
            {
                return "Phone Lock Box habit not found. Please seed habits first.";
            }

            var migratedCount = 0;

            foreach (var entry in disciplineEntries)
            {
                // Check if this date already has a completion for phone lock habit
                var existingCompletion = await _context.HabitCompletions
                    .FirstOrDefaultAsync(hc => hc.HabitId == phoneLockHabit.Id &&
                                              hc.Date.Date == entry.Date.Date);

                if (existingCompletion == null)
                {
                    // Create new habit completion
                    var habitCompletion = new HabitCompletion
                    {
                        HabitId = phoneLockHabit.Id,
                        Date = entry.Date,
                        IsCompleted = true,
                        CompletedAt = entry.Date, // Use the original date as completion time
                        Notes = "Migrated from old discipline entry system"
                    };

                    _context.HabitCompletions.Add(habitCompletion);
                    migratedCount++;
                }
            }

            await _context.SaveChangesAsync();

            migrationResults.Add($"Successfully migrated {migratedCount} discipline entries to Phone Lock Box habit completions");
            migrationResults.Add($"Total original entries: {disciplineEntries.Count}");
            migrationResults.Add($"Skipped duplicates: {disciplineEntries.Count - migratedCount}");

            return string.Join("\n", migrationResults);
        }
        catch (Exception ex)
        {
            return $"Migration failed: {ex.Message}";
        }
    }

    /// <summary>
    /// Add sample completions for testing the habit system
    /// </summary>
    public async Task<string> AddSampleCompletionsAsync()
    {
        try
        {
            var habits = await _context.Habits.ToListAsync();
            var sampleCompletions = new List<HabitCompletion>();
            var today = DateTime.Today;

            foreach (var habit in habits)
            {
                // Add some sample completions for the past week
                for (int daysBack = 7; daysBack >= 1; daysBack--)
                {
                    var date = today.AddDays(-daysBack);

                    // Skip if completion already exists
                    var exists = await _context.HabitCompletions
                        .AnyAsync(hc => hc.HabitId == habit.Id && hc.Date.Date == date.Date);

                    if (exists) continue;

                    // Add completions based on habit type and some randomness
                    bool shouldComplete = habit.Frequency switch
                    {
                        HabitFrequency.Daily => daysBack <= 5, // Complete last 5 days
                        HabitFrequency.EveryTwoDays => daysBack % 2 == 0, // Every other day
                        HabitFrequency.Weekly => daysBack <= 4 && daysBack % 2 == 0, // Twice this week
                        HabitFrequency.Monthly => daysBack == 3, // Once this week
                        HabitFrequency.Seasonal => daysBack == 7, // Once last week
                        _ => false
                    };

                    if (shouldComplete)
                    {
                        sampleCompletions.Add(new HabitCompletion
                        {
                            HabitId = habit.Id,
                            Date = date,
                            IsCompleted = true,
                            CompletedAt = date.AddHours(10), // Completed at 10 AM
                            Notes = "Sample completion for testing"
                        });
                    }
                }
            }

            if (sampleCompletions.Any())
            {
                _context.HabitCompletions.AddRange(sampleCompletions);
                await _context.SaveChangesAsync();
                return $"Added {sampleCompletions.Count} sample completions for testing";
            }

            return "No sample completions needed - data already exists";
        }
        catch (Exception ex)
        {
            return $"Sample data creation failed: {ex.Message}";
        }
    }
}