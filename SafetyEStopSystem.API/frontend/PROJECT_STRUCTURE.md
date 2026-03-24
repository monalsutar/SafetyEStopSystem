# 📁 Complete Project Structure

```
SafetyEstop/
│
├── SafetyEStopSystem.API/                    # .NET Backend API
│   ├── Controllers/
│   │   ├── AuthController.cs                 # Login/Register endpoints
│   │   └── StationController.cs              # Station & Incident management
│   ├── Data/
│   │   └── ApplicationDbContext.cs           # EF Core DbContext
│   ├── Models/
│   │   ├── User.cs                           # User model
│   │   ├── Station.cs                        # Station model
│   │   ├── Incident.cs                       # Incident model
│   │   └── AuditLog.cs                       # Audit log model
│   ├── DTOs/
│   │   ├── LoginRequest.cs                   # Login DTO
│   │   └── CreateStationDto.cs               # Create station DTO
│   ├── Migrations/                           # EF Core migrations
│   ├── Program.cs                            # Main entry point with CORS
│   ├── appsettings.json                      # Configuration & connection string
│   └── SafetyEStopSystem.API.csproj
│
└── frontend/                                  # React Frontend
    ├── public/
    │   └── vite.svg
    │
    ├── src/
    │   ├── api/
    │   │   └── apiService.js                 # 🔌 API calls & Axios config
    │   │
    │   ├── components/
    │   │   ├── Auth/
    │   │   │   ├── Login.jsx                 # 🔐 Login page
    │   │   │   └── Register.jsx              # ✍️ Registration page
    │   │   │
    │   │   ├── Dashboard/
    │   │   │   └── AdminDashboard.jsx        # 📊 Main dashboard
    │   │   │
    │   │   ├── Layout/
    │   │   │   └── Navbar.jsx                # 🧭 Navigation bar
    │   │   │
    │   │   └── Public/
    │   │       └── PublicEStop.jsx           # 🚨 Public E-Stop button
    │   │
    │   ├── context/
    │   │   └── AuthContext.jsx               # 🔑 Authentication context
    │   │
    │   ├── App.jsx                           # 🚀 Main app with routing
    │   ├── main.jsx                          # ⚡ Entry point
    │   └── index.css                         # 🎨 Global styles (Tailwind)
    │
    ├── index.html                            # HTML template
    ├── package.json                          # 📦 Dependencies
    ├── vite.config.js                        # ⚙️ Vite configuration
    ├── tailwind.config.js                    # 🎨 TailwindCSS config
    ├── postcss.config.js                     # PostCSS config
    ├── README.md                             # 📖 Detailed documentation
    └── QUICKSTART.md                         # 🚀 Quick start guide
```

## 🎯 Key Files & Their Purpose

### Backend (C# .NET 8)

| File | Purpose |
|------|---------|
| `AuthController.cs` | Handles user registration and JWT login |
| `StationController.cs` | Manages stations, E-Stop button, incidents |
| `ApplicationDbContext.cs` | Database context with Users, Stations, Incidents |
| `Program.cs` | **CORS enabled for React frontend** |
| `appsettings.json` | Connection string to SQL Server |

### Frontend (React + Vite)

| File | Purpose |
|------|---------|
| `apiService.js` | All API calls to backend with axios |
| `Login.jsx` | Beautiful login form with validation |
| `Register.jsx` | User registration with role selection |
| `AdminDashboard.jsx` | Main dashboard with stats, incidents, stations |
| `PublicEStop.jsx` | **Public E-Stop button (no login required)** |
| `Navbar.jsx` | Top navigation with user info and logout |
| `AuthContext.jsx` | Global auth state management |
| `App.jsx` | Routing and protected routes |
| `index.css` | TailwindCSS styles and custom animations |

## 🔄 Data Flow

```
User Action → React Component → apiService.js → Backend API → Database
                                        ↓
User Sees Result ← React Component ← Response ← Backend API ← Database
```

## 🎨 Color Scheme

- **Primary Blue**: `#1e40af` - Headers, buttons, links
- **Danger Red**: `#dc2626` - E-Stop button, alerts
- **Success Green**: `#16a34a` - Success messages, active status
- **Warning Orange**: `#ea580c` - Warnings, acknowledgments

## 📊 Database Tables

```sql
Users
├── Id (PK)
├── FullName
├── EmployeeId
├── Email
├── Password (Hashed)
└── Role

Stations
├── Id (PK)
├── Name
├── Location
└── IsActive

Incidents
├── Id (PK)
├── StationId (FK)
├── TriggeredBy
├── TriggeredAt
├── Status (Open/Acknowledged/Closed)
├── ClosedAt
└── DurationMinutes

AuditLogs
├── Id (PK)
├── Action
├── PerformedBy
└── TimeStamp
```

## 🚀 How Components Connect

### Login Flow:
```
Login.jsx → authAPI.login() → AuthController.Login() 
    → Returns JWT token → Stored in AuthContext → User redirected to dashboard
```

### E-Stop Flow:
```
PublicEStop.jsx → stationAPI.pressEStop() → StationController.PressEStop()
    → Creates Incident → Visible in AdminDashboard.jsx
```

### Create Station Flow:
```
AdminDashboard.jsx → stationAPI.create() → StationController.CreateStation()
    → Saves to DB → Refreshes station list
```

## 🔐 Authentication Flow

1. User logs in → Backend validates credentials
2. Backend generates JWT token
3. Frontend stores token in localStorage
4. All subsequent API calls include token in header
5. Backend validates token on protected endpoints

## 📱 Responsive Breakpoints

- **Mobile**: 320px - 767px
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px+

All components are fully responsive!

---

**Ready to start? Follow the QUICKSTART.md guide!** 🎉
