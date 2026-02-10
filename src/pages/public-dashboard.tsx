import Scoreboard from "../components/scoreboard";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PublicDashboard() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-10">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center text-black dark:text-gray-100">
                    <div>
                        <h1 className="text-xl font-bold text-primary">UniSports Meet 2026</h1>
                        <p className="text-sm text-gray-500">Live Scoreboard</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
                        Staff Login
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Announcements / Status Banner */}
                <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded text-sm mb-4">
                    <p className="font-bold">Current Event:</p>
                    <p>100m Sprint (Men) - Final Round is starting soon.</p>
                </div>

                <Scoreboard />
            </main>
        </div>
    );
}
