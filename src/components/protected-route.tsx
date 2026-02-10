import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-provider';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
    allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { user, userProfile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
        // Redirect to appropriate dashboard based on role
        if (userProfile.role === 'admin') return <Navigate to="/admin" replace />;
        if (userProfile.role === 'staff') {
            // Redirect based on staff type
            if (userProfile.staffType === 'offtrack') return <Navigate to="/offtrack" replace />;
            return <Navigate to="/ontrack" replace />;
        }
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};
