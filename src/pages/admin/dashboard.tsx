import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Users, Trophy, Activity, Award, ArrowRight, FileBadge, CalendarDays, ClipboardList } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Event, Round, RoundParticipant, Team } from "../../types";

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [activeProgramName, setActiveProgramName] = useState<string>("Global Dashboard");
    const [stats, setStats] = useState({
        participants: 0,
        events: 0,
        completedEvents: 0,
        departments: 0,
        leadingDept: { code: 'N/A', points: 0 },
        topDepartments: [] as { code: string; points: number }[]
    });



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
                    setActiveProgramName("Global Dashboard");
                    setStats({
                        participants: 0,
                        events: 0,
                        completedEvents: 0,
                        departments: 0,
                        leadingDept: { code: 'N/A', points: 0 },
                        topDepartments: []
                    });
                    setLoading(false);
                    return;
                }

                setActiveProgramName(programData.name);

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

                // Find leading departments
                const sortedDepts = Array.from(deptPoints.entries())
                    .map(([id, points]) => {
                        const d = depts.find(d => d.id === id);
                        return { code: d?.code || 'Unknown', points };
                    })
                    .sort((a, b) => b.points - a.points);

                const leader = sortedDepts.length > 0 ? sortedDepts[0] : { code: 'N/A', points: 0 };
                const topDepartments = sortedDepts.slice(0, 3);

                setStats({
                    participants: partsRes.count || 0,
                    events: events.length,
                    completedEvents: events.filter(e => e.status === 'completed').length,
                    departments: depts.length,
                    leadingDept: leader,
                    topDepartments: topDepartments
                });

            } catch (error) {
                console.error("Error fetching admin stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);


    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Welcome Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/10">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        <Activity className="h-4 w-4" /> Live Dashboard
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        {loading ? "Loading..." : activeProgramName}
                    </h2>
                    <p className="text-muted-foreground text-lg">
                        Manage your sports meet, monitor live stats, and control configurations from one place.
                    </p>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-md bg-white dark:bg-gray-800 transition-all hover:scale-[1.02]">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Total Athletes</p>
                                <div className="text-3xl font-bold tracking-tighter">
                                    {loading ? "..." : stats.participants}
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white dark:bg-gray-800 transition-all hover:scale-[1.02]">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Events</p>
                                <div className="text-3xl font-bold tracking-tighter">
                                    {loading ? "..." : `${stats.completedEvents}/${stats.events}`}
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                                <CalendarDays className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                        {/* Event Progress Bar */}
                        <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-green-500 h-full transition-all duration-1000"
                                style={{ width: stats.events > 0 ? `${(stats.completedEvents / stats.events) * 100}%` : '0%' }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white dark:bg-gray-800 transition-all hover:scale-[1.02]">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Departments</p>
                                <div className="text-3xl font-bold tracking-tighter">
                                    {loading ? "..." : stats.departments}
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
                                <Trophy className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 font-medium">
                            {loading ? "..." : stats.leadingDept.points > 0 ?
                                <span className="text-purple-600 dark:text-purple-400">{stats.leadingDept.code} is leading!</span> :
                                "No points yet"}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white dark:bg-gray-800 transition-all hover:scale-[1.02]">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">System Status</p>
                                <div className="text-3xl font-bold tracking-tighter text-emerald-600 dark:text-emerald-400">
                                    Online
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
                                <Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">All services operational</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Core App Modules / Quick Actions */}
                <div className="md:col-span-2 space-y-4">
                    <h3 className="text-xl font-bold tracking-tight">Quick Actions</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        <Link to="/admin/programs" className="group rounded-xl border p-5 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <ClipboardList className="h-5 w-5" />
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                            </div>
                            <h4 className="font-semibold text-lg">Event Management</h4>
                            <p className="text-sm text-muted-foreground mt-1">Manage events and record match results per program.</p>
                        </Link>

                        <Link to="/admin/programs" className="group rounded-xl border p-5 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <Trophy className="h-5 w-5" />
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                            </div>
                            <h4 className="font-semibold text-lg">Programs & Meets</h4>
                            <p className="text-sm text-muted-foreground mt-1">Configure different sports editions and their feature toggles.</p>
                        </Link>

                        <Link to="/admin/certificate-preview" className="group rounded-xl border p-5 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                    <FileBadge className="h-5 w-5" />
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                            </div>
                            <h4 className="font-semibold text-lg">Certificate Factory</h4>
                            <p className="text-sm text-muted-foreground mt-1">Preview and generate merit and participation certificates for athletes.</p>
                        </Link>

                        <Link to="/admin/requests" className="group rounded-xl border p-5 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                                    <Users className="h-5 w-5" />
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                            </div>
                            <h4 className="font-semibold text-lg">Participation Requests</h4>
                            <p className="text-sm text-muted-foreground mt-1">Review and approve athletes requesting to join specific events.</p>
                        </Link>

                    </div>
                </div>

                {/* Top Departments Leaderboard */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold tracking-tight">Top Standings</h3>
                    <Card className="border-none shadow-md bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Award className="h-5 w-5 text-yellow-500" /> Leaderboard
                            </CardTitle>
                            <CardDescription className="text-slate-400">Top 3 scoring departments</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {loading ? (
                                <div className="animate-pulse space-y-3">
                                    <div className="h-10 bg-slate-700/50 rounded" />
                                    <div className="h-10 bg-slate-700/50 rounded" />
                                    <div className="h-10 bg-slate-700/50 rounded" />
                                </div>
                            ) : stats.topDepartments.length === 0 || stats.topDepartments[0].points === 0 ? (
                                <div className="text-center text-slate-400 py-6">
                                    No points awarded yet.
                                </div>
                            ) : (
                                stats.topDepartments.map((dept, index) => (
                                    <div key={dept.code} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm bg-slate-800 shadow-inner">
                                                {index === 0 && <span className="text-yellow-400">1</span>}
                                                {index === 1 && <span className="text-gray-300">2</span>}
                                                {index === 2 && <span className="text-amber-600">3</span>}
                                            </div>
                                            <span className="font-semibold">{dept.code}</span>
                                        </div>
                                        <div className="font-mono font-bold bg-white/10 px-3 py-1 rounded-md text-sm">
                                            {dept.points} pts
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
