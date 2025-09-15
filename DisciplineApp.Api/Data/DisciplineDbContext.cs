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
    public DbSet<AdHocTask> AdHocTasks { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // DisciplineEntry configuration
        modelBuilder.Entity<DisciplineEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Date)
                  .IsRequired()
                  .HasColumnType("date"); // ✅ Specify SQL Server date type
            entity.HasIndex(e => e.Date)
                  .IsUnique()
                  .HasDatabaseName("IX_DisciplineEntries_Date"); // ✅ Explicit index name
        });

        // Habit configuration
        modelBuilder.Entity<Habit>(entity =>
        {
            entity.HasKey(h => h.Id);
            entity.Property(h => h.Name)
                  .IsRequired()
                  .HasMaxLength(100)
                  .IsUnicode(false); // ✅ For performance if only ASCII
            entity.Property(h => h.Description)
                  .HasMaxLength(500)
                  .IsUnicode(true); // ✅ Allow Unicode for descriptions
            entity.Property(h => h.Frequency)
                  .IsRequired()
                  .HasConversion<string>(); // ✅ Store enum as string
            entity.Property(h => h.IsActive)
                  .IsRequired()
                  .HasDefaultValue(true);
            entity.Property(h => h.CreatedAt)
                  .IsRequired()
                  .HasColumnType("datetime2") // ✅ Use datetime2 for SQL Server
                  .HasDefaultValueSql("GETUTCDATE()"); // ✅ SQL Server function
            entity.Property(h => h.DeadlineTime)
                  .HasColumnType("time"); // ✅ Specify time type
            entity.Property(h => h.HasDeadline)
                  .IsRequired()
                  .HasDefaultValue(false);
            entity.Property(e => e.MaxDeferrals).HasDefaultValue(0);

            // Configure relationships
            entity.HasMany(h => h.Completions)
                  .WithOne(c => c.Habit)
                  .HasForeignKey(c => c.HabitId)
                  .OnDelete(DeleteBehavior.Cascade)
                  .HasConstraintName("FK_HabitCompletions_Habits"); // ✅ Explicit FK name
        });

        // HabitCompletion configuration
        modelBuilder.Entity<HabitCompletion>(entity =>
        {
            entity.HasKey(hc => hc.Id);
            entity.Property(hc => hc.Date)
                  .IsRequired()
                  .HasColumnType("date");
            entity.Property(hc => hc.IsCompleted)
                  .IsRequired();
            entity.Property(hc => hc.Notes)
                  .HasMaxLength(1000)
                  .IsUnicode(true);
            entity.Property(hc => hc.CompletedAt)
                  .HasColumnType("datetime2");

            // Create unique constraint for HabitId + Date
            entity.HasIndex(hc => new { hc.HabitId, hc.Date })
                  .IsUnique()
                  .HasDatabaseName("IX_HabitCompletions_HabitId_Date");
        });

        modelBuilder.Entity<AdHocTask>(entity =>
            {
                entity.HasKey(t => t.Id);
                entity.Property(t => t.Name).IsRequired().HasMaxLength(200);
                entity.Property(t => t.Description).HasMaxLength(500);
                entity.Property(t => t.Date).IsRequired().HasColumnType("date");
                entity.Property(t => t.CreatedAt).HasColumnType("datetime2").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(t => t.CompletedAt).HasColumnType("datetime2");
            });


        // GraceUsage configuration
        modelBuilder.Entity<GraceUsage>(entity =>
        {
            entity.HasKey(g => g.Id);
            entity.Property(g => g.UsedDate)
                  .IsRequired()
                  .HasColumnType("date");
            entity.Property(g => g.Reason)
                  .HasMaxLength(500)
                  .IsUnicode(true);
            entity.Property(g => g.CreatedAt)
                  .IsRequired()
                  .HasColumnType("datetime2")
                  .HasDefaultValueSql("GETUTCDATE()");

            // One grace per day constraint
            entity.HasIndex(g => g.UsedDate)
                  .IsUnique()
                  .HasDatabaseName("IX_GraceUsages_UsedDate");
        });

        // Reward configuration
        modelBuilder.Entity<Reward>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Type)
                  .IsRequired()
                  .HasMaxLength(50)
                  .IsUnicode(false);
            entity.Property(r => r.Name)
                  .HasMaxLength(100)
                  .IsUnicode(true);
            entity.Property(r => r.Description)
                  .IsRequired()
                  .HasMaxLength(500)
                  .IsUnicode(true);
            entity.Property(r => r.EarnedAt)
                  .IsRequired()
                  .HasColumnType("datetime2");
            entity.Property(r => r.IsActive)
                  .IsRequired()
                  .HasDefaultValue(true);
            entity.Property(r => r.CreatedAt)
                  .IsRequired()
                  .HasColumnType("datetime2")
                  .HasDefaultValueSql("GETUTCDATE()");

            // Configure relationship with DisciplineEntry
            entity.HasOne(r => r.DisciplineEntry)
                  .WithMany()
                  .HasForeignKey(r => r.DisciplineEntryId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .HasConstraintName("FK_Rewards_DisciplineEntries");
        });

        modelBuilder.Entity<TaskDeferral>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Reason).HasMaxLength(500);

            entity.HasOne(d => d.Habit)
                .WithMany(h => h.Deferrals)
                .HasForeignKey(d => d.HabitId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        base.OnModelCreating(modelBuilder);
    }
}