using System.ComponentModel.DataAnnotations;

namespace SafetyEStopSystem.API.Models
{
	public class User
	{
		public int Id { get; set; }

		[Required]
		public string FullName { get; set; }

		[Required]
		public string EmployeeId { get; set; }

		[Required]
		public string Email { get; set; }

		[Required]
		public string Password { get; set; }

		[Required]
		public string Role { get; set; }   // Operator / Supervisor
	}

}
