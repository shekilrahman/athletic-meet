import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Loader2, XCircle, Trophy, ArrowLeft } from "lucide-react";
import type { Event, Participant, Department, RoundParticipant } from "../types";

export default function VerificationPage() {
    const { registerNumber } = useParams<{ registerNumber: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<{
        participant: Participant;
        department: Department;
        events: { event: Event; rank: number | null }[];
    } | null>(null);

    useEffect(() => {
        const fetchParticipantData = async () => {
            if (!registerNumber) return;

            setLoading(true);
            setError(null);

            try {
                // 1. Fetch Participant
                const { data: participants, error: pError } = await supabase
                    .from('participants')
                    .select('*')
                    .eq('register_number', registerNumber.toUpperCase()) // Ensure case matches
                    .single();

                if (pError || !participants) {
                    throw new Error("Participant not found");
                }

                const participant = {
                    id: participants.id,
                    name: participants.name,
                    registerNumber: participants.register_number,
                    departmentId: participants.department_id,
                    batchId: participants.batch_id,
                    semester: participants.semester,
                    gender: participants.gender,
                    chestNumber: participants.chest_number,
                    totalPoints: participants.total_points,
                    individualWins: participants.individual_wins
                } as Participant;

                // 2. Fetch Department
                const { data: deptData, error: dError } = await supabase
                    .from('departments')
                    .select('*')
                    .eq('id', participant.departmentId)
                    .single();

                if (dError) throw dError;
                const department = deptData as Department;

                // 3. Fetch Teams for Participant
                const { data: teamsData, error: teamsError } = await supabase.from('teams').select('*');
                if (teamsError) throw teamsError;

                const participantTeams = teamsData.filter((t: any) =>
                    Array.isArray(t.member_ids) && t.member_ids.includes(participant.id)
                );
                const participantTeamIds = participantTeams.map(t => t.id);

                // 4. Fetch Events
                const { data: eventsData, error: evError } = await supabase.from('events').select('*');
                if (evError) throw evError;

                const eventsList = eventsData.map((e: any) => ({
                    id: e.id,
                    name: e.name,
                    type: e.type,
                    gender: e.gender,
                    status: e.status,
                    rounds: e.rounds,
                    participants: e.participants
                })) as Event[];

                const participantEvents = eventsList
                    .filter(event => {
                        if (event.type === 'group') {
                            return event.participants && event.participants.some(pid => participantTeamIds.includes(pid));
                        } else {
                            return event.participants?.includes(participant.id);
                        }
                    })
                    .map(event => {
                        let rank: number | null = null;
                        if (event.status === 'completed' && event.rounds) {
                            // Check final round first
                            const finalRound = event.rounds.find(r => r.name.toLowerCase().includes('final')) || event.rounds[event.rounds.length - 1];

                            // For group events, look for Team ID. For individual, look for Participant ID.
                            const targetId = event.type === 'group'
                                ? participantTeamIds.find(tid => event.participants?.includes(tid))
                                : participant.id;

                            if (finalRound && targetId) {
                                const rp = finalRound.participants?.find(
                                    (rp: RoundParticipant) => rp.participantId === targetId
                                );
                                if (rp?.rank && rp.rank >= 1 && rp.rank <= 3) {
                                    rank = rp.rank;
                                }
                            }

                            // Fallback: Check all rounds if not found in final
                            if (!rank && targetId) {
                                for (const round of event.rounds) {
                                    const rp = round.participants?.find(
                                        (rp: RoundParticipant) => rp.participantId === targetId
                                    );
                                    if (rp?.rank && rp.rank >= 1 && rp.rank <= 3) {
                                        rank = rp.rank;
                                        break; // Found a winning rank
                                    }
                                }
                            }
                        }
                        return { event, rank };
                    });

                const sortedEvents = [...participantEvents].sort((a, b) => {
                    const getRankValue = (rank: number | null) => {
                        if (rank === 1) return 1;
                        if (rank === 2) return 2;
                        if (rank === 3) return 3;
                        return 4; // Participation
                    };
                    return getRankValue(a.rank) - getRankValue(b.rank);
                });

                setData({ participant, department, events: sortedEvents });

            } catch (err: any) {
                console.error("Verification Error:", err);
                setError(err.message || "Failed to verify participant");
            } finally {
                setLoading(false);
            }
        };

        fetchParticipantData();
    }, [registerNumber]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-lg text-muted-foreground">Verifying Participant...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <Card className="w-full max-w-md border-red-200 shadow-lg">
                    <CardHeader className="text-center pb-2">
                        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-2" />
                        <CardTitle className="text-2xl text-red-600">Verification Failed</CardTitle>
                        <CardDescription>
                            Could not find participant with Register No: <span className="font-mono font-bold text-black dark:text-white">{registerNumber}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-sm text-gray-500 mb-6">
                            This register number does not exist in our records. Please check the number and try again.
                        </p>
                        <Button asChild variant="outline">
                            <Link to="/"> <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { participant, department, events } = data;
    // Removed medal count calculation as the card is being removed

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-0 md:py-10 md:px-4">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Identity Card */}
                <Card className="overflow-hidden border-green-200 shadow-lg rounded-none md:rounded-xl border-x-0 md:border-x">
                    <div className="bg-green-50 dark:bg-green-900/20 p-6 border-b border-green-100 flex flex-col items-center text-center">
                        <div className="flex-1 w-full">
                            <div className="flex items-center justify-center mb-4">
                                <h1 className="text-3xl font-bold">{participant.name}</h1>
                            </div>
                            <div className="grid grid-cols-2 gap-y-4 gap-x-4 mt-4 text-gray-600 dark:text-gray-300 text-left">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Register No</span>
                                    <span className="font-mono text-base font-medium text-foreground">{participant.registerNumber}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Department</span>
                                    <span className="text-base font-medium text-foreground">{department.code}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Gender</span>
                                    <span className="capitalize text-base font-medium text-foreground">{participant.gender}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <CardContent className="pt-6">
                        {/* Removed Medal Count Card */}

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-primary" />
                                Event Participation
                            </h3>

                            {events.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Event Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead className="text-right">Result</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {events.map(({ event, rank }) => (
                                            <TableRow key={event.id}>
                                                <TableCell className="font-medium">{event.name}</TableCell>
                                                <TableCell className="capitalize text-muted-foreground">{event.type}</TableCell>
                                                <TableCell className="text-right">
                                                    {rank === 1 && <Badge className="bg-yellow-500 hover:bg-yellow-600">Gold</Badge>}
                                                    {rank === 2 && <Badge className="bg-gray-400 hover:bg-gray-500">Silver</Badge>}
                                                    {rank === 3 && <Badge className="bg-orange-500 hover:bg-orange-600">Bronze</Badge>}
                                                    {!rank && event.status === 'completed' && <Badge className="bg-blue-500 hover:bg-blue-600">Participated</Badge>}
                                                    {event.status !== 'completed' && <Badge variant="outline">Ongoing/Upcoming</Badge>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    No events registered yet.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
