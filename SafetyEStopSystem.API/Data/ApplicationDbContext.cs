using Microsoft.EntityFrameworkCore;
using SafetyEStopSystem.API.Data;
using SafetyEStopSystem.API.Models;

namespace SafetyEStopSystem.API.Data
{
	public class ApplicationDbContext : DbContext
	{
		public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
			: base(options)
		{
		}

		public DbSet<User> Users { get; set; }
		public DbSet<Incident> Incidents { get; set; }
		public DbSet<Station> Stations { get; set; }
		public DbSet<AuditLog> AuditLogs { get; set; }
	}
}


 