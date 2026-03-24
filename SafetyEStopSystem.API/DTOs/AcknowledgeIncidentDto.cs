namespace SafetyEStopSystem.API.DTOs
{
	public class AcknowledgeIncidentDto
	{

		// "Issue was about?" (required)
		public string Issue { get; set; } = default!;

		// Optional comment
		public string? Comment { get; set; } // maps to AckComment


	}
}
