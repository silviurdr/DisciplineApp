using Microsoft.EntityFrameworkCore;
using DisciplineApp.Api.Models;

namespace DisciplineApp.Api.Data
{
    public class DisciplineDbContext : DbContext
    {
        public DisciplineDbContext(DbContextOptions<DisciplineDbContext> options) : base(options)
        {
        }

        public DbSet<DisciplineEntry> DisciplineEntries { get; set; }
        public DbSet<Reward> Rewards { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure DisciplineEntry
            modelBuilder.Entity<DisciplineEntry>(entity =>
            {
                entity.HasKey(e => e.Id);

                // Use DateOnly for date storage to avoid timezone issues
                entity.Property(e => e.Date)
                    .IsRequired()
                    .HasColumnType("DATE"); // Store as DATE type in database

                // Create unique index on Date to prevent duplicates
                entity.HasIndex(e => e.Date)
                    .IsUnique()
                    .HasDatabaseName("IX_DisciplineEntry_Date");

                entity.Property(e => e.IsCompleted)
                    .IsRequired()
                    .HasDefaultValue(false);

                entity.Property(e => e.IsSpecial)
                    .IsRequired()
                    .HasDefaultValue(false);

                entity.Property(e => e.Notes)
                    .HasMaxLength(1000)
                    .IsRequired(false);

                entity.Property(e => e.CreatedAt)
                    .IsRequired()
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");

                entity.Property(e => e.CompletedAt)
                    .IsRequired(false);
            });

            // Configure Reward
            modelBuilder.Entity<Reward>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Type)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.Description)
                    .IsRequired()
                    .HasMaxLength(500);

                entity.Property(e => e.EarnedAt)
                    .IsRequired()
                    .HasDefaultValueSql("CURRENT_TIMESTAMP");

                // Configure relationship
                entity.HasOne(r => r.DisciplineEntry)
                    .WithMany(de => de.Rewards)
                    .HasForeignKey(r => r.DisciplineEntryId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure DateOnly conversion for SQLite
            if (Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite")
            {
                modelBuilder.Entity<DisciplineEntry>()
                    .Property(e => e.Date)
                    .HasConversion(
                        dateOnly => dateOnly.ToString("yyyy-MM-dd"),
                        dateString => DateOnly.ParseExact(dateString, "yyyy-MM-dd")
                    );
            }
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                // This should only be used in development
                optionsBuilder.UseSqlite("Data Source=discipline.db");
            }
        }

        // Remove the seed data method to avoid UNIQUE constraint violations
        // Data will be created through user interactions instead
    }
}