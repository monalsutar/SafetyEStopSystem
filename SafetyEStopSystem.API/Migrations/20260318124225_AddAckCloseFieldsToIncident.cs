using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafetyEStopSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAckCloseFieldsToIncident : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "AckResolved",
                table: "Incidents",
                newName: "IsResolved");

            migrationBuilder.AddColumn<string>(
                name: "CloseComment",
                table: "Incidents",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CloseComment",
                table: "Incidents");

            migrationBuilder.RenameColumn(
                name: "IsResolved",
                table: "Incidents",
                newName: "AckResolved");
        }
    }
}
