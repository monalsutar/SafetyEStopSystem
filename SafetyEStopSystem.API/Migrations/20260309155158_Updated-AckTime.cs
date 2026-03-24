using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafetyEStopSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class UpdatedAckTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "TriggeredBy",
                table: "Incidents",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<DateTime>(
                name: "AcknowledgedAt",
                table: "Incidents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AcknowledgedBy",
                table: "Incidents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClosedBy",
                table: "Incidents",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AcknowledgedAt",
                table: "Incidents");

            migrationBuilder.DropColumn(
                name: "AcknowledgedBy",
                table: "Incidents");

            migrationBuilder.DropColumn(
                name: "ClosedBy",
                table: "Incidents");

            migrationBuilder.AlterColumn<string>(
                name: "TriggeredBy",
                table: "Incidents",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);
        }
    }
}
