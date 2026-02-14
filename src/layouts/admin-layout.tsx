import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { LayoutDashboard, Users, Calendar, Award, LogOut, UserPlus, Settings, Menu, X, Key } from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { ChangePasswordDialog } from "../components/change-password-dialog";

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
        { name: "Programs", path: "/admin/programs", icon: Calendar },
        { name: "Events", path: "/admin/events", icon: Calendar },
        { name: "Requests", path: "/admin/requests", icon: UserPlus },
        { name: "Manage Resources", path: "/admin/resources", icon: Users },
        { name: "Certificates", path: "/admin/certificates", icon: Award },
        { name: "Settings", path: "/admin/settings", icon: Settings },
    ];

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
            <ChangePasswordDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen} />
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b flex items-center px-4 z-40">
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                    <Menu className="h-6 w-6" />
                </Button>
                <h1 className="ml-4 text-xl font-bold text-primary">UniSports Admin</h1>
            </div>

            {/* Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed md:sticky top-0 left-0 h-screen w-64 bg-white dark:bg-gray-800 border-r shadow-sm flex flex-col z-50 transition-transform duration-200 ease-in-out md:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 hidden md:block">
                    <h1 className="text-2xl font-bold text-primary">UniSports Admin</h1>
                </div>

                {/* Mobile close button inside sidebar */}
                <div className="p-4 md:hidden flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-0">
                    {menuItems.map((item) => (
                        <Button
                            key={item.path}
                            variant={location.pathname === item.path ? "default" : "ghost"}
                            className={cn("w-full justify-start gap-2",
                                location.pathname === item.path ? "" : "text-muted-foreground"
                            )}
                            onClick={() => {
                                navigate(item.path);
                                setIsSidebarOpen(false);
                            }}
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
            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto pt-20 md:pt-8">
                <Outlet />
            </main>
        </div>
    );
}
