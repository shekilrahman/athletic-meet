import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Loader2, Trophy, Clock, Users, User, Medal, Award, UserPlus, Search } from "lucide-react";
import type { Event, Participant, Department, Team, Batch } from "../types";

export default function PublicDashboard() {
    const [events, setEvents] = useState<Event[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [activeMode, setActiveMode] = useState<"register" | "lookup">("lookup");

    // Registration state
    const [registrationForm, setRegistrationForm] = useState({
        name: "",
        registerNumber: "",
        departmentId: "",
        batchId: "",
        semester: 1,
        gender: "male" as "male" | "female",
    });
    const [registering, setRegistering] = useState(false);
    const [registrationMessage, setRegistrationMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Lookup state (register number only)
    const [lookupQuery, setLookupQuery] = useState("");
    const [lookupResult, setLookupResult] = useState<{
        participant: Participant | null;
        events: Event[];
    } | null>(null);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [eventsSnap, partsSnap, deptsSnap, teamsSnap, batchesSnap] = await Promise.all([
                    getDocs(collection(db, "events")),
                    getDocs(collection(db, "participants")),
                    getDocs(collection(db, "departments")),
                    getDocs(collection(db, "teams")),
                    getDocs(collection(db, "batches"))
                ]);

                setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[]);
                setParticipants(partsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Participant[]);
                setDepartments(deptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Department[]);
                setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Team[]);
                setBatches(batchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Batch[]);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const upcomingEvents = events.filter(e => e.status === 'upcoming' || e.status === 'ongoing');
    const completedEvents = events.filter(e => e.status === 'completed');

    const getTopParticipants = (event: Event) => {
        const finalRound = event.rounds?.find(r => r.name.toLowerCase().includes('final'));
        if (!finalRound) return [];

        return finalRound.participants
            ?.filter(p => p.rank && p.rank <= 3)
            .sort((a, b) => (a.rank || 0) - (b.rank || 0))
            .map(rp => {
                if (event.type === 'group') {
                    const team = teams.find(t => t.id === rp.participantId);
                    const dept = departments.find(d => d.id === team?.departmentId);
                    const memberNames = team?.memberIds
                        ?.map((memberId: string) => participants.find(p => p.id === memberId)?.chestNumber)
                        .filter(Boolean)
                        .join(', ') || 'N/A';

                    return {
                        rank: rp.rank!,
                        name: team?.name || 'Unknown Team',
                        chestNumber: memberNames,
                        department: dept?.code || 'N/A'
                    };
                } else {
                    const participant = participants.find(p => p.id === rp.participantId);
                    const dept = departments.find(d => d.id === participant?.departmentId);
                    return {
                        rank: rp.rank!,
                        name: participant?.name || 'Unknown',
                        chestNumber: participant?.chestNumber || 'N/A',
                        department: dept?.code || 'N/A'
                    };
                }
            }) || [];
    };

    // Calculate scoreboard data
    const calculateScoreboard = () => {
        const partStatsMap = new Map<string, any>();
        const deptStatsMap = new Map<string, any>();

        departments.forEach(dept => {
            deptStatsMap.set(dept.id, {
                id: dept.id, name: dept.name, code: dept.code,
                points: 0, gold: 0, silver: 0, bronze: 0
            });
        });

        participants.forEach(part => {
            partStatsMap.set(part.id, {
                id: part.id, name: part.name, departmentId: part.departmentId,
                chestNumber: part.chestNumber, gender: part.gender,
                points: 0, gold: 0, silver: 0, bronze: 0
            });
        });

        events.forEach(event => {
            event.rounds?.forEach(round => {
                round.participants?.forEach(result => {
                    if (result.rank && event.type === 'individual') {
                        const participantId = result.participantId;
                        const partStat = partStatsMap.get(participantId);

                        if (partStat) {
                            let points = 0;
                            if (result.rank === 1) {
                                points = event.points1st || 5;
                                partStat.gold++;
                            } else if (result.rank === 2) {
                                points = event.points2nd || 3;
                                partStat.silver++;
                            } else if (result.rank === 3) {
                                points = event.points3rd || 1;
                                partStat.bronze++;
                            }
                            partStat.points += points;

                            const deptStat = deptStatsMap.get(partStat.departmentId);
                            if (deptStat) {
                                deptStat.points += points;
                                if (result.rank === 1) deptStat.gold++;
                                else if (result.rank === 2) deptStat.silver++;
                                else if (result.rank === 3) deptStat.bronze++;
                            }
                        }
                    }
                });
            });
        });

        return {
            departmentStats: Array.from(deptStatsMap.values()).sort((a, b) => b.points - a.points),
            participantStats: Array.from(partStatsMap.values())
        };
    };

    const { departmentStats, participantStats } = calculateScoreboard();
    const topMale = participantStats.filter(p => p.gender === 'male').sort((a, b) => b.points - a.points).slice(0, 5);
    const topFemale = participantStats.filter(p => p.gender === 'female').sort((a, b) => b.points - a.points).slice(0, 5);

    // Handler for participant registration
    const handleRegistration = async () => {
        // Reset message
        setRegistrationMessage(null);

        // Validate required fields
        if (!registrationForm.name.trim() || !registrationForm.registerNumber || !registrationForm.departmentId) {
            setRegistrationMessage({ type: 'error', text: 'Name, Register Number, and Department are required.' });
            return;
        }

        setRegistering(true);
        try {
            // Check for duplicate register number
            const existingReg = participants.find(p => p.registerNumber === registrationForm.registerNumber);
            if (existingReg) {
                setRegistrationMessage({
                    type: 'error',
                    text: `Participant already exists!\nName: ${existingReg.name}\nChest No: ${existingReg.chestNumber}\nReg No: ${existingReg.registerNumber}`
                });
                setRegistering(false);
                return;
            }

            // Auto-generate chest number
            let maxChest = 100;
            participants.forEach(p => {
                const cn = parseInt(p.chestNumber);
                if (!isNaN(cn) && cn > maxChest) {
                    maxChest = cn;
                }
            });
            const nextChestNumber = String(maxChest + 1);

            // Create participant in Firestore
            await addDoc(collection(db, "participants"), {
                name: registrationForm.name,
                registerNumber: registrationForm.registerNumber,
                departmentId: registrationForm.departmentId,
                batchId: registrationForm.batchId,
                semester: registrationForm.semester,
                gender: registrationForm.gender,
                chestNumber: nextChestNumber,
                totalPoints: 0,
                individualWins: 0,
            });

            setRegistrationMessage({
                type: 'success',
                text: `Registration successful! Your chest number is ${nextChestNumber}. Please remember this number.`
            });

            // Reset form
            setRegistrationForm({
                name: "",
                registerNumber: "",
                departmentId: "",
                batchId: "",
                semester: 1,
                gender: "male",
            });

            // Refresh participants data
            const partsSnap = await getDocs(collection(db, "participants"));
            setParticipants(partsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Participant[]);

        } catch (error) {
            console.error("Error during registration:", error);
            setRegistrationMessage({ type: 'error', text: 'An error occurred during registration. Please try again.' });
        } finally {
            setRegistering(false);
        }
    };


    // Handler for event lookup
    const handleLookup = async () => {
        if (!lookupQuery.trim()) return;

        setSearching(true);
        try {
            // Only search by register number
            const q = query(collection(db, "participants"), where("registerNumber", "==", lookupQuery.trim()));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const participant = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Participant;

                // Find events this participant is registered for
                const eventsSnapshot = await getDocs(collection(db, "events"));
                const participantEvents = eventsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Event))
                    .filter(event => event.participants?.includes(participant.id));

                setLookupResult({ participant, events: participantEvents });
            } else {
                setLookupResult({ participant: null, events: [] });
            }
        } catch (error) {
            console.error("Error looking up participant:", error);
            setLookupResult({ participant: null, events: [] });
        } finally {
            setSearching(false);
        }
    };


    const renderEventCard = (event: Event) => {
        const topResults = getTopParticipants(event);
        const participantCount = event.participants?.length || 0;

        return (
            <Card key={event.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <CardTitle className="text-lg">{event.name}</CardTitle>
                            <div className="flex gap-2 mt-2">
                                <Badge variant="outline" className="text-xs capitalize">
                                    {event.gender}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                    {event.type === 'group' ? (
                                        <><Users className="h-3 w-3 mr-1" />Group</>
                                    ) : (
                                        <><User className="h-3 w-3 mr-1" />Individual</>
                                    )}
                                </Badge>
                            </div>
                        </div>
                        {event.status === 'ongoing' && (
                            <Badge className="bg-green-100 text-green-700">Live</Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                        {participantCount} {event.type === 'group' ? 'team' : 'participant'}{participantCount !== 1 ? 's' : ''}
                    </div>

                    {topResults.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-sm font-semibold">Results:</div>
                            {topResults.map((result) => (
                                <div key={result.rank} className="flex items-center gap-3 text-sm">
                                    <div className="flex-shrink-0">
                                        {result.rank === 1 && <Medal className="h-5 w-5 text-yellow-500" />}
                                        {result.rank === 2 && <Medal className="h-5 w-5 text-gray-400" />}
                                        {result.rank === 3 && <Medal className="h-5 w-5 text-orange-400" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium">{result.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            #{result.chestNumber} • {result.department}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {topResults.length === 0 && event.status === 'completed' && (
                        <div className="text-sm text-muted-foreground">No results available</div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center text-black dark:text-gray-100">
                    <div>
                        <h1 className="text-xl font-bold text-primary">GECW Sports Meet 26</h1>
                        <p className="text-sm text-gray-500">Live Results</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Register / Lookup
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-2 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <Tabs defaultValue="scoreboard" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger value="scoreboard">
                                <Award className="h-4 w-4 mr-2" />
                                Scoreboard
                            </TabsTrigger>
                            <TabsTrigger value="upcoming">
                                <Clock className="h-4 w-4 mr-2" />
                                Upcoming ({upcomingEvents.length})
                            </TabsTrigger>
                            <TabsTrigger value="done">
                                <Trophy className="h-4 w-4 mr-2" />
                                Done ({completedEvents.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="scoreboard" className="space-y-6">
                            {/* Department Standings */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Trophy className="h-5 w-5 text-yellow-500" />
                                        Department Standings
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]">#</TableHead>
                                                <TableHead>Dept</TableHead>
                                                <TableHead className="text-center w-28">Medals</TableHead>
                                                <TableHead className="text-right w-16">Pts</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {departmentStats.map((dept, index) => (
                                                <TableRow key={dept.id}>
                                                    <TableCell className="font-medium">{index + 1}</TableCell>
                                                    <TableCell>
                                                        <span className="font-bold">{dept.code}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1 justify-center">
                                                            <span className="flex items-center gap-0.5">
                                                                <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-[10px] font-bold text-yellow-900">{dept.gold}</div>
                                                            </span>
                                                            <span className="flex items-center gap-0.5">
                                                                <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-700">{dept.silver}</div>
                                                            </span>
                                                            <span className="flex items-center gap-0.5">
                                                                <div className="w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center text-[10px] font-bold text-orange-900">{dept.bronze}</div>
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">{dept.points}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            {/* Individual Rankings */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <User className="h-5 w-5" /> Top Male Athletes
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-32">Name</TableHead>
                                                    <TableHead className="w-14">Dept</TableHead>
                                                    <TableHead className="text-center w-28">Medals</TableHead>
                                                    <TableHead className="text-right w-12">Pts</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {topMale.map((p) => (
                                                    <TableRow key={p.id}>
                                                        <TableCell>
                                                            <div className="font-medium">{p.name}</div>
                                                            <div className="text-xs text-muted-foreground">#{p.chestNumber}</div>
                                                        </TableCell>
                                                        <TableCell>{departments.find(d => d.id === p.departmentId)?.code}</TableCell>
                                                        <TableCell>
                                                            <div className="flex gap-1 justify-center">
                                                                <span className="flex items-center gap-0.5">
                                                                    <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-[10px] font-bold text-yellow-900">{p.gold}</div>
                                                                </span>
                                                                <span className="flex items-center gap-0.5">
                                                                    <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-700">{p.silver}</div>
                                                                </span>
                                                                <span className="flex items-center gap-0.5">
                                                                    <div className="w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center text-[10px] font-bold text-orange-900">{p.bronze}</div>
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">{p.points}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <User className="h-5 w-5" /> Top Female Athletes
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Dept</TableHead>
                                                    <TableHead className="text-center">Medals</TableHead>
                                                    <TableHead className="text-right">Pts</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {topFemale.map((p) => (
                                                    <TableRow key={p.id}>
                                                        <TableCell>
                                                            <div className="font-medium">{p.name}</div>
                                                            <div className="text-xs text-muted-foreground">#{p.chestNumber}</div>
                                                        </TableCell>
                                                        <TableCell>{departments.find(d => d.id === p.departmentId)?.code}</TableCell>
                                                        <TableCell>
                                                            <div className="flex gap-2 justify-center">
                                                                <span className="flex items-center gap-0.5">
                                                                    <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-[10px] font-bold text-yellow-900">{p.gold}</div>
                                                                </span>
                                                                <span className="flex items-center gap-0.5">
                                                                    <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-700">{p.silver}</div>
                                                                </span>
                                                                <span className="flex items-center gap-0.5">
                                                                    <div className="w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center text-[10px] font-bold text-orange-900">{p.bronze}</div>
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">{p.points}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="upcoming" className="space-y-4">
                            {upcomingEvents.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground">
                                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p>No upcoming events</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {upcomingEvents.map(renderEventCard)}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="done" className="space-y-4">
                            {completedEvents.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground">
                                    <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p>No completed events</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {completedEvents.map(renderEventCard)}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </main>

            {/* Register/Lookup Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{activeMode === "register" ? "Register" : "Lookup"}</DialogTitle>
                    </DialogHeader>

                    <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as "register" | "lookup")}>
                        <TabsList className="grid w-full grid-cols-1 mb-4">
                            <TabsTrigger value="lookup">
                                <Search className="h-4 w-4 mr-2" />
                                Lookup
                            </TabsTrigger>
                        </TabsList>

                        {/* Register Mode */}
                        <TabsContent value="register" className="space-y-4">
                            {registrationMessage && (
                                <div className={`p-4 rounded-md ${registrationMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    <p className="text-sm whitespace-pre-line">{registrationMessage.text}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="Enter your name"
                                    value={registrationForm.name}
                                    onChange={(e) => setRegistrationForm({ ...registrationForm, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="registerNumber">Register Number *</Label>
                                <Input
                                    id="registerNumber"
                                    placeholder="Enter your register number"
                                    value={registrationForm.registerNumber}
                                    onChange={(e) => setRegistrationForm({ ...registrationForm, registerNumber: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="department">Department *</Label>
                                <Select
                                    value={registrationForm.departmentId}
                                    onValueChange={(v) => setRegistrationForm({ ...registrationForm, departmentId: v })}
                                >
                                    <SelectTrigger id="department">
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((d) => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="batch">Batch</Label>
                                <Select
                                    value={registrationForm.batchId}
                                    onValueChange={(v) => setRegistrationForm({ ...registrationForm, batchId: v })}
                                >
                                    <SelectTrigger id="batch">
                                        <SelectValue placeholder="Select batch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {batches
                                            .filter(b => !registrationForm.departmentId || b.departmentId === registrationForm.departmentId)
                                            .map((b) => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="semester">Semester</Label>
                                <Select
                                    value={String(registrationForm.semester)}
                                    onValueChange={(v) => setRegistrationForm({ ...registrationForm, semester: Number(v) })}
                                >
                                    <SelectTrigger id="semester">
                                        <SelectValue placeholder="Select semester" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">S1/S2</SelectItem>
                                        <SelectItem value="3">S3/S4</SelectItem>
                                        <SelectItem value="5">S5/S6</SelectItem>
                                        <SelectItem value="7">S7/S8</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="gender">Gender *</Label>
                                <Select
                                    value={registrationForm.gender}
                                    onValueChange={(v) => setRegistrationForm({ ...registrationForm, gender: v as "male" | "female" })}
                                >
                                    <SelectTrigger id="gender">
                                        <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button
                                onClick={handleRegistration}
                                disabled={registering}
                                className="w-full"
                            >
                                {registering ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Registering...
                                    </>
                                ) : (
                                    'Register'
                                )}
                            </Button>
                        </TabsContent>

                        {/* Lookup Mode */}
                        <TabsContent value="lookup" className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="lookupInput">Enter Register Number</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="lookupInput"
                                        placeholder="Enter your register number"
                                        value={lookupQuery}
                                        onChange={(e) => setLookupQuery(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                                    />
                                    <Button onClick={handleLookup} disabled={searching}>
                                        {searching ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Search className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {lookupResult && (
                                <div className="mt-4 space-y-4">
                                    {lookupResult.participant ? (
                                        <>
                                            <Card className="border-2">
                                                <CardHeader>
                                                    <CardTitle className="text-lg">Participant Details</CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Name:</span>
                                                        <span className="font-semibold">{lookupResult.participant.name}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Chest Number:</span>
                                                        <Badge variant="outline" className="font-mono">{lookupResult.participant.chestNumber}</Badge>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Register Number:</span>
                                                        <span className="font-mono">{lookupResult.participant.registerNumber}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Department:</span>
                                                        <span>{departments.find(d => d.id === lookupResult.participant?.departmentId)?.name || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Gender:</span>
                                                        <span className="capitalize">{lookupResult.participant.gender}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardHeader>
                                                    <CardTitle className="text-lg">Registered Events ({lookupResult.events.length})</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    {lookupResult.events.length === 0 ? (
                                                        <p className="text-muted-foreground text-center py-4">Not registered for any events yet</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {lookupResult.events.map((event) => (
                                                                <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                                                    <div>
                                                                        <div className="font-medium">{event.name}</div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {event.type} • {event.gender}
                                                                        </div>
                                                                    </div>
                                                                    <Badge variant={
                                                                        event.status === 'completed' ? 'default' :
                                                                            event.status === 'ongoing' ? 'destructive' : 'secondary'
                                                                    }>
                                                                        {event.status}
                                                                    </Badge>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </>
                                    ) : (
                                        <Card className="border-2 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                                            <CardContent className="pt-6 text-center space-y-4">
                                                <p className="text-muted-foreground">No participant found with register number <span className="font-mono font-semibold">{lookupQuery}</span></p>
                                                <p className="text-sm">Would you like to register with this number?</p>
                                                <Button
                                                    onClick={() => {
                                                        setRegistrationForm({ ...registrationForm, registerNumber: lookupQuery });
                                                        setActiveMode("register");
                                                        setLookupResult(null);
                                                    }}
                                                    variant="default"
                                                >
                                                    <UserPlus className="h-4 w-4 mr-2" />
                                                    Register Now
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
}
