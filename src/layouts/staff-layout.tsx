import { Outlet } from "react-router-dom";

export default function StaffLayout() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}
