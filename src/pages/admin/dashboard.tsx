import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Users, Calendar, Trophy, Activity, Settings, Download, UserPlus, Loader2 } from "lucide-react";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { getSiteSettings, updateSiteSetting, type SiteSettings } from "../../lib/settings-service";

export default function AdminDashboard() {
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const data = await getSiteSettings();
            setSettings(data);
        };
        fetchSettings();
    }, []);

    const handleToggle = async (key: keyof SiteSettings, value: boolean) => {
        if (!settings) return;
        setUpdating(key);
        try {
            await updateSiteSetting(key, value);
            setSettings({ ...settings, [key]: value });
        } catch (error) {
            console.error("Failed to update setting:", error);
        } finally {
            setUpdating(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground">Overview of the athletic meet status.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1,234</div>
                        <p className="text-xs text-muted-foreground">+180 from last year</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Events Scheduled</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">45</div>
                        <p className="text-xs text-muted-foreground">12 Completed, 5 Ongoing</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">8</div>
                        <p className="text-xs text-muted-foreground">CSE leading with 120 pts</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Status</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Active</div>
                        <p className="text-xs text-muted-foreground">Live Scoreboard Online</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-primary/20 shadow-md overflow-hidden bg-white dark:bg-gray-800">
                <CardHeader className="bg-primary/5 pb-4">
                    <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle>Site Configuration</CardTitle>
                            <CardDescription>Control feature availability for the public dashboard</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50/50 dark:bg-gray-900/50 transition-colors hover:bg-gray-50">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Download className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="enable-downloads" className="text-base font-semibold cursor-pointer">Certificate Downloads</Label>
                            </div>
                            <p className="text-sm text-muted-foreground ml-6">Allow students to download participation and merit certificates</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {updating === 'enable_downloads' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                            <Switch
                                id="enable-downloads"
                                checked={settings?.enable_downloads ?? true}
                                onCheckedChange={(checked: boolean) => handleToggle('enable_downloads', checked)}
                                disabled={!settings || updating === 'enable_downloads'}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50/50 dark:bg-gray-900/50 transition-colors hover:bg-gray-50">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="enable-requests" className="text-base font-semibold cursor-pointer">Participation Requests</Label>
                            </div>
                            <p className="text-sm text-muted-foreground ml-6">Allow students to submit requests to join additional events</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {updating === 'enable_requests' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                            <Switch
                                id="enable-requests"
                                checked={settings?.enable_requests ?? true}
                                onCheckedChange={(checked: boolean) => handleToggle('enable_requests', checked)}
                                disabled={!settings || updating === 'enable_requests'}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
