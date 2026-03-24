using System.ComponentModel.DataAnnotations;

namespace SafetyEStopSystem.API.DTOs
{
	public class CreateStationDto
	{
		[Required]
		public string Name { get; set; }

		public string Location { get; set; }
	}
}