import { useNavigate } from "react-router-dom";
import { Trophy, CalendarDays, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../components/auth-provider";

export default function StaffDashboard() {
    const navigate = useNavigate();
    const { logout } = useAuth();

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            <header className="px-6 py-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Staff Portal</h1>
                    <p className="text-sm text-muted-foreground">Manage events and results</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => logout()} className="text-muted-foreground">
                    <LogOut className="h-5 w-5" />
                </Button>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-md mx-auto w-full">

                {/* Events Button */}
                <button
                    onClick={() => navigate("/ontrack/events")}
                    className="w-full h-40 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group active:scale-95"
                >
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <CalendarDays className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-lg font-bold">Events</span>
                </button>

                {/* Scoreboard Button */}
                <button
                    onClick={() => navigate("/")}
                    className="w-full h-40 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group active:scale-95"
                >
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-lg font-bold">Scoreboard</span>
                </button>

            </main>
        </div>
    );
}
