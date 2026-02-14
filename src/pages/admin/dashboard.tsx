import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Users, Calendar, Trophy, Activity, Settings, Download, UserPlus, Loader2 } from "lucide-react";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { getSiteSettings, updateSiteSetting, type SiteSettings } from "../../lib/settings-service";
import { supabase } from "../../lib/supabase";
import type { Event, Round, RoundParticipant, Team } from "../../types";

export default function AdminDashboard() {
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        participants: 0,
        events: 0,
        completedEvents: 0,
        departments: 0,
        leadingDept: { code: 'N/A', points: 0 }
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const data = await getSiteSettings();
            setSettings(data);
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 1. Get Active Program
                const { data: programData } = await supabase
                    .from('programs')
                    .select('id, name')
                    .eq('status', 'active')
                    .single();

                // If no active program, just return zero stats or global?
                // Let's return zero for now to encourage creation
                if (!programData) {
                    setStats({
                        participants: 0,
                        events: 0,
                        completedEvents: 0,
                        departments: 0,
                        leadingDept: { code: 'N/A', points: 0 }
                    });
                    setLoading(false);
                    return;
                }

                const [partsRes, eventsRes, deptsRes, teamsRes] = await Promise.all([
                    supabase.from('participants').select('id', { count: 'exact' }),
                    supabase.from('events').select('*').eq('program_id', programData.id),
                    supabase.from('departments').select('*'),
                    supabase.from('teams').select('*')
                ]);

                if (partsRes.error) throw partsRes.error;
                if (eventsRes.error) throw eventsRes.error;
                if (deptsRes.error) throw deptsRes.error;
                if (teamsRes.error) throw teamsRes.error;

                const events = eventsRes.data as Event[];
                const teams = teamsRes.data as Team[];
                const depts = deptsRes.data;

                // Calculate points
                const deptPoints = new Map<string, number>();
                depts.forEach(d => deptPoints.set(d.id, 0));

                events.forEach(event => {
                    if (event.status === 'completed' && event.rounds) {
                        event.rounds.forEach((round: Round) => {
                            round.participants?.forEach((result: RoundParticipant) => {
                                let points = 0;
                                if (result.rank === 1) points = event.points1st || 5;
                                else if (result.rank === 2) points = event.points2nd || 3;
                                else if (result.rank === 3) points = event.points3rd || 1;

                                if (points > 0) {
                                    let deptId = '';
                                    if (event.type === 'individual') {
                                        // For individual events, we need to join with participants to get department
                                        // But we didn't fetch full participant data to save bandwidth.
                                        // We might need to fetch participants if we want perfect accuracy, 
                                        // BUT for the dashboard summary, let's just fetch full participants count 
                                        // and maybe ignore detailed point calc if it's too heavy? 
                                        // Wait, the user wants "original data", so we should try to be accurate.
                                        // Let's defer individual point calc or do a separate query if needed.
                                        // Actually, let's fetch basic participant info for department mapping
                                    } else if (event.type === 'group') {
                                        const team = teams.find(t => t.id === result.participantId);
                                        if (team && team.departmentId) deptId = team.departmentId;
                                    }

                                    // If we have deptId, add points
                                    if (deptId && deptPoints.has(deptId)) {
                                        deptPoints.set(deptId, (deptPoints.get(deptId) || 0) + points);
                                    }
                                }
                            });
                        });
                    }
                });

                // Re-fetching participants with dept_id to calculate individual points correctly
                // Note: Using a separate query to avoid fetching all fields
                const { data: allParts } = await supabase.from('participants').select('id, department_id');

                if (allParts) {
                    const partDeptMap = new Map(allParts.map(p => [p.id, p.department_id]));
                    events.forEach(event => {
                        if (event.status === 'completed' && event.rounds && event.type === 'individual') {
                            event.rounds.forEach((round: Round) => {
                                round.participants?.forEach((result: RoundParticipant) => {
                                    let points = 0;
                                    if (result.rank === 1) points = event.points1st || 5;
                                    else if (result.rank === 2) points = event.points2nd || 3;
                                    else if (result.rank === 3) points = event.points3rd || 1;

                                    if (points > 0) {
                                        const deptId = partDeptMap.get(result.participantId);
                                        if (deptId && deptPoints.has(deptId)) {
                                            deptPoints.set(deptId, (deptPoints.get(deptId) || 0) + points);
                                        }
                                    }
                                });
                            });
                        }
                    });
                }

                // Find leading department
                let maxPoints = -1;
                let leader = { code: 'N/A', points: 0 };

                deptPoints.forEach((points, id) => {
                    if (points > maxPoints) {
                        maxPoints = points;
                        const d = depts.find(d => d.id === id);
                        leader = { code: d?.code || 'Unknown', points };
                    }
                });

                setStats({
                    participants: partsRes.count || 0,
                    events: events.length,
                    completedEvents: events.filter(e => e.status === 'completed').length,
                    departments: depts.length,
                    leadingDept: leader
                });

            } catch (error) {
                console.error("Error fetching admin stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
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
                        <div className="text-2xl font-bold">{loading ? "..." : stats.participants}</div>
                        <p className="text-xs text-muted-foreground">Registered students</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Events Scheduled</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.events}</div>
                        <p className="text-xs text-muted-foreground">{loading ? "..." : `${stats.completedEvents} Completed`}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.departments}</div>
                        <p className="text-xs text-muted-foreground">
                            {loading ? "..." : (stats.leadingDept.points > 0 ? `${stats.leadingDept.code} leading (${stats.leadingDept.points} pts)` : "No points yet")}
                        </p>
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
