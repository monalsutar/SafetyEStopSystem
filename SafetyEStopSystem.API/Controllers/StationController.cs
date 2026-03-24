
using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafetyEStopSystem.API.Data;
using SafetyEStopSystem.API.DTOs;
using SafetyEStopSystem.API.Models;

namespace SafetyEStopSystem.API.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	[Authorize]
	public class StationController : ControllerBase
	{
		private readonly ApplicationDbContext _context;

		private static readonly TimeZoneInfo IST = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");


		public StationController(ApplicationDbContext context)
		{
			_context = context;
		}

		private bool IsSqlServer() =>
			_context.Database.ProviderName?.IndexOf("SqlServer", StringComparison.OrdinalIgnoreCase) >= 0;

		// ADMIN - CREATE STATION

		[Authorize(Roles = "Admin,admin")]
		[HttpPost("create-station")]
		public async Task<IActionResult> CreateStation([FromBody] CreateStationDto dto)
		{
			if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
				return BadRequest("Station name is required.");

			var exists = await _context.Stations
				.AnyAsync(s => s.Name.ToLower() == dto.Name.ToLower());

			if (exists)
				return BadRequest("Station with same name already exists.");

			var station = new Station
			{
				Name = dto.Name.Trim(),
				Location = dto.Location?.Trim(),
				IsActive = true
			};

			await _context.Stations.AddAsync(station);
			await _context.SaveChangesAsync();

			return Ok(new
			{
				message = "Station created successfully",
				stationId = station.Id
			});
		}

 
		// VIEW ALL STATIONS
 
		[Authorize(Roles = "Admin,admin,Supervisor,supervisor,Operator,operator")]
		[HttpGet("stations")]
		public async Task<IActionResult> GetStations()
		{
			var stations = await _context.Stations
				.OrderBy(s => s.Name)
				.ToListAsync();

			return Ok(stations);
		}

 
		// ADMIN - UPDATE STATION
 
		[Authorize(Roles = "Admin,admin")]
		[HttpPut("update-station/{id}")]
		public async Task<IActionResult> UpdateStation(int id, [FromBody] CreateStationDto dto)
		{
			var station = await _context.Stations.FindAsync(id);
			if (station == null)
				return NotFound("Station not found.");

			if (string.IsNullOrWhiteSpace(dto.Name))
				return BadRequest("Station name is required.");

			// Check if another station has the same name
			var exists = await _context.Stations
				.AnyAsync(s => s.Name.ToLower() == dto.Name.ToLower() && s.Id != id);
			if (exists)
				return BadRequest("Another station with same name already exists.");

			station.Name = dto.Name.Trim();
			station.Location = dto.Location?.Trim();

			await _context.AuditLogs.AddAsync(new AuditLog
			{
				Action = $"Station {station.Name} updated",
				PerformedBy = User.Identity?.Name ?? "Unknown",
				TimeStamp = DateTime.UtcNow
			});

			await _context.SaveChangesAsync();

			return Ok(new
			{
				message = "Station updated successfully",
				station
			});
		}

 
		// ADMIN - DELETE STATION 
 
		[Authorize(Roles = "Admin,admin")]
		[HttpDelete("delete-station/{id}")]
		public async Task<IActionResult> DeleteStation(int id)
		{
			var station = await _context.Stations.FindAsync(id);
			if (station == null)
				return NotFound("Station not found.");

			// Block deletion if ANY incidents exist for this station
			bool hasAnyHistory = await _context.Incidents.AnyAsync(i => i.StationId == id);
			if (hasAnyHistory)
				return Conflict(new { message = "Station has historical events and cannot be deleted." });

			await _context.AuditLogs.AddAsync(new AuditLog
			{
				Action = $"Station {station.Name} deleted",
				PerformedBy = User.Identity?.Name ?? "Unknown",
				TimeStamp = DateTime.UtcNow
			});

			_context.Stations.Remove(station);
			await _context.SaveChangesAsync();

			return Ok("Station deleted successfully");
		}

	
 
		//  ADMIN - TOGGLE STATION STATUS
 
		[Authorize(Roles = "Admin,admin")]
		[HttpPut("toggle-station-status/{id}")]
		public async Task<IActionResult> ToggleStationStatus(int id)
		{
			var station = await _context.Stations.FindAsync(id);
			if (station == null) return NotFound("Station not found.");

			var tryingToActivate = station.IsActive == false;

			if (tryingToActivate)
			{
				// Block activation if there is an OPEN incident (Waiting for Ack)
				var hasOpen = await _context.Incidents
					.AnyAsync(i => i.StationId == id && i.Status == "Open");

				if (hasOpen)
				{
					return BadRequest("Station cannot be activated while incident is waiting for acknowledgement.");
				}
			}

			station.IsActive = !station.IsActive;

			await _context.AuditLogs.AddAsync(new AuditLog
			{
				Action = $"Station {station.Name} {(station.IsActive ? "activated" : "deactivated")}",
				PerformedBy = User.Identity?.Name ?? "Unknown",
				TimeStamp = DateTime.UtcNow
			});

			await _context.SaveChangesAsync();

			return Ok(new
			{
				message = $"Station {(station.IsActive ? "activated" : "deactivated")} successfully",
				isActive = station.IsActive
			});
		}


 
		//  PUBLIC - GET ACTIVE STATIONS FOR E-STOP
 
		[AllowAnonymous]
		[HttpGet("active-stations")]
		public async Task<IActionResult> GetActiveStations()
		{
			var activeStations = await _context.Stations
				.Where(s => s.IsActive)
				.OrderBy(s => s.Name)
				.Select(s => new
				{
					s.Id,
					s.Name,
					s.Location,
					s.IsActive
				})
				.ToListAsync();

			return Ok(activeStations);
		}

		[AllowAnonymous]
		[HttpGet("public-stations")]
		public async Task<IActionResult> GetPublicStations()
		{
			var stations = await _context.Stations
				.OrderBy(s => s.Name)
				.Select(s => new
				{
					s.Id,
					s.Name,
					s.Location,
					s.IsActive
				})
				.ToListAsync();

			return Ok(stations);
		}


		[AllowAnonymous]
		[HttpGet("public-open-incidents")]
		public async Task<IActionResult> GetPublicOpenIncidents([FromQuery] int? stationId = null)
		{
			var query = _context.Incidents
				.Include(i => i.Station)
				.Where(i => i.Status != "Closed"); // include Open/Acknowledged/Reset

			if (stationId.HasValue)
			{
				query = query.Where(i => i.StationId == stationId.Value);
			}

			var list = await query
				.OrderByDescending(i => i.TriggeredAt)
				.Select(i => new
				{
					Id = i.Id,
					Status = i.Status,
					TriggeredAt = i.TriggeredAt,
					Station = new { Id = i.StationId, Name = i.Station.Name }
				})
				.ToListAsync();

			return Ok(list);
		}



		//  PUBLIC - PRESS E-STOP 

		// PUBLIC - PRESS E-STOP
		[AllowAnonymous]
		[HttpPost("press-estop")]
		public async Task<IActionResult> PressEStop([FromQuery] int stationId)
		{
			var station = await _context.Stations.FindAsync(stationId);
			if (station == null) return NotFound("Station not found.");

			// Prevent duplicate open incident
			var alreadyOpen = await _context.Incidents.AnyAsync(i => i.StationId == stationId && i.Status == "Open");
			if (alreadyOpen)
			{
				return Conflict(new { message = "An incident is already OPEN for this station." });
			}

			// Public trigger: do not attribute to any user identity
			var incident = new Incident
			{
				StationId = station.Id,
				TriggeredBy = "Public", // or set to null if you prefer to hide it entirely
				TriggeredAt = DateTimeOffset.UtcNow,
				Status = "Open"
			};

			await _context.Incidents.AddAsync(incident);
			await _context.AuditLogs.AddAsync(new AuditLog
			{
				Action = $"E-Stop pressed on Station {station.Name}",
				PerformedBy = "Public",
				TimeStamp = DateTime.UtcNow
			});

			await _context.SaveChangesAsync();
			return Ok(new
			{
				message = "E-Stop Activated Successfully",
				incidentId = incident.Id,
			});
		}
		//  VIEW ACTIVE ALERTS

		[Authorize(Roles = "Operator,operator,Supervisor,supervisor,Admin,admin")]
		[HttpGet("alerts")]
		public async Task<IActionResult> ViewAlerts()
		{
			var openIncidents = await _context.Incidents
				.Include(i => i.Station)
				.Where(i => i.Status == "Open")
				.OrderByDescending(i => i.TriggeredAt)
				.ToListAsync();

			return Ok(openIncidents);
		}


		//  SUPERVISOR/ADMIN - ACKNOWLEDGE

		// NEW
		// SUPERVISOR/ADMIN - ACKNOWLEDGE
		[Authorize(Roles = "Supervisor,supervisor,Admin,admin")]
		[HttpPost("acknowledge")]
		public async Task<IActionResult> Acknowledge(
			[FromQuery] int incidentId,
			[FromBody] AcknowledgeIncidentDto? body  // optional JSON
		)
		{
			var incident = await _context.Incidents.FindAsync(incidentId);
			if (incident == null)
				return NotFound("Incident not found.");

			// Validate: "Issue was about?" is now mandatory
			if (body == null || string.IsNullOrWhiteSpace(body.Issue))
				return BadRequest("Please specify what the issue was about.");

			if (!incident.AcknowledgedAt.HasValue)
			{
				incident.AcknowledgedAt = DateTimeOffset.UtcNow;
				incident.AcknowledgedBy = User.Identity?.Name;
			}

			// Save optional ack comment
			if (!string.IsNullOrWhiteSpace(body?.Comment))
				incident.AckComment = body!.Comment!.Trim();

			// Save required issue + optional ack comment
			incident.AckIssue = body.Issue.Trim();
			if (!string.IsNullOrWhiteSpace(body.Comment))
				incident.AckComment = body.Comment.Trim();

			// Move to Acknowledged
			incident.Status = "Acknowledged";

			// Duration until ACK
			incident.DurationMinutes = (incident.AcknowledgedAt.Value - incident.TriggeredAt).TotalMinutes;

			await _context.AuditLogs.AddAsync(new AuditLog
			{
				Action = $"Incident {incidentId} acknowledged",
				PerformedBy = User.Identity?.Name ?? "Unknown",
				TimeStamp = DateTime.UtcNow
			});

			await _context.SaveChangesAsync();
			return Ok("Incident Acknowledged Successfully");
		}


		//  SUPERVISOR/ADMIN - CLOSE 

		// SUPERVISOR/ADMIN - CLOSE
		[Authorize(Roles = "Supervisor,supervisor,Admin,admin")]
		[HttpPost("close-incident")]
		public async Task<IActionResult> CloseIncident(
			[FromQuery] int incidentId,
			[FromBody] CloseIncidentDto? body
		)
		{
			var incident = await _context.Incidents.FindAsync(incidentId);
			if (incident == null)
				return NotFound("Incident not found.");

			// Optional close comment
			if (!string.IsNullOrWhiteSpace(body?.Comment))
				incident.CloseComment = body.Comment.Trim();

			if (!incident.ClosedAt.HasValue)
				incident.ClosedAt = DateTimeOffset.UtcNow;

			incident.ClosedBy = User.Identity?.Name;
			incident.Status = "Closed";

			// Persist answers from popup
			incident.IsResolved = true; // mandatory YES
			if (!string.IsNullOrWhiteSpace(body.Comment))
				incident.CloseComment = body.Comment!.Trim();

			// Duration (trigger -> close)
			incident.DurationMinutes = (incident.ClosedAt.Value - incident.TriggeredAt).TotalMinutes;

			await _context.AuditLogs.AddAsync(new AuditLog
			{
				Action = $"Incident {incidentId} closed",
				PerformedBy = User.Identity?.Name ?? "Unknown",
				TimeStamp = DateTime.UtcNow
			});

			await _context.SaveChangesAsync();
			return Ok("Incident Closed Successfully");
		}



		//  ADMIN DASHBOARD - STATISTICS

		[Authorize(Roles = "Admin,admin,Supervisor,supervisor,Operator,operator")]
		[HttpGet("dashboard-stats")]
		public async Task<IActionResult> GetDashboardStats()
		{
			var totalStations = await _context.Stations.CountAsync();
			var activeStations = await _context.Stations.CountAsync(s => s.IsActive);

			var totalIncidents = await _context.Incidents.CountAsync();
			var openIncidents = await _context.Incidents.CountAsync(i => i.Status == "Open");
			var closedIncidents = await _context.Incidents.CountAsync(i => i.Status == "Closed");
			var resetIncidents = await _context.Incidents.CountAsync(i => i.Status == "Reset");
			var acknowledgedIncidents = await _context.Incidents.CountAsync(i => i.Status == "Acknowledged");

			return Ok(new
			{
				TotalStations = totalStations,
				ActiveStations = activeStations,
				TotalIncidents = totalIncidents,
				OpenIncidents = openIncidents,
				ClosedIncidents = closedIncidents,
				ResetIncidents = resetIncidents,
				AcknowledgedIncidents = acknowledgedIncidents
			});
		}

 
		//  RECENT INCIDENTS with Durations
 
		[Authorize(Roles = "Admin,admin,Supervisor,supervisor,Operator,operator")]
		[HttpGet("recent-incidents")]
		public async Task<IActionResult> GetRecentIncidents([FromQuery] int take = 5)
		{
			take = Math.Clamp(take, 1, 100);

			if (IsSqlServer())
			{
				var items = await _context.Incidents
					.Include(i => i.Station)
					.OrderByDescending(i => i.TriggeredAt)
					.Take(take)
					.Select(i => new
					{
						StationName = i.Station.Name,
						i.TriggeredBy,
						i.TriggeredAt,
						i.Status,
						AcknowledgedAt = i.AcknowledgedAt,
						ClosedAt = i.ClosedAt,
						TimeToAcknowledgeSeconds = i.AcknowledgedAt.HasValue
							? (int?)EF.Functions.DateDiffSecond(i.TriggeredAt, i.AcknowledgedAt.Value)
							: null,
						TimeToCloseSeconds = i.ClosedAt.HasValue
							? (int?)EF.Functions.DateDiffSecond(i.TriggeredAt, i.ClosedAt.Value)
							: null,
						Station = new { i.Station.Id, i.Station.Name, i.Station.Location }
					})
					.ToListAsync();

				return Ok(items);
			}
			else
			{
				var list = await _context.Incidents
					.Include(i => i.Station)
					.OrderByDescending(i => i.TriggeredAt)
					.Take(take)
					.ToListAsync();

				var items = list.Select(i => new
				{
					StationName = i.Station.Name,
					i.TriggeredBy,
					i.TriggeredAt,
					i.Status,
					AcknowledgedAt = i.AcknowledgedAt,
					ClosedAt = i.ClosedAt,
					TimeToAcknowledgeSeconds = i.AcknowledgedAt.HasValue ? (int?)(i.AcknowledgedAt.Value - i.TriggeredAt).TotalSeconds : null,
					TimeToCloseSeconds = i.ClosedAt.HasValue ? (int?)(i.ClosedAt.Value - i.TriggeredAt).TotalSeconds : null,
					Station = new { i.Station.Id, i.Station.Name, i.Station.Location }
				}).ToList();

				return Ok(items);
			}
		}

 
		//  ALL INCIDENTS with Durations 
 
		[Authorize(Roles = "Admin,admin,Supervisor,supervisor")]
		[HttpGet("incidents")]
		public async Task<IActionResult> GetIncidents([FromQuery] string? status)
		{
			var baseQuery = _context.Incidents
				.Include(i => i.Station)
				.AsQueryable();

			if (!string.IsNullOrWhiteSpace(status))
			{
				var s = status.Trim().ToLower();
				baseQuery = baseQuery.Where(i => i.Status.ToLower() == s);
			}

			if (IsSqlServer())
			{
				var items = await baseQuery
					.OrderByDescending(i => i.TriggeredAt)
					.Select(i => new IncidentDto
					{
						Id = i.Id,
						Status = i.Status,
						TriggeredAt = i.TriggeredAt,
						AcknowledgedAt = i.AcknowledgedAt,
						ClosedAt = i.ClosedAt,
						Station = new { i.Station.Id, i.Station.Name, i.Station.Location },
						TimeToAcknowledgeSeconds = i.AcknowledgedAt.HasValue
							? (int?)EF.Functions.DateDiffSecond(i.TriggeredAt, i.AcknowledgedAt.Value)
							: null,
						TimeToCloseSeconds = i.ClosedAt.HasValue
							? (int?)EF.Functions.DateDiffSecond(i.TriggeredAt, i.ClosedAt.Value)
							: null
					})
					.ToListAsync();

				return Ok(items);
			}
			else
			{
				var list = await baseQuery
					.OrderByDescending(i => i.TriggeredAt)
					.ToListAsync();

				var items = list.Select(i => new IncidentDto
				{
					Id = i.Id,
					Status = i.Status,
					TriggeredAt = i.TriggeredAt,
					AcknowledgedAt = i.AcknowledgedAt,
					ClosedAt = i.ClosedAt,
					Station = new { i.Station.Id, i.Station.Name, i.Station.Location },
					TimeToAcknowledgeSeconds = i.AcknowledgedAt.HasValue ? (int?)(i.AcknowledgedAt.Value - i.TriggeredAt).TotalSeconds : null,
					TimeToCloseSeconds = i.ClosedAt.HasValue ? (int?)(i.ClosedAt.Value - i.TriggeredAt).TotalSeconds : null
				}).ToList();

				return Ok(items);
			}
		}

 
		//  MONTHLY REPORT 
 
		[Authorize(Roles = "Admin,admin,Supervisor,supervisor")]
		[HttpGet("monthly-report")]
		public async Task<IActionResult> GetMonthlyReport(int month, int year)
		{
			var incidents = await _context.Incidents
				.Where(i => i.TriggeredAt.Month == month &&
							i.TriggeredAt.Year == year)
				.ToListAsync();

			var report = new
			{
				TotalIncidents = incidents.Count,
				Open = incidents.Count(i => i.Status == "Open"),
				Closed = incidents.Count(i => i.Status == "Closed"),
				Reset = incidents.Count(i => i.Status == "Reset"),
				AverageDurationMinutes = incidents
					.Where(i => i.DurationMinutes != null)
					.DefaultIfEmpty()
					.Average(i => i?.DurationMinutes ?? 0)
			};

			return Ok(report);
		}

 
		//  STATION-WISE REPORT 
 
		[Authorize(Roles = "Admin,admin,Supervisor,supervisor")]
		[HttpGet("station-report")]
		public async Task<IActionResult> GetStationReport(int? stationId, int? month, int? year)
		{
			var query = _context.Incidents
				.Include(i => i.Station)
				.AsQueryable();

			if (stationId.HasValue)
			{
				query = query.Where(i => i.StationId == stationId.Value);
			}

			if (month.HasValue && year.HasValue)
			{
				query = query.Where(i => i.TriggeredAt.Month == month.Value &&
										 i.TriggeredAt.Year == year.Value);
			}

			var incidents = await query.ToListAsync();

			var stationReports = incidents
				.GroupBy(i => new { i.StationId, i.Station.Name })
				.Select(g => new
				{
					StationId = g.Key.StationId,
					StationName = g.Key.Name,
					TotalIncidents = g.Count(),
					OpenIncidents = g.Count(i => i.Status == "Open"),
					ClosedIncidents = g.Count(i => i.Status == "Closed"),
					ResetIncidents = g.Count(i => i.Status == "Reset"),
					AverageDurationMinutes = g
						.Where(i => i.DurationMinutes != null)
						.DefaultIfEmpty()
						.Average(i => i?.DurationMinutes ?? 0),
					Incidents = g.OrderByDescending(i => i.TriggeredAt).ToList()
				})
				.ToList();

			return Ok(stationReports);
		}

 
		//  CHART DATA 
 
		[Authorize(Roles = "Admin,admin,Supervisor,supervisor,Operator,operator")]
		[HttpGet("chart-data")]
		public async Task<IActionResult> GetChartData()
		{

			var last30Days = DateTimeOffset.UtcNow.AddDays(-30);


			var data = await _context.Incidents
				.Where(i => i.TriggeredAt >= last30Days)
				.GroupBy(i => i.TriggeredAt.Date)
				.Select(g => new
				{
					Date = g.Key,
					Count = g.Count()
				})
				.OrderBy(x => x.Date)
				.ToListAsync();

			return Ok(data);
		}


		// DOWNLOAD REPORT
		[Authorize(Roles = "Admin,admin,Supervisor,supervisor")]
		[HttpGet("download-report")]
		public async Task<IActionResult> DownloadReport(
			[FromQuery] int? stationId,
			[FromQuery] int? fromYear,
			[FromQuery] int? fromMonth,
			[FromQuery] int? toYear,
			[FromQuery] int? toMonth,
			[FromQuery] string fromDate,
			[FromQuery] string toDate)
		{
			IQueryable<Incident> query = _context.Incidents.Include(i => i.Station);
			string fileLabel = "AllStations";

			if (stationId.HasValue)
			{
				var station = await _context.Stations.FindAsync(stationId.Value);
				if (station == null) return NotFound("Station not found.");

				fileLabel = station.Name.Replace(" ", "_");
				query = query.Where(i => i.StationId == stationId.Value);
			}

			// Build date range (IST -> UTC)
			var istZone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");

			DateTime? startLocal = null;
			DateTime? endLocal = null;

			if (!string.IsNullOrWhiteSpace(fromDate) &&
				DateTime.TryParseExact(fromDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fromDay))
			{
				startLocal = fromDay.Date;
			}

			if (!string.IsNullOrWhiteSpace(toDate) &&
				DateTime.TryParseExact(toDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var toDay))
			{
				// inclusive end of day
				endLocal = toDay.Date.AddDays(1).AddTicks(-1);
			}

			if (startLocal == null && fromYear.HasValue && fromMonth.HasValue)
			{
				startLocal = new DateTime(fromYear.Value, fromMonth.Value, 1, 0, 0, 0);
			}

			if (endLocal == null && toYear.HasValue && toMonth.HasValue)
			{
				var lastDay = DateTime.DaysInMonth(toYear.Value, toMonth.Value);
				endLocal = new DateTime(toYear.Value, toMonth.Value, lastDay, 23, 59, 59, 999);
			}

			DateTimeOffset? startUtc = null;
			DateTimeOffset? endUtc = null;

			if (startLocal.HasValue)
			{
				var sUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(startLocal.Value, DateTimeKind.Unspecified), istZone);
				startUtc = new DateTimeOffset(sUtc, TimeSpan.Zero);
			}

			if (endLocal.HasValue)
			{
				var eUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(endLocal.Value, DateTimeKind.Unspecified), istZone);
				endUtc = new DateTimeOffset(eUtc, TimeSpan.Zero);
			}

			if (startUtc.HasValue)
				query = query.Where(i => i.TriggeredAt >= startUtc.Value);
			if (endUtc.HasValue)
				query = query.Where(i => i.TriggeredAt <= endUtc.Value);

			var incidents = await query
				.OrderByDescending(i => i.TriggeredAt)
				.ToListAsync();

			if (incidents.Count == 0)
			{
				return BadRequest("No incidents found for the selected filter.");
			}

			using var workbook = new XLWorkbook();
			var worksheet = workbook.Worksheets.Add("Incidents");

			// Header
			worksheet.Cell(1, 1).Value = "Station";
			worksheet.Cell(1, 2).Value = "Triggered At (IST)";
			worksheet.Cell(1, 3).Value = "Acknowledged At (IST)";
			worksheet.Cell(1, 4).Value = "Acknowledged By";
			worksheet.Cell(1, 5).Value = "Closed At (IST)";
			worksheet.Cell(1, 6).Value = "Closed By";
			worksheet.Cell(1, 7).Value = "Status";
			worksheet.Cell(1, 8).Value = "Duration (Minutes)";


			worksheet.Cell(1, 9).Value = "Ack Issue";
			worksheet.Cell(1, 10).Value = "Ack Comment";
			worksheet.Cell(1, 11).Value = "Close Comment";
			

			// ----- Header styling (make it stand out) -----
			var lastCol = 11; // we have 8 columns
			var headerRange = worksheet.Range(1, 1, 1, lastCol);

			// Colors: pick a brand color you like
			var headerBg = XLColor.FromHtml("#1F2937"); // gray-800
			var headerFg = XLColor.White;

			headerRange.Style.Font.Bold = true;
			headerRange.Style.Font.FontColor = headerFg;
			headerRange.Style.Fill.BackgroundColor = headerBg;
			headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
			headerRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
			headerRange.Style.Alignment.WrapText = true;

			// Simulate "padding": increase row height so text has breathing room
			worksheet.Row(1).Height = 24;

			// Add a bottom border to separate header from data
			headerRange.Style.Border.BottomBorder = XLBorderStyleValues.Medium;
			headerRange.Style.Border.BottomBorderColor = XLColor.FromHtml("#9CA3AF"); // gray-400

			// Freeze the header row and add AutoFilter on it
			worksheet.SheetView.FreezeRows(1);
			//headerRange.SetAutoFilter();

			// ----- Row background by Station Group -----
			// Map your groups to colors. Adjust names/colors as needed.
			



			for (int i = 0; i < incidents.Count; i++)
			{
				var row = i + 2;
				var it = incidents[i];

				worksheet.Cell(row, 1).Value = it.Station?.Name ?? "-";

				worksheet.Cell(row, 2).Value = TimeZoneInfo.ConvertTimeFromUtc(it.TriggeredAt.UtcDateTime, istZone);

				if (it.AcknowledgedAt.HasValue)
					worksheet.Cell(row, 3).Value = TimeZoneInfo.ConvertTimeFromUtc(it.AcknowledgedAt.Value.UtcDateTime, istZone);
				else
					worksheet.Cell(row, 3).Value = string.Empty;

				worksheet.Cell(row, 4).Value = it.AcknowledgedBy ?? string.Empty;

				if (it.ClosedAt.HasValue)
					worksheet.Cell(row, 5).Value = TimeZoneInfo.ConvertTimeFromUtc(it.ClosedAt.Value.UtcDateTime, istZone);
				else
					worksheet.Cell(row, 5).Value = string.Empty;

				worksheet.Cell(row, 6).Value = it.ClosedBy ?? string.Empty;

				worksheet.Cell(row, 7).Value = it.Status ?? "-";
				worksheet.Cell(row, 8).Value = it.DurationMinutes ?? 0;

				// NEW fields
				worksheet.Cell(row, 9).Value = it.AckIssue ?? string.Empty;
				worksheet.Cell(row, 10).Value = it.AckComment ?? string.Empty;
				worksheet.Cell(row, 11).Value = it.CloseComment ?? string.Empty;
			}

			var dateFormat = "yyyy-mm-dd hh:mm:ss";
			worksheet.Column(2).Style.DateFormat.Format = dateFormat; // Triggered At
			worksheet.Column(3).Style.DateFormat.Format = dateFormat; // Acknowledged At
			worksheet.Column(5).Style.DateFormat.Format = dateFormat; // Closed At

			worksheet.Columns().AdjustToContents();



			using var stream = new MemoryStream();
			workbook.SaveAs(stream);
			stream.Position = 0;

			string rangePart;
			if (!string.IsNullOrWhiteSpace(fromDate) || !string.IsNullOrWhiteSpace(toDate))
			{
				rangePart = $"{fromDate ?? "from"}_to_{toDate ?? "to"}";
			}
			else if (fromYear.HasValue && fromMonth.HasValue && toYear.HasValue && toMonth.HasValue)
			{
				rangePart = $"{fromYear}-{fromMonth:00}_to_{toYear}-{toMonth:00}";
			}
			else
			{
				rangePart = "AllDates";
			}

			var fileName = $"IncidentReport_{fileLabel}_{rangePart}_{DateTime.UtcNow:yyyyMMdd_HHmm}.xlsx";
			return File(stream.ToArray(),
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				fileName);
		}


		// StationController.cs
		[Authorize(Roles = "Admin,admin,Supervisor,supervisor,Operator,operator")]
		[HttpGet("station-status")]
		public async Task<IActionResult> GetStationStatus()
		{
			var statuses = await _context.Stations
				.OrderBy(s => s.Name)
				.Select(s => new
				{
					s.Id,
					s.Name,
					s.Location,
					s.IsActive
				})
				.ToListAsync();

			return Ok(statuses);
		}

	}
}
