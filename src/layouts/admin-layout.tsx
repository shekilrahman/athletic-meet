import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Award, LogOut, UserPlus } from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            navigate("/login");
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const menuItems = [
        { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
        { name: "Manage Resources", path: "/admin/resources", icon: Users },
        { name: "Events", path: "/admin/events", icon: Calendar },
        { name: "Requests", path: "/admin/requests", icon: UserPlus },
        { name: "Certificates", path: "/admin/certificates", icon: Award },
    ];

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-gray-800 border-r shadow-sm hidden md:flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-primary">UniSports Admin</h1>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {menuItems.map((item) => (
                        <Button
                            key={item.path}
                            variant={location.pathname === item.path ? "default" : "ghost"}
                            className={cn("w-full justify-start gap-2",
                                location.pathname === item.path ? "" : "text-muted-foreground"
                            )}
                            onClick={() => navigate(item.path)}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.name}
                        </Button>
                    ))}
                </nav>

                <div className="p-4 border-t">
                    <Button variant="ghost" className="w-full justify-start gap-2 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}
