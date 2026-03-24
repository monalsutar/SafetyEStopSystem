using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafetyEStopSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAckFieldsToIncident : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AckComment",
                table: "Incidents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AckResolved",
                table: "Incidents",
                type: "bit",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AckComment",
                table: "Incidents");

            migrationBuilder.DropColumn(
                name: "AckResolved",
                table: "Incidents");
        }
    }
}
