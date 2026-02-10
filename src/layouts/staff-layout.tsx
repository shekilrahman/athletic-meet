import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Trophy, List } from "lucide-react";
import { Button } from "../components/ui/button";

export default function StaffLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
            <main className="flex-1">
                <Outlet />
            </main>

            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t flex justify-around p-2 shadow-lg z-50">
                <Button
                    variant={isActive('/ontrack/events') ? 'default' : 'ghost'}
                    className="flex flex-col items-center gap-1 h-auto py-2 flex-1 rounded-none active:scale-95 transition-transform"
                    onClick={() => navigate('/ontrack/events')}
                >
                    <List className="h-5 w-5" />
                    <span className="text-xs font-medium">Events</span>
                </Button>
                <div className="w-px bg-gray-200 dark:bg-gray-700 my-2"></div>
                <Button
                    variant={isActive('/') ? 'default' : 'ghost'}
                    className="flex flex-col items-center gap-1 h-auto py-2 flex-1 rounded-none active:scale-95 transition-transform"
                    onClick={() => navigate('/')}
                >
                    <Trophy className="h-5 w-5" />
                    <span className="text-xs font-medium">Scoreboard</span>
                </Button>
            </div>
        </div>
    );
}
