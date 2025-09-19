using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DisciplineApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsOptionalToHabits : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOptional",
                table: "Habits",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsOptional",
                table: "Habits");
        }
    }
}
