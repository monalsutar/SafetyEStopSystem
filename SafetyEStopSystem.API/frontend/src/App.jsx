//import React from 'react';
//import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
//import { AuthProvider, useAuth } from './context/AuthContext';
//import { Toaster } from 'sonner';

//// Components
//import Login from './components/Auth/Login';
//import Register from './components/Auth/Register';
//import AdminDashboard from './components/Dashboard/AdminDashboard';
//import PublicEStop from './components/Public/PublicEStop';

//// Protected Route Component
//const ProtectedRoute = ({ children, allowedRoles }) => {
//  const { isAuthenticated, user, loading } = useAuth();

//  if (loading) {
//    return (
//      <div className="min-h-screen flex items-center justify-center">
//        <div className="text-2xl font-semibold text-gray-600">Loading...</div>
//      </div>
//    );
//  }

//  if (!isAuthenticated()) {
//    return <Navigate to="/login" replace />;
//  }

//  if (allowedRoles && !allowedRoles.some(role =>
//    user?.role?.toLowerCase() === role.toLowerCase()
//  )) {
//    return <Navigate to="/unauthorized" replace />;
//  }

//  return children;
//};

//function AppRoutes() {
//  return (
//    <Routes>
//      {/* Public Routes */}
//      <Route path="/login" element={<Login />} />
//      <Route path="/register" element={<Register />} />
//      <Route path="/public-estop" element={<PublicEStop />} />

//      {/* Protected Routes */}
//      <Route
//        path="/admin/dashboard"
//        element={
//          <ProtectedRoute allowedRoles={['Admin', 'admin']}>
//            <AdminDashboard />
//          </ProtectedRoute>
//        }
//      />

//      <Route
//        path="/supervisor/dashboard"
//        element={
//          <ProtectedRoute allowedRoles={['Supervisor', 'supervisor', 'Admin', 'admin']}>
//            <AdminDashboard />
//          </ProtectedRoute>
//        }
//      />

//      <Route
//        path="/operator/dashboard"
//        element={
//          <ProtectedRoute allowedRoles={['Operator', 'operator']}>
//            <AdminDashboard />
//          </ProtectedRoute>
//        }
//      />

//      {/* Unauthorized */}
//      <Route
//        path="/unauthorized"
//        element={
//          <div className="min-h-screen flex items-center justify-center bg-gray-50">
//            <div className="text-center">
//              <h1 className="text-4xl font-bold text-red-600 mb-4">403 - Unauthorized</h1>
//              <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
//              <a href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
//                Go back to login
//              </a>
//            </div>
//          </div>
//        }
//      />

//      {/* Default Route */}
//      <Route path="/" element={<Navigate to="/login" replace />} />
//      <Route path="*" element={<Navigate to="/login" replace />} />
//    </Routes>
//  );
//}

//function App() {
//  return (
//    <AuthProvider>
//      <BrowserRouter>
//        <Toaster position="top-right" richColors />
//        <AppRoutes />
//      </BrowserRouter>
//    </AuthProvider>
//  );
//}

//export default App;



//// src/App.jsx
//import React from 'react';
//import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
//import { AuthProvider, useAuth } from './context/AuthContext';
//import { Toaster } from 'sonner';

//// Components (based on your structure)
//import Login from './components/Auth/Login';
//import Register from './components/Auth/Register';
//import PublicEStop from './components/Public/PublicEStop';

//// Pages (dashboard lives under src/pages)
//import AdminDashboard from './pages/AdminDashboard';

//// Protected Route Component
//const ProtectedRoute = ({ children, allowedRoles }) => {
//    const { isAuthenticated, user, loading } = useAuth();

//    if (loading) {
//        return (
//            <div className="min-h-screen flex items-center justify-center">
//                <div className="text-2xl font-semibold text-gray-600">Loading...</div>
//            </div>
//        );
//    }

//    if (!isAuthenticated()) {
//        return <Navigate to="/login" replace />;
//    }

//    if (
//        allowedRoles &&
//        !allowedRoles.some((role) => user?.role?.toLowerCase() === role.toLowerCase())
//    ) {
//        return <Navigate to="/unauthorized" replace />;
//    }

//    return children;
//};

//function AppRoutes() {
//    return (
//        <Routes>
//            {/* Public Routes */}
//            <Route path="/login" element={<Login />} />
//            <Route path="/register" element={<Register />} />
//            <Route path="/public-estop" element={<PublicEStop />} />

//            {/* Protected Routes */}
//            <Route
//                path="/admin/dashboard"
//                element={
//                    <ProtectedRoute allowedRoles={['Admin', 'admin']}>
//                        <AdminDashboard />
//                    </ProtectedRoute>
//                }
//            />
//            <Route
//                path="/supervisor/dashboard"
//                element={
//                    <ProtectedRoute allowedRoles={['Supervisor', 'supervisor', 'Admin', 'admin']}>
//                        <AdminDashboard />
//                    </ProtectedRoute>
//                }
//            />
//            <Route
//                path="/operator/dashboard"
//                element={
//                    <ProtectedRoute allowedRoles={['Operator', 'operator']}>
//                        <AdminDashboard />
//                    </ProtectedRoute>
//                }
//            />

//            {/* Unauthorized */}
//            <Route
//                path="/unauthorized"
//                element={
//                    <div className="min-h-screen flex items-center justify-center bg-gray-50">
//                        <div className="text-center">
//                            <h1 className="text-4xl font-bold text-red-600 mb-4">403 - Unauthorized</h1>
//                            <p className="text-gray-600 mb-4">
//                                You don't have permission to access this page.
//                            </p>
//                            <a href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
//                                Go back to login
//                            </a>
//                        </div>
//                    </div>
//                }
//            />

//            {/* Default Route */}
//            <Route path="/" element={<Navigate to="/login" replace />} />
//            <Route path="*" element={<Navigate to="/login" replace />} />
//        </Routes>
//    );
//}

//function App() {
//    return (
//        <AuthProvider>
//            <BrowserRouter>
//                <Toaster position="top-right" richColors />
//                <AppRoutes />
//            </BrowserRouter>
//        </AuthProvider>
//    );
//}

//export default App;



// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';

// Components (based on your structure)
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import PublicEStop from './components/Public/PublicEStop';

// Pages (dashboard lives under src/pages)
import AdminDashboard from './pages/AdminDashboard';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-2xl font-semibold text-gray-600">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }

    if (
        allowedRoles &&
        !allowedRoles.some((role) => user?.role?.toLowerCase() === role.toLowerCase())
    ) {
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
};

function AppRoutes() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/public-estop" element={<PublicEStop />} />

            {/* Protected Routes */}
            <Route
                path="/admin/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['Admin', 'admin']}>
                        <AdminDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/supervisor/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['Supervisor', 'supervisor', 'Admin', 'admin']}>
                        <AdminDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/operator/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['Operator', 'operator']}>
                        <AdminDashboard />
                    </ProtectedRoute>
                }
            />

            {/* Unauthorized */}
            <Route
                path="/unauthorized"
                element={
                    <div className="min-h-screen flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold text-red-600 mb-4">403 - Unauthorized</h1>
                            <p className="text-gray-600 mb-4">
                                You don't have permission to access this page.
                            </p>
                            <a href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                                Go back to login
                            </a>
                        </div>
                    </div>
                }
            />

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

function App() {
    return (
        // BrowserRouter must wrap AuthProvider so useNavigate() works inside AuthContext
        <BrowserRouter>
            <AuthProvider>
                <Toaster position="top-right" richColors />
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;