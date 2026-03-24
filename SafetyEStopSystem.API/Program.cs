using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SafetyEStopSystem.API.Data;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ================= DATABASE =================
builder.Services.AddDbContext<ApplicationDbContext>(options =>
	options.UseSqlServer(
		builder.Configuration.GetConnectionString("DefaultConnection"),
		sqlServerOptions => sqlServerOptions.EnableRetryOnFailure(
			maxRetryCount: 5,
			maxRetryDelay: TimeSpan.FromSeconds(30),
			errorNumbersToAdd: null
		)
	));

// ================= JWT SETTINGS =================
var jwtKey = builder.Configuration["Jwt:Key"] ?? "THIS_IS_MY_SUPER_SECRET_KEY_12345";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "SafetyEStopSystem";

builder.Services.AddAuthentication(options =>
{
	options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
	options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
	options.RequireHttpsMetadata = false;
	options.SaveToken = true;

	options.TokenValidationParameters = new TokenValidationParameters
	{
		ValidateIssuer = true,
		ValidateAudience = false,
		ValidateLifetime = true,
		ValidateIssuerSigningKey = true,

		ValidIssuer = jwtIssuer,
		IssuerSigningKey = new SymmetricSecurityKey(
			Encoding.UTF8.GetBytes(jwtKey)),

		// Make role claims case-insensitive
		RoleClaimType = ClaimTypes.Role,
		NameClaimType = ClaimTypes.Name
	};
});

// ================= AUTHORIZATION =================
builder.Services.AddAuthorization(options =>
{
	options.AddPolicy("Admin", policy => 
		policy.RequireAssertion(context =>
			context.User.IsInRole("Admin") || context.User.IsInRole("admin")));

	options.AddPolicy("Supervisor", policy => 
		policy.RequireAssertion(context =>
			context.User.IsInRole("Supervisor") || context.User.IsInRole("supervisor")));

	options.AddPolicy("Operator", policy => 
		policy.RequireAssertion(context =>
			context.User.IsInRole("Operator") || context.User.IsInRole("operator")));

});

// ================= CORS =================
builder.Services.AddCors(options =>
{
	options.AddPolicy("AllowReactApp", policy =>
	{
		policy.WithOrigins("http://localhost:3000", "http://localhost:5173") // React default ports
			  .AllowAnyMethod()
			  .AllowAnyHeader()
			  .AllowCredentials();
	});
});

// ================= SERVICES =================
builder.Services.AddControllers()
	.AddJsonOptions(options =>
	{
		options.JsonSerializerOptions.ReferenceHandler =
			System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
	});
builder.Services.AddEndpointsApiExplorer();

// ================= SWAGGER WITH JWT =================
builder.Services.AddSwaggerGen(options =>
{
	options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
	{
		Name = "Authorization",
		Type = SecuritySchemeType.Http,
		Scheme = "Bearer",
		BearerFormat = "JWT",
		In = ParameterLocation.Header,
		Description = "Enter: Bearer {your JWT token}"
	});

	options.AddSecurityRequirement(new OpenApiSecurityRequirement
	{
		{
			new OpenApiSecurityScheme
			{
				Reference = new OpenApiReference
				{
					Type = ReferenceType.SecurityScheme,
					Id = "Bearer"
				}
			},
			new string[] {}
		}
	});
});

// ================= BUILD =================
var app = builder.Build();

// ================= START FRONTEND AUTOMATICALLY =================
if (app.Environment.IsDevelopment())
{
	// Start the frontend React app automatically
	var frontendPath = Path.Combine(Directory.GetCurrentDirectory(), "frontend");
	if (Directory.Exists(frontendPath))
	{
		Task.Run(() =>
		{
			try
			{
				var processInfo = new System.Diagnostics.ProcessStartInfo
				{
					FileName = "cmd.exe",
					Arguments = "/c npm run dev",
					WorkingDirectory = frontendPath,
					UseShellExecute = true,
					CreateNoWindow = false
				};
				System.Diagnostics.Process.Start(processInfo);
				Console.WriteLine("Frontend started automatically on http://localhost:3000");
			}
			catch (Exception ex)
			{
				Console.WriteLine($"Failed to start frontend: {ex.Message}");
			}
		});
	}
}

// ================= PIPELINE =================
if (app.Environment.IsDevelopment())
{
	app.UseSwagger();
	app.UseSwaggerUI();
}

app.UseCors("AllowReactApp");  // 🔥 Enable CORS

app.UseHttpsRedirection();

app.UseAuthentication();   // 🔥 IMPORTANT
app.UseAuthorization();

app.MapControllers();

app.Run();

