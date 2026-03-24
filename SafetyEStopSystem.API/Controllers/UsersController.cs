using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafetyEStopSystem.API.Data;
using SafetyEStopSystem.API.Models;
using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace SafetyEStopSystem.API.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	[Authorize(Roles = "Admin")] // Entire controller is Admin-only
	public class UsersController : ControllerBase
	{
		private readonly ApplicationDbContext _context;

		public UsersController(ApplicationDbContext context)
		{
			_context = context;
		}

		// ----- Helpers reused from AuthController -----
		private static bool IsValidPassword(string password)
		{
			var regex = new Regex(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{6,}$");
			return regex.IsMatch(password);
		}

		private static string HashPassword(string password)
		{
			using (SHA256 sha256 = SHA256.Create())
			{
				var bytes = Encoding.UTF8.GetBytes(password);
				var hash = sha256.ComputeHash(bytes);
				return Convert.ToBase64String(hash);
			}
		}

		private static readonly string[] AllowedRoles = new[] { "Admin", "Supervisor", "Operator" };

		// ===== GET: api/users  (list all users) =====
		[HttpGet]
		public async Task<IActionResult> GetAllUsers()
		{
			var users = await _context.Users
				.Select(u => new
				{
					u.Id,
					u.FullName,
					u.Email,
					u.Role
				})
				.ToListAsync();

			return Ok(users);
		}

		public class CreateUserDto
		{
			[Required, StringLength(200)]
			public string FullName { get; set; } = default!;

			[Required, EmailAddress]
			public string Email { get; set; } = default!;

			[Required]
			public string Role { get; set; } = default!; // Admin, Supervisor, Operator

			// You can generate on server if you prefer, but keeping client-provided for now.
			[Required]
			public string Password { get; set; } = default!;
		}

		// ===== POST: api/users  (create a new user) =====
		[HttpPost]
		public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
		{
			if (!AllowedRoles.Contains(dto.Role))
				return BadRequest($"Invalid role. Allowed: {string.Join(", ", AllowedRoles)}");

			var exists = await _context.Users.AnyAsync(u => u.Email == dto.Email);
			if (exists)
				return BadRequest("User with this email already exists.");

			if (!IsValidPassword(dto.Password))
			{
				return BadRequest("Password must contain minimum 6 characters, one uppercase letter, one lowercase letter, one number and one special character.");
			}

			var user = new User
			{
				FullName = dto.FullName.Trim(),
				Email = dto.Email.Trim(),
				Role = dto.Role,
				Password = HashPassword(dto.Password)
			};

			_context.Users.Add(user);
			await _context.SaveChangesAsync();

			return CreatedAtAction(nameof(GetAllUsers), new { id = user.Id }, new
			{
				user.Id,
				user.FullName,
				user.Email,
				user.Role
			});
		}

		// ===== DELETE: api/users/{id}  (cannot delete Admins; and ideally not self) =====
		[HttpDelete("{id:int}")]
		public async Task<IActionResult> DeleteUser([FromRoute] int id)
		{
			var requesterEmail = User?.Identity?.Name ?? User?.FindFirst("email")?.Value;
			var requesterRole = User?.FindFirst("role")?.Value ?? User?.FindFirst("http://schemas.microsoft.com/ws/2008/06/identity/claims/role")?.Value;

			var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
			if (user == null) return NotFound("User not found.");

			// Disallow deleting Admins
			if (string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase))
			{
				return Forbid("Admins cannot delete another Admin.");
			}

			// Optional: prevent deleting self
			if (!string.IsNullOrWhiteSpace(requesterEmail) &&
				string.Equals(requesterEmail, user.Email, StringComparison.OrdinalIgnoreCase))
			{
				return BadRequest("You cannot delete your own account.");
			}

			_context.Users.Remove(user);
			await _context.SaveChangesAsync();

			return NoContent();
		}
	}
}