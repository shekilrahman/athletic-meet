import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import type { Department, Participant, Event } from "../types";
import { Trophy, Medal, User, Loader2 } from "lucide-react";

interface ParticipantStats {
    id: string;
    name: string;
    departmentId: string;
    chestNumber: string;
    gender: string;
    points: number;
    gold: number;
    silver: number;
    bronze: number;
}

interface DepartmentStats {
    id: string;
    name: string;
    code: string;
    points: number;
    gold: number;
    silver: number;
    bronze: number;
}

export default function Scoreboard() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [participantStats, setParticipantStats] = useState<ParticipantStats[]>([]);
    const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch base data
                const [deptSnapshot, partSnapshot, eventSnapshot] = await Promise.all([
                    getDocs(collection(db, "departments")),
                    getDocs(collection(db, "participants")),
                    getDocs(collection(db, "events"))
                ]);

                const deptData = deptSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Department[];
                setDepartments(deptData);

                const partData = partSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Participant[];

                const eventData = eventSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Event[];

                // Calculate points and medals from event results
                const partStatsMap = new Map<string, ParticipantStats>();
                const deptStatsMap = new Map<string, DepartmentStats>();

                // Initialize department stats
                deptData.forEach(dept => {
                    deptStatsMap.set(dept.id, {
                        id: dept.id,
                        name: dept.name,
                        code: dept.code,
                        points: 0,
                        gold: 0,
                        silver: 0,
                        bronze: 0
                    });
                });

                // Initialize participant stats
                partData.forEach(part => {
                    partStatsMap.set(part.id, {
                        id: part.id,
                        name: part.name,
                        departmentId: part.departmentId,
                        chestNumber: part.chestNumber,
                        gender: part.gender,
                        points: 0,
                        gold: 0,
                        silver: 0,
                        bronze: 0
                    });
                });

                // Process each event's results
                eventData.forEach(event => {
                    event.rounds?.forEach(round => {
                        round.participants?.forEach(result => {
                            if (result.rank) {
                                const participantId = result.participantId;
                                const partStat = partStatsMap.get(participantId);

                                if (partStat) {
                                    // Award points and medals based on rank using event-specific points
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

                                    // Update department stats
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

                setParticipantStats(Array.from(partStatsMap.values()));
                setDepartmentStats(Array.from(deptStatsMap.values()));
            } catch (error) {
                console.error("Error fetching scoreboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Sort participants by points
    const topMale = participantStats
        .filter(p => p.gender === 'male')
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

    const topFemale = participantStats
        .filter(p => p.gender === 'female')
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

    return (
        <Tabs defaultValue="departments" className="space-y-4">
            <TabsList>
                <TabsTrigger value="departments">Departments</TabsTrigger>
                <TabsTrigger value="individuals">Individuals</TabsTrigger>
            </TabsList>

            <TabsContent value="departments">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            Live Standings
                        </CardTitle>
                        <CardDescription>Real-time department rankings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Rank</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead className="text-right">Points</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {departmentStats.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                                            No departments found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    departmentStats.sort((a, b) => b.points - a.points).map((dept, index) => (
                                        <TableRow key={dept.id}>
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell>
                                                <span className="font-bold">{dept.code}</span>
                                                <div className="text-xs text-muted-foreground flex gap-1 mt-1">
                                                    <span className="flex items-center text-yellow-600"><Medal className="h-3 w-3 mr-0.5" /> {dept.gold}</span>
                                                    <span className="flex items-center text-gray-400"><Medal className="h-3 w-3 mr-0.5" /> {dept.silver}</span>
                                                    <span className="flex items-center text-orange-400"><Medal className="h-3 w-3 mr-0.5" /> {dept.bronze}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-lg">{dept.points}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="individuals">
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
                                        <TableHead>Name</TableHead>
                                        <TableHead>Dept</TableHead>
                                        <TableHead className="text-right">Pts</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topMale.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                No male athletes found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        topMale.map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell>
                                                    <div className="font-medium">{p.name}</div>
                                                    <div className="text-xs text-muted-foreground">#{p.chestNumber}</div>
                                                </TableCell>
                                                <TableCell>{departments.find(d => d.id === p.departmentId)?.code}</TableCell>
                                                <TableCell className="text-right font-bold">{p.points}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
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
                                        <TableHead className="text-right">Pts</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topFemale.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                No female athletes found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        topFemale.map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell>
                                                    <div className="font-medium">{p.name}</div>
                                                    <div className="text-xs text-muted-foreground">#{p.chestNumber}</div>
                                                </TableCell>
                                                <TableCell>{departments.find(d => d.id === p.departmentId)?.code}</TableCell>
                                                <TableCell className="text-right font-bold">{p.points}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    );
}
