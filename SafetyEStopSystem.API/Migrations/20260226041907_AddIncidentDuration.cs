using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafetyEStopSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddIncidentDuration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Location",
                table: "Stations",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<DateTime>(
                name: "ClosedAt",
                table: "Incidents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DurationMinutes",
                table: "Incidents",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClosedAt",
                table: "Incidents");

            migrationBuilder.DropColumn(
                name: "DurationMinutes",
                table: "Incidents");

            migrationBuilder.AlterColumn<string>(
                name: "Location",
                table: "Stations",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);
        }
    }
}
