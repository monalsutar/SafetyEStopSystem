using Microsoft.AspNetCore.Mvc;
using SafetyEStopSystem.API.Data;
using SafetyEStopSystem.API.Models;
using SafetyEStopSystem.API.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace SafetyEStopSystem.API.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	public class AuthController : ControllerBase
	{
		private readonly ApplicationDbContext _context;
		private readonly IConfiguration _configuration;

		public AuthController(ApplicationDbContext context, IConfiguration configuration)
		{
			_context = context;
			_configuration = configuration;
		}

		// ================= REGISTER =================
		[HttpPost("register")]
		public async Task<IActionResult> Register([FromBody] User user)
		{
			var existingUser = await _context.Users
				.FirstOrDefaultAsync(x => x.Email == user.Email);

			if (existingUser != null)
				return BadRequest("User already exists");

			if (!IsValidPassword(user.Password))
			{
				return BadRequest("Password must contain minimum 6 characters, one uppercase letter, one lowercase letter, one number and one special character.");
			}

			user.Password = HashPassword(user.Password);

			_context.Users.Add(user);
			await _context.SaveChangesAsync();

			return Ok("User Registered Successfully");
		}

		// ================= LOGIN WITH JWT =================
		[HttpPost("login")]
		public async Task<IActionResult> Login([FromBody] LoginRequest request)
		{
			var hashedPassword = HashPassword(request.Password);

			var user = await _context.Users
				.FirstOrDefaultAsync(x =>
					x.Email == request.Email &&
					x.Password == hashedPassword);

			if (user == null)
				return Unauthorized("Invalid Credentials");

			var token = GenerateJwtToken(user);

			return Ok(new
			{
				token,
				user = new
				{
					user.Id,
					user.FullName,
					user.Email,
					user.Role
				}
			});
		}

		// ================= GENERATE TOKEN =================
		private string GenerateJwtToken(User user)
		{
			var claims = new[]
			{
				new Claim(ClaimTypes.Name, user.FullName),
				new Claim(ClaimTypes.Email, user.Email),
				new Claim(ClaimTypes.Role, user.Role)
			};

			var key = new SymmetricSecurityKey(
				Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));

			var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

			var token = new JwtSecurityToken(
				issuer: _configuration["Jwt:Issuer"],
				audience: _configuration["Jwt:Audience"],
				claims: claims,
				expires: DateTime.Now.AddMinutes(
					Convert.ToDouble(_configuration["Jwt:DurationInMinutes"])),
				signingCredentials: creds
			);

			return new JwtSecurityTokenHandler().WriteToken(token);
		}

		private bool IsValidPassword(string password)
		{
			var regex = new Regex(
				@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{6,}$"
			);
			return regex.IsMatch(password);
		}

		private string HashPassword(string password)
		{
			using (SHA256 sha256 = SHA256.Create())
			{
				var bytes = Encoding.UTF8.GetBytes(password);
				var hash = sha256.ComputeHash(bytes);
				return Convert.ToBase64String(hash);
			}
		}
	}
}
