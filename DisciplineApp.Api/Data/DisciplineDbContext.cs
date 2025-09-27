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
    public DbSet<SubHabit> SubHabits { get; set; }
    public DbSet<SubHabitCompletion> SubHabitCompletions { get; set; }
    public DbSet<DailyStats> DailyStats { get; set; }
    public DbSet<EarnedReward> EarnedRewards { get; set; }
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
                  .IsUnicode(false);
            entity.Property(h => h.Description)
                  .HasMaxLength(500)
                  .IsUnicode(true);
            entity.Property(h => h.Frequency)
                  .IsRequired()
                  .HasConversion<string>();
            entity.Property(h => h.IsActive)
                  .IsRequired()
                  .HasDefaultValue(true);
            entity.Property(h => h.CreatedAt)
                  .IsRequired()
                  .HasColumnType("datetime2")
                  .HasDefaultValueSql("GETUTCDATE()");
            entity.Property(h => h.DeadlineTime)
                  .HasColumnType("time");
            entity.Property(h => h.HasDeadline)
                  .IsRequired()
                  .HasDefaultValue(false);

            // 🔥 ADD CONFIGURATION FOR MaxDeferrals
            entity.Property(h => h.MaxDeferrals)
                  .IsRequired()
                  .HasDefaultValue(0);

            // Configure relationships
            entity.HasMany(h => h.Completions)
                  .WithOne(c => c.Habit)
                  .HasForeignKey(c => c.HabitId)
                  .OnDelete(DeleteBehavior.Cascade)
                  .HasConstraintName("FK_HabitCompletions_Habits");

            // 🔥 ADD RELATIONSHIP FOR TaskDeferrals
            entity.HasMany(h => h.Deferrals)
                  .WithOne(d => d.Habit)
                  .HasForeignKey(d => d.HabitId)
                  .OnDelete(DeleteBehavior.Cascade)
                  .HasConstraintName("FK_TaskDeferrals_Habits");

                entity.Property(h => h.IsOptional)
                  .IsRequired()
                  .HasDefaultValue(false);
            entity.HasMany(h => h.SubHabits)
                  .WithOne(sh => sh.ParentHabit)
                  .HasForeignKey(sh => sh.ParentHabitId)
                  .OnDelete(DeleteBehavior.Cascade)
                  .HasConstraintName("FK_SubHabits_Habits");
        });

        modelBuilder.Entity<DailyStats>(entity =>
        {
            entity.HasKey(d => d.Id);

            entity.Property(d => d.Date)
                  .IsRequired()
                  .HasColumnType("date");

            entity.Property(d => d.CompletionPercentage)
                  .HasPrecision(5, 2); // e.g., 100.00

            entity.Property(d => d.CalculatedAt)
                  .IsRequired()
                  .HasColumnType("datetime2")
                  .HasDefaultValueSql("GETUTCDATE()");

            entity.Property(d => d.CompletionRules)
                  .HasMaxLength(200);

            // Unique constraint - one record per date
            entity.HasIndex(d => d.Date)
                  .IsUnique()
                  .HasDatabaseName("IX_DailyStats_Date");

            // Index for streak queries
            entity.HasIndex(d => new { d.Date, d.IsDayCompleted })
                  .HasDatabaseName("IX_DailyStats_Date_Completed");
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

            // Unique constraint
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

        modelBuilder.Entity<SubHabit>(entity =>
        {
            entity.HasKey(sh => sh.Id);
            entity.Property(sh => sh.Name)
                  .IsRequired()
                  .HasMaxLength(200)
                  .IsUnicode(false);
            entity.Property(sh => sh.Description)
                  .HasMaxLength(1000)
                  .IsUnicode(true);
            entity.Property(sh => sh.OrderIndex)
                  .IsRequired()
                  .HasDefaultValue(0);
            entity.Property(sh => sh.IsActive)
                  .IsRequired()
                  .HasDefaultValue(true);
            entity.Property(sh => sh.CreatedAt)
                  .IsRequired()
                  .HasColumnType("datetime2")
                  .HasDefaultValueSql("GETUTCDATE()");

            // Foreign key relationship
            entity.HasOne(sh => sh.ParentHabit)
                  .WithMany(h => h.SubHabits)
                  .HasForeignKey(sh => sh.ParentHabitId)
                  .OnDelete(DeleteBehavior.Cascade)
                  .HasConstraintName("FK_SubHabits_Habits");

            // Index for performance
            entity.HasIndex(sh => new { sh.ParentHabitId, sh.OrderIndex })
                  .HasDatabaseName("IX_SubHabits_ParentHabit_Order");
        });

        // NEW: SubHabitCompletion configuration
        modelBuilder.Entity<SubHabitCompletion>(entity =>
        {
            entity.HasKey(shc => shc.Id);
            entity.Property(shc => shc.Date)
                  .IsRequired()
                  .HasColumnType("date");
            entity.Property(shc => shc.IsCompleted)
                  .IsRequired();
            entity.Property(shc => shc.Notes)
                  .HasMaxLength(1000)
                  .IsUnicode(true);
            entity.Property(shc => shc.CompletedAt)
                  .HasColumnType("datetime2");

            // Foreign key relationship
            entity.HasOne(shc => shc.SubHabit)
                  .WithMany(sh => sh.Completions)
                  .HasForeignKey(shc => shc.SubHabitId)
                  .OnDelete(DeleteBehavior.Cascade)
                  .HasConstraintName("FK_SubHabitCompletions_SubHabits");

            // Unique constraint - one completion per sub-habit per day
            entity.HasIndex(shc => new { shc.SubHabitId, shc.Date })
                  .IsUnique()
                  .HasDatabaseName("IX_SubHabitCompletions_SubHabit_Date");
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
            entity.HasKey(td => td.Id);
            entity.Property(td => td.OriginalDate)
                  .IsRequired()
                  .HasColumnType("datetime2");
            entity.Property(td => td.DeferredToDate)
                  .IsRequired()
                  .HasColumnType("datetime2");

            // 🔥 ADD CONFIGURATION FOR DeferralsUsed
            entity.Property(td => td.DeferralsUsed)
                  .IsRequired()
                  .HasDefaultValue(1);

            entity.Property(td => td.Reason)
                  .HasMaxLength(500)
                  .IsUnicode(true);
            entity.Property(td => td.CreatedAt)
                  .IsRequired()
                  .HasColumnType("datetime2")
                  .HasDefaultValueSql("GETUTCDATE()");
            entity.Property(td => td.CompletedAt)
                  .HasColumnType("datetime2")
                  .IsRequired(false);

            // Create index for performance
            entity.HasIndex(td => new { td.HabitId, td.OriginalDate })
                  .HasDatabaseName("IX_TaskDeferrals_HabitId_OriginalDate");
        });

        base.OnModelCreating(modelBuilder);
    }
}