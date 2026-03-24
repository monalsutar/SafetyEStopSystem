using System.ComponentModel.DataAnnotations;

namespace SafetyEStopSystem.API.Models
{
	public class Station
	{
		public int Id { get; set; }

		[Required]
		public string Name { get; set; } = string.Empty;

		public string? Location { get; set; }

		public bool IsActive { get; set; } = true;

		// Navigation property
		public ICollection<Incident> Incidents { get; set; }=new List<Incident>();
	}
}