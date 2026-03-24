using System;

namespace SafetyEStopSystem.API.Models
{
	public class AuditLog
	{
		public int Id { get; set; }

		public string Action { get; set; }

		public string PerformedBy { get; set; }

		public DateTime TimeStamp { get; set; }
	}
}