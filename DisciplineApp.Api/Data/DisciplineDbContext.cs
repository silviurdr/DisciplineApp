using DisciplineApp.Api.Models;
using Microsoft.EntityFrameworkCore;


namespace DisciplineApp.Api.Data;

public class DisciplineDbContext : DbContext
{
    public DisciplineDbContext(DbContextOptions<DisciplineDbContext> options) : base(options)
    {
    }

    public DbSet<DisciplineEntry> DisciplineEntries { get; set; }
    public DbSet<Habit> Habits { get; set; }
    public DbSet<HabitCompletion> HabitCompletions { get; set; }
    public DbSet<GraceUsage> GraceUsages { get; set; }
    public DbSet<Reward> Rewards { get; set; }

    public DbSet<TaskDeferral> TaskDeferrals { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // DisciplineEntry configuration
        modelBuilder.Entity<DisciplineEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Date).IsRequired();
            entity.HasIndex(e => e.Date).IsUnique();
        });

        // Habit configuration
        modelBuilder.Entity<Habit>(entity =>
        {
            entity.HasKey(h => h.Id);
            entity.Property(h => h.Name).IsRequired().HasMaxLength(100);
            entity.Property(h => h.Description).HasMaxLength(500);
            entity.Property(h => h.Frequency).IsRequired();

            // Corrected for SQL Server
            entity.Property(r => r.IsActive).HasDefaultValue(true);
            entity.Property(h => h.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            // Configure relationships
            entity.HasMany(h => h.Completions)
                  .WithOne(c => c.Habit)
                  .HasForeignKey(c => c.HabitId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // HabitCompletion configuration
        modelBuilder.Entity<HabitCompletion>(entity =>
        {
            entity.HasKey(hc => hc.Id);
            entity.Property(hc => hc.Date).IsRequired();
            entity.Property(hc => hc.IsCompleted).IsRequired();
            entity.Property(hc => hc.Notes).HasMaxLength(1000);

            // Create unique constraint for HabitId + Date
            entity.HasIndex(hc => new { hc.HabitId, hc.Date }).IsUnique();
        });

        // GraceUsage configuration
        modelBuilder.Entity<GraceUsage>(entity =>
        {
            entity.HasKey(g => g.Id);
            entity.Property(g => g.UsedDate).IsRequired();
            entity.Property(g => g.Reason).HasMaxLength(500);
            entity.Property(g => g.CreatedAt).HasDefaultValue(DateTime.UtcNow);

            // One grace per day constraint
            entity.HasIndex(g => g.UsedDate).IsUnique();
        });

        // TaskDeferral configuration
        modelBuilder.Entity<TaskDeferral>(entity =>
        {
            entity.HasKey(td => td.Id);
            entity.Property(td => td.OriginalDate).IsRequired();
            entity.Property(td => td.DeferredToDate).IsRequired();
            entity.Property(td => td.Reason).HasMaxLength(500);
            entity.Property(td => td.CreatedAt).HasDefaultValue(DateTime.UtcNow);

            // Configure relationship with Habit
            entity.HasOne<Habit>()
                      .WithMany()
                      .HasForeignKey(td => td.HabitId)
                      .OnDelete(DeleteBehavior.Cascade);
        });

        // Reward configuration
        modelBuilder.Entity<Reward>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Type).IsRequired().HasMaxLength(50);
            entity.Property(r => r.Name).HasMaxLength(100);
            entity.Property(r => r.Description).IsRequired().HasMaxLength(500);
            entity.Property(r => r.EarnedAt).IsRequired();
            entity.Property(r => r.IsActive).HasDefaultValue(true);
            entity.Property(r => r.CreatedAt).HasDefaultValue(DateTime.UtcNow);

            // Configure relationship with DisciplineEntry
            entity.HasOne(r => r.DisciplineEntry)
                  .WithMany()
                  .HasForeignKey(r => r.DisciplineEntryId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        base.OnModelCreating(modelBuilder);
    }
}