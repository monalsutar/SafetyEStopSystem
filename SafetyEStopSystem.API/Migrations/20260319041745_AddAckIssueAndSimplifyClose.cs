using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafetyEStopSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAckIssueAndSimplifyClose : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AckIssue",
                table: "Incidents",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AckIssue",
                table: "Incidents");
        }
    }
}
