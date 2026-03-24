using System;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace SafetyEStopSystem.API.Models
{
	// Models/Incident.cs
	public class Incident
	{
		public int Id { get; set; }

		public int StationId { get; set; }
		public Station Station { get; set; } = default!;

		// "Open" | "Acknowledged" | "Closed" | "Reset"
		public string Status { get; set; } = "Open";


		public DateTimeOffset TriggeredAt { get; set; } = DateTime.UtcNow;
		public DateTimeOffset? AcknowledgedAt { get; set; }
		public DateTimeOffset? ClosedAt { get; set; }

		// Who did what (optional)
		public string? TriggeredBy { get; set; }
		public string? AcknowledgedBy { get; set; }
		public string? ClosedBy { get; set; }

		/// <summary>
		/// Total duration from TriggeredAt to ClosedAt, in minutes.
		/// Nullable for incidents not yet closed.
		/// </summary>
		public double? DurationMinutes { get; set; }


		// "Issue was about?" captured at Acknowledge (required in UI/Controller)
		public string? AckIssue { get; set; }

		// comment captured at Acknowledge
		public string? AckComment { get; set; }

		// kept for backward compatibility with older rows; no longer used by Close flow
		public bool? IsResolved { get; set; }

		// optional comment captured at Close
		public string? CloseComment { get; set; }

	}
}