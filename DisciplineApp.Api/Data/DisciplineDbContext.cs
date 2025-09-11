using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DisciplineApp.Api.Data
{
    public class DisciplineDbContext : DbContext
    {
        public DisciplineDbContext(DbContextOptions<DisciplineDbContext> options) : base(options)
        {
        }

        public DbSet<DisciplineEntry> DisciplineEntries { get; set; }
        public DbSet<Reward> Rewards { get; set; }

        // New habit tracking tables
        public DbSet<Habit> Habits { get; set; }
        public DbSet<HabitCompletion> HabitCompletions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure DisciplineEntry
            modelBuilder.Entity<DisciplineEntry>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.Date).IsUnique();
                entity.Property(e => e.Date).IsRequired();
                entity.Property(e => e.Notes).HasMaxLength(500);

                // Add new properties for grace handling
                entity.Property(e => e.IsGraceUsed).HasDefaultValue(false);

                // Configure relationship with Rewards
                entity.HasMany(e => e.Rewards)
                      .WithOne(r => r.DisciplineEntry)
                      .HasForeignKey(r => r.DisciplineEntryId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure Reward
            modelBuilder.Entity<Reward>(entity =>
            {
                entity.HasKey(r => r.Id);
                entity.Property(r => r.Type).IsRequired();
                entity.Property(r => r.DisciplineEntryId).IsRequired();
            });

            // Configure Habit
            modelBuilder.Entity<Habit>(entity =>
            {
                entity.HasKey(h => h.Id);
                entity.Property(h => h.Name).IsRequired().HasMaxLength(200);
                entity.Property(h => h.Frequency).IsRequired();
                entity.Property(h => h.RequiredCount).HasDefaultValue(1);
                entity.Property(h => h.WindowDays).HasDefaultValue(1);
                entity.Property(h => h.IsActive).HasDefaultValue(true);

                // Configure relationship with HabitCompletions
                entity.HasMany(h => h.Completions)
                      .WithOne(c => c.Habit)
                      .HasForeignKey(c => c.HabitId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure HabitCompletion
            modelBuilder.Entity<HabitCompletion>(entity =>
            {
                entity.HasKey(c => c.Id);
                entity.Property(c => c.HabitId).IsRequired();
                entity.Property(c => c.Date).IsRequired();
                entity.Property(c => c.IsCompleted).HasDefaultValue(false);
                entity.Property(c => c.Notes).HasMaxLength(500);

                // Create unique index on HabitId + Date to prevent duplicate entries
                entity.HasIndex(c => new { c.HabitId, c.Date }).IsUnique();
            });

            // Seed your specific habits
            HabitSeedData.SeedHabits(modelBuilder);

            // Optionally seed some sample completions for testing
            if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development")
            {
                HabitSeedData.SeedSampleCompletions(modelBuilder);
            }
        }
    }
}