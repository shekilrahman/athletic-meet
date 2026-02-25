import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Program } from "../../types";

import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Card, CardContent } from "../../components/ui/card";
import { ArrowLeft, LayoutDashboard, Calendar, Users, Settings, Clock, CalendarDays, PlusCircle, FileBadge } from "lucide-react";

import AdminEvents from "./events";
import AdminRequests from "./requests";

export default function AdminProgramDashboard() {
    const { programId } = useParams();
    const navigate = useNavigate();
    const [program, setProgram] = useState<Program | null>(null);
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({
        totalAthletes: 0,
        pendingRequests: 0,
        totalEvents: 0,
        completedEvents: 0
    });

    useEffect(() => {
        const fetchProgramDetails = async () => {
            if (!programId) return;
            setLoading(true);
            try {
                // 1. Fetch Program
                const { data: programData, error: programError } = await supabase
                    .from('programs')
                    .select('*')
                    .eq('id', programId)
                    .single();

                if (programError) throw programError;
                setProgram(programData as Program);

                // 2. Fetch Aggregated Stats
                const { data: eventsData } = await supabase
                    .from('events')
                    .select('id, status')
                    .eq('program_id', programId);

                const events = eventsData || [];
                const eventIds = events.map(e => e.id);

                let uniqueAthletesCount = 0;
                let pendingReqCount = 0;

                if (eventIds.length > 0) {
                    // Count unique athletes across all teams in these events
                    const { data: teamsData } = await supabase
                        .from('teams')
                        .select('players')
                        .in('event_id', eventIds);

                    const uniqueAthletes = new Set();
                    teamsData?.forEach(team => {
                        team.players?.forEach((player: any) => {
                            if (player.registerNumber) uniqueAthletes.add(player.registerNumber);
                        });
                    });
                    uniqueAthletesCount = uniqueAthletes.size;

                    // Count pending requests
                    const { count } = await supabase
                        .from('participation_requests')
                        .select('*', { count: 'exact', head: true })
                        .in('event_id', eventIds)
                        .eq('status', 'pending');

                    pendingReqCount = count || 0;
                }

                setStats({
                    totalAthletes: uniqueAthletesCount,
                    pendingRequests: pendingReqCount,
                    totalEvents: events.length,
                    completedEvents: events.filter(e => e.status === 'completed').length
                });

            } catch (error) {
                console.error("Error fetching program details:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProgramDetails();
    }, [programId]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 text-muted-foreground">Loading Program Details...</div>;
    }

    if (!program) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50/50 dark:bg-gray-900/50">
                <h2 className="text-2xl font-bold">Program Not Found</h2>
                <Button asChild>
                    <Link to="/admin/programs">Return to Programs</Link>
                </Button>
            </div>
        );
    }

    return (
        <Tabs defaultValue="overview" className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 flex flex-col w-full">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white dark:bg-gray-950 px-6 shadow-sm">
                <Button variant="ghost" size="icon" onClick={() => navigate('/admin/programs')} className="shrink-0 h-9 w-9 rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back</span>
                </Button>

                <div className="flex items-center gap-4 border-r pr-6 mr-2">
                    <h1 className="text-xl font-bold tracking-tight truncate max-w-[200px] sm:max-w-[300px]">{program.name}</h1>
                    <div className="hidden lg:flex items-center gap-2">
                        {program.status === 'active' && <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>}
                        {program.status === 'inactive' && <Badge variant="secondary">Inactive</Badge>}
                        {program.status === 'ended' && <Badge variant="destructive">Ended</Badge>}
                        <Badge variant="outline" className="capitalize">{program.category || 'department'}</Badge>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto h-full flex items-center">
                    <TabsList className="bg-transparent border-none p-0 h-full w-full justify-start overflow-x-auto flex-nowrap rounded-none gap-6">
                        <TabsTrigger value="overview" className="gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-1 h-full border-b-2 border-transparent hover:text-primary transition-colors">
                            <LayoutDashboard className="h-4 w-4" />
                            <span className="hidden sm:inline">Overview</span>
                        </TabsTrigger>
                        <TabsTrigger value="events" className="gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-1 h-full border-b-2 border-transparent hover:text-primary transition-colors">
                            <Calendar className="h-4 w-4" />
                            <span className="hidden sm:inline">Events</span>
                        </TabsTrigger>
                        <TabsTrigger value="requests" className="gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-1 h-full border-b-2 border-transparent hover:text-primary transition-colors">
                            <Users className="h-4 w-4" />
                            <span className="hidden sm:inline">Requests</span>
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-1 h-full border-b-2 border-transparent hover:text-primary transition-colors">
                            <Settings className="h-4 w-4" />
                            <span className="hidden sm:inline">Settings</span>
                        </TabsTrigger>
                    </TabsList>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto p-6 md:p-8">
                <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <TabsContent value="overview" className="m-0 border-none p-0 outline-none">
                        <div className="grid gap-6">
                            {/* Quick Stats Grid */}
                            <div className="grid gap-4 md:grid-cols-3">
                                <Card className="border shadow-sm bg-white dark:bg-gray-800 transition-all hover:scale-[1.02]">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground">Registered Athletes</p>
                                                <div className="text-3xl font-bold tracking-tighter">
                                                    {stats.totalAthletes}
                                                </div>
                                            </div>
                                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                                                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-2">Expected participants in this meet</p>
                                    </CardContent>
                                </Card>

                                <Card className="border shadow-sm bg-white dark:bg-gray-800 transition-all hover:scale-[1.02]">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground">Event Progress</p>
                                                <div className="text-3xl font-bold tracking-tighter">
                                                    {`${stats.completedEvents}/${stats.totalEvents}`}
                                                </div>
                                            </div>
                                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                                                <CalendarDays className="h-6 w-6 text-green-600 dark:text-green-400" />
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                                            <div
                                                className="bg-green-500 h-full transition-all duration-1000"
                                                style={{ width: stats.totalEvents > 0 ? `${(stats.completedEvents / stats.totalEvents) * 100}%` : '0%' }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border shadow-sm bg-white dark:bg-gray-800 transition-all hover:scale-[1.02]">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground">Pending Requests</p>
                                                <div className="text-3xl font-bold tracking-tighter">
                                                    {stats.pendingRequests}
                                                </div>
                                            </div>
                                            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
                                                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                            </div>
                                        </div>
                                        {stats.pendingRequests > 0 ? (
                                            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 font-medium">Requires attention</p>
                                        ) : (
                                            <p className="text-sm text-muted-foreground mt-2 font-medium">All caught up</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Action Cards */}
                            <h3 className="text-xl font-bold tracking-tight mt-6">Quick Tasks</h3>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <Link to="?tab=events" className="bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm flex items-center gap-4 hover:border-primary/50 transition-colors group">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex shrink-0 items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                        <PlusCircle className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <h4 className="font-semibold">Manage Events</h4>
                                        <p className="text-sm text-muted-foreground">Create or edit events</p>
                                    </div>
                                </Link>

                                <Link to="?tab=requests" className="bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm flex items-center gap-4 hover:border-primary/50 transition-colors group">
                                    <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex shrink-0 items-center justify-center text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <h4 className="font-semibold">Review Requests</h4>
                                        <p className="text-sm text-muted-foreground">Manage participation</p>
                                    </div>
                                </Link>

                                <Link to="/admin/certificates" className="bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm flex items-center gap-4 hover:border-primary/50 transition-colors group">
                                    <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex shrink-0 items-center justify-center text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                        <FileBadge className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <h4 className="font-semibold">Generate Certificates</h4>
                                        <p className="text-sm text-muted-foreground">For winners & participants</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="events" className="m-0 border-none p-0 outline-none">
                        {/* We will render the extracted AdminEvents here */}
                        <AdminEvents isEmbedded={true} />
                    </TabsContent>

                    <TabsContent value="requests" className="m-0 border-none p-0 outline-none">
                        {/* We will render the extracted AdminRequests here */}
                        <AdminRequests programId={program.id} isEmbedded={true} />
                    </TabsContent>

                    <TabsContent value="settings" className="m-0 border-none p-0 outline-none">
                        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 shadow-sm">
                            <h3 className="text-lg font-semibold mb-4">Program Settings</h3>
                            <p className="text-muted-foreground">General settings, certificates, and download configurations will be managed here.</p>
                        </div>
                    </TabsContent>
                </div>
            </main>
        </Tabs>
    );
}
