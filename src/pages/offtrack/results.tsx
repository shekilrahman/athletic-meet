import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Trophy, Loader2, Search } from "lucide-react";
import type { Event, Participant, Department, Team } from "../../types";

export default function OfftrackResults() {
    const [events, setEvents] = useState<Event[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterGender, setFilterGender] = useState<string>("all");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: eData } = await supabase.from('events').select('*');
            const { data: pData } = await supabase.from('participants').select('*');
            const { data: tData } = await supabase.from('teams').select('*');
            const { data: dData } = await supabase.from('departments').select('*');

            setEvents((eData || []) as Event[]);
            setParticipants((pData || []) as Participant[]);
            setTeams((tData || []) as Team[]);
            setDepartments((dData || []) as Department[]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getParticipant = (id: string) => participants.find(p => p.id === id);
    const getTeam = (id: string) => teams.find(t => t.id === id);
    const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || id;

    const getWinnerName = (event: Event, winnerId: string) => {
        if (event.type === "group") {
            const team = getTeam(winnerId);
            return team?.name || winnerId;
        }
        const p = getParticipant(winnerId);
        return p ? `${p.chestNumber} - ${p.name}` : winnerId;
    };

    const getWinnerDept = (event: Event, winnerId: string) => {
        if (event.type === "group") {
            const team = getTeam(winnerId);
            return team?.departmentId ? getDeptName(team.departmentId) : "-";
        }
        const p = getParticipant(winnerId);
        return p ? getDeptName(p.departmentId) : "-";
    };

    // Filter to only completed events with winners
    const completedEvents = events.filter(e => e.status === "completed" && e.winnerIds && e.winnerIds.length > 0);

    const filteredEvents = completedEvents.filter(event => {
        const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGender = filterGender === "all" || event.gender === filterGender;
        return matchesSearch && matchesGender;
    });

    // Calculate department points
    const deptPoints: Record<string, number> = {};
    completedEvents.forEach(event => {
        if (!event.winnerIds) return;
        const points = [event.points1st || 10, event.points2nd || 7, event.points3rd || 5];
        event.winnerIds.forEach((winnerId, idx) => {
            if (idx > 2) return;
            let deptId = "";
            if (event.type === "group") {
                const team = getTeam(winnerId);
                deptId = team?.departmentId || "";
            } else {
                const p = getParticipant(winnerId);
                deptId = p?.departmentId || "";
            }
            if (deptId) {
                deptPoints[deptId] = (deptPoints[deptId] || 0) + points[idx];
            }
        });
    });

    const sortedDepts = Object.entries(deptPoints).sort((a, b) => b[1] - a[1]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold">Results</h1>
                <p className="text-muted-foreground">View all completed events and department standings</p>
            </header>

            {/* Department Standings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Department Standings</CardTitle>
                </CardHeader>
                <CardContent>
                    {sortedDepts.length === 0 ? (
                        <p className="text-center py-4 text-muted-foreground">No results yet</p>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {sortedDepts.map(([deptId, points], idx) => (
                                <div key={deptId} className={`flex items-center gap-4 p-4 rounded-lg border ${idx === 0 ? "bg-yellow-50 border-yellow-200" : idx === 1 ? "bg-gray-50 border-gray-200" : idx === 2 ? "bg-orange-50 border-orange-200" : ""}`}>
                                    <div className="text-2xl font-bold text-muted-foreground">#{idx + 1}</div>
                                    <div className="flex-1">
                                        <div className="font-semibold">{getDeptName(deptId)}</div>
                                        <div className="text-sm text-muted-foreground">{points} points</div>
                                    </div>
                                    {idx === 0 && <span className="text-2xl">🥇</span>}
                                    {idx === 1 && <span className="text-2xl">🥈</span>}
                                    {idx === 2 && <span className="text-2xl">🥉</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search events..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                            </div>
                        </div>
                        <Select value={filterGender} onValueChange={setFilterGender}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Gender" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Gender</SelectItem>
                                <SelectItem value="male">Men</SelectItem>
                                <SelectItem value="female">Women</SelectItem>
                                <SelectItem value="mixed">Mixed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Results Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Completed Events ({filteredEvents.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event</TableHead>
                                <TableHead>Gender</TableHead>
                                <TableHead>🥇 1st Place</TableHead>
                                <TableHead>🥈 2nd Place</TableHead>
                                <TableHead>🥉 3rd Place</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredEvents.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No completed events with results</TableCell>
                                </TableRow>
                            ) : (
                                filteredEvents.map(event => (
                                    <TableRow key={event.id}>
                                        <TableCell className="font-medium">{event.name}</TableCell>
                                        <TableCell><Badge variant="outline" className="capitalize">{event.gender}</Badge></TableCell>
                                        <TableCell>
                                            {event.winnerIds?.[0] ? (
                                                <div>
                                                    <div className="font-medium">{getWinnerName(event, event.winnerIds[0])}</div>
                                                    <div className="text-xs text-muted-foreground">{getWinnerDept(event, event.winnerIds[0])}</div>
                                                </div>
                                            ) : "-"}
                                        </TableCell>
                                        <TableCell>
                                            {event.winnerIds?.[1] ? (
                                                <div>
                                                    <div className="font-medium">{getWinnerName(event, event.winnerIds[1])}</div>
                                                    <div className="text-xs text-muted-foreground">{getWinnerDept(event, event.winnerIds[1])}</div>
                                                </div>
                                            ) : "-"}
                                        </TableCell>
                                        <TableCell>
                                            {event.winnerIds?.[2] ? (
                                                <div>
                                                    <div className="font-medium">{getWinnerName(event, event.winnerIds[2])}</div>
                                                    <div className="text-xs text-muted-foreground">{getWinnerDept(event, event.winnerIds[2])}</div>
                                                </div>
                                            ) : "-"}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
