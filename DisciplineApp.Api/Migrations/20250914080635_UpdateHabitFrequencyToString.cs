using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DisciplineApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateHabitFrequencyToString : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_HabitCompletions_Habits_HabitId",
                table: "HabitCompletions");

            migrationBuilder.DropForeignKey(
                name: "FK_Rewards_DisciplineEntries_DisciplineEntryId",
                table: "Rewards");

            migrationBuilder.DropForeignKey(
                name: "FK_TaskDeferrals_Habits_HabitId",
                table: "TaskDeferrals");

            migrationBuilder.DropIndex(
                name: "IX_TaskDeferrals_HabitId",
                table: "TaskDeferrals");

            migrationBuilder.AlterColumn<string>(
                name: "Reason",
                table: "TaskDeferrals",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "TaskDeferrals",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValue: new DateTime(2025, 9, 14, 7, 25, 6, 8, DateTimeKind.Utc).AddTicks(3050));

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                table: "Rewards",
                type: "varchar(50)",
                unicode: false,
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Rewards",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "GETUTCDATE()",
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValue: new DateTime(2025, 9, 14, 7, 25, 6, 9, DateTimeKind.Utc).AddTicks(2916));

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Habits",
                type: "varchar(100)",
                unicode: false,
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<bool>(
                name: "HasDeadline",
                table: "Habits",
                type: "bit",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "bit");

            migrationBuilder.AlterColumn<string>(
                name: "Frequency",
                table: "Habits",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<DateTime>(
                name: "Date",
                table: "HabitCompletions",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UsedDate",
                table: "GraceUsages",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "GraceUsages",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "GETUTCDATE()",
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValue: new DateTime(2025, 9, 14, 7, 25, 6, 8, DateTimeKind.Utc).AddTicks(1351));

            migrationBuilder.AddForeignKey(
                name: "FK_HabitCompletions_Habits",
                table: "HabitCompletions",
                column: "HabitId",
                principalTable: "Habits",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Rewards_DisciplineEntries",
                table: "Rewards",
                column: "DisciplineEntryId",
                principalTable: "DisciplineEntries",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_HabitCompletions_Habits",
                table: "HabitCompletions");

            migrationBuilder.DropForeignKey(
                name: "FK_Rewards_DisciplineEntries",
                table: "Rewards");

            migrationBuilder.AlterColumn<string>(
                name: "Reason",
                table: "TaskDeferrals",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "TaskDeferrals",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(2025, 9, 14, 7, 25, 6, 8, DateTimeKind.Utc).AddTicks(3050),
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                table: "Rewards",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(50)",
                oldUnicode: false,
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Rewards",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(2025, 9, 14, 7, 25, 6, 9, DateTimeKind.Utc).AddTicks(2916),
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "GETUTCDATE()");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Habits",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(100)",
                oldUnicode: false,
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<bool>(
                name: "HasDeadline",
                table: "Habits",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: false);

            migrationBuilder.AlterColumn<int>(
                name: "Frequency",
                table: "Habits",
                type: "int",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<DateTime>(
                name: "Date",
                table: "HabitCompletions",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "date");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UsedDate",
                table: "GraceUsages",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "date");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "GraceUsages",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(2025, 9, 14, 7, 25, 6, 8, DateTimeKind.Utc).AddTicks(1351),
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "GETUTCDATE()");

            migrationBuilder.CreateIndex(
                name: "IX_TaskDeferrals_HabitId",
                table: "TaskDeferrals",
                column: "HabitId");

            migrationBuilder.AddForeignKey(
                name: "FK_HabitCompletions_Habits_HabitId",
                table: "HabitCompletions",
                column: "HabitId",
                principalTable: "Habits",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Rewards_DisciplineEntries_DisciplineEntryId",
                table: "Rewards",
                column: "DisciplineEntryId",
                principalTable: "DisciplineEntries",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskDeferrals_Habits_HabitId",
                table: "TaskDeferrals",
                column: "HabitId",
                principalTable: "Habits",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
