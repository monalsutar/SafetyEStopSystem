using System;

namespace SafetyEStopSystem.API.DTOs
{
	// DTOs/IncidentDto.cs
	public class IncidentDto
	{
		public int Id { get; set; }
		public string Status { get; set; } = default!;

		public DateTimeOffset TriggeredAt { get; set; }       // ✅
		public DateTimeOffset? AcknowledgedAt { get; set; }   // ✅
		public DateTimeOffset? ClosedAt { get; set; }


		// Durations (in seconds) for analytics/UX
		public int? TimeToAcknowledgeSeconds { get; set; }
		public int? TimeToCloseSeconds { get; set; }

		// Keep station lightweight to avoid cycles
		public object Station { get; set; } = default!;
	}
}