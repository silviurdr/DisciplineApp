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

            // Seed some example data for 2025
            SeedExampleData(modelBuilder);
        }

        private void SeedExampleData(ModelBuilder modelBuilder)
        {
            var entries = new List<DisciplineEntry>();
            var rewards = new List<Reward>();
            int entryId = 1;
            int rewardId = 1;

            // 8-day streak: Jan 15-22
            for (int day = 15; day <= 22; day++)
            {
                var date = new DateTime(2025, 1, day);
                entries.Add(new DisciplineEntry
                {
                    Id = entryId,
                    Date = date,
                    IsCompleted = true,
                    CreatedAt = new DateTime(2025, 1, 1),
                    UpdatedAt = new DateTime(2025, 1, 1)
                });

                // Add coffee reward on day 7 of streak (Jan 21)
                if (day == 21)
                {
                    rewards.Add(new Reward
                    {
                        Id = rewardId++,
                        Type = RewardType.Coffee,
                        DisciplineEntryId = entryId,
                        EarnedAt = new DateTime(2025, 1, 1)
                    });
                }

                entryId++;
            }

            // 100-day streak: Mar 10 - Jun 17
            var startDate = new DateTime(2025, 3, 10);
            for (int i = 0; i < 100; i++)
            {
                var date = startDate.AddDays(i);
                entries.Add(new DisciplineEntry
                {
                    Id = entryId,
                    Date = date,
                    IsCompleted = true,
                    CreatedAt = new DateTime(2025, 3, 10),
                    UpdatedAt = new DateTime(2025, 3, 10)
                });

                // Add rewards at milestones
                int dayInStreak = i + 1;
                if (dayInStreak == 7)
                {
                    rewards.Add(new Reward
                    {
                        Id = rewardId++,
                        Type = RewardType.Coffee,
                        DisciplineEntryId = entryId,
                        EarnedAt = new DateTime(2025, 3, 16)
                    });
                }
                else if (dayInStreak == 14)
                {
                    rewards.Add(new Reward
                    {
                        Id = rewardId++,
                        Type = RewardType.Book,
                        DisciplineEntryId = entryId,
                        EarnedAt = new DateTime(2025, 3, 23)
                    });
                }
                else if (dayInStreak == 30)
                {
                    rewards.Add(new Reward
                    {
                        Id = rewardId++,
                        Type = RewardType.Clothing,
                        DisciplineEntryId = entryId,
                        EarnedAt = new DateTime(2025, 4, 8)
                    });
                }
                else if (dayInStreak == 90)
                {
                    rewards.Add(new Reward
                    {
                        Id = rewardId++,
                        Type = RewardType.Tennis,
                        DisciplineEntryId = entryId,
                        EarnedAt = new DateTime(2025, 6, 7)
                    });
                }

                entryId++;
            }

            modelBuilder.Entity<DisciplineEntry>().HasData(entries);
            modelBuilder.Entity<Reward>().HasData(rewards);
            
        }
    }
}