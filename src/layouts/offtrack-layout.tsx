import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { LayoutDashboard, Calendar, Users, Trophy, LogOut, Key } from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { ChangePasswordDialog } from "../components/change-password-dialog";

export default function OfftrackLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            navigate("/login");
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const menuItems = [
        { name: "Dashboard", path: "/offtrack", icon: LayoutDashboard },
        { name: "Events", path: "/offtrack/events", icon: Calendar },
        { name: "Participants", path: "/offtrack/participants", icon: Users },
        { name: "Results", path: "/offtrack/results", icon: Trophy },
    ];

    return (
        <div className="flex min-h-screen bg-gray-100">
            <ChangePasswordDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen} />
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r shadow-sm hidden md:flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-primary">Offtrack Staff</h1>
                    <p className="text-sm text-muted-foreground">Event Management</p>
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

                <div className="p-4 border-t space-y-2">
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setIsPasswordDialogOpen(true)}>
                        <Key className="h-4 w-4" />
                        Change Password
                    </Button>
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
