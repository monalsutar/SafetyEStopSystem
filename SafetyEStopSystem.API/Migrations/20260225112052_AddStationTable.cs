using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafetyEStopSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddStationTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StationName",
                table: "Incidents");

            migrationBuilder.AddColumn<int>(
                name: "StationId",
                table: "Incidents",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Stations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Stations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_StationId",
                table: "Incidents",
                column: "StationId");

            migrationBuilder.AddForeignKey(
                name: "FK_Incidents_Stations_StationId",
                table: "Incidents",
                column: "StationId",
                principalTable: "Stations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Incidents_Stations_StationId",
                table: "Incidents");

            migrationBuilder.DropTable(
                name: "Stations");

            migrationBuilder.DropIndex(
                name: "IX_Incidents_StationId",
                table: "Incidents");

            migrationBuilder.DropColumn(
                name: "StationId",
                table: "Incidents");

            migrationBuilder.AddColumn<string>(
                name: "StationName",
                table: "Incidents",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }
    }
}
