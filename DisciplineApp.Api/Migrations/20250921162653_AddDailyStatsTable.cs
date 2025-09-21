using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DisciplineApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyStatsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DailyStats",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Date = table.Column<DateTime>(type: "date", nullable: false),
                    TotalTasks = table.Column<int>(type: "int", nullable: false),
                    CompletedTasks = table.Column<int>(type: "int", nullable: false),
                    RequiredTasks = table.Column<int>(type: "int", nullable: false),
                    CompletedRequiredTasks = table.Column<int>(type: "int", nullable: false),
                    IsDayCompleted = table.Column<bool>(type: "bit", nullable: false),
                    StreakDayNumber = table.Column<int>(type: "int", nullable: false),
                    IsInFirst7Days = table.Column<bool>(type: "bit", nullable: false),
                    CompletionPercentage = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    CalculatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CompletionRules = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyStats", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DailyStats_Date",
                table: "DailyStats",
                column: "Date",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DailyStats_Date_Completed",
                table: "DailyStats",
                columns: new[] { "Date", "IsDayCompleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyStats");
        }
    }
}
