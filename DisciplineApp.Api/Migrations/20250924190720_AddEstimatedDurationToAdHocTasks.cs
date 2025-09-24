using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DisciplineApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEstimatedDurationToAdHocTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.AddColumn<int>(
                name: "EstimatedDurationMinutes",
                table: "AdHocTasks",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.DropColumn(
                name: "EstimatedDurationMinutes",
                table: "AdHocTasks");
        }
    }
}
