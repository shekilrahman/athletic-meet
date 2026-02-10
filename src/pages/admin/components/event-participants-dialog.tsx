import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DialogHeader } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Users, Trash2, Loader2, Search, AlertCircle } from "lucide-react";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Badge } from "../../../components/ui/badge";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import type { Event, Participant, Department, Batch, Team } from "../../../types";

interface EventParticipantsDialogProps {
    event: Event;
    onUpdate: () => void;
}

export function EventParticipantsDialog({ event, onUpdate }: EventParticipantsDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [participants, setParticipants] = useState<(Participant | Team)[]>([]); // Can be Participant or Team
    const [loading, setLoading] = useState(true);

    // Metadata for Create New
    const [departments, setDepartments] = useState<Department[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);

    // Individual State
    const [searchChestNo, setSearchChestNo] = useState("");
    const [searchedParticipant, setSearchedParticipant] = useState<Participant | null>(null);
    const [searchError, setSearchError] = useState("");

    // Group State
    const [teamChestNos, setTeamChestNos] = useState<string[]>(Array(event.teamSize || 1).fill(""));
    const [teamName, setTeamName] = useState("");
    const [teamMembers, setTeamMembers] = useState<(Participant | null)[]>(Array(event.teamSize || 1).fill(null));

    // Create New State
    const [isCreating, setIsCreating] = useState(false);
    const [newParticipant, setNewParticipant] = useState({
        name: "",
        registerNumber: "",
        departmentId: "",
        batchId: "",
        gender: event.gender === 'mixed' ? 'male' : event.gender, // Default to event gender
        semester: 1,
    });

    const [processing, setProcessing] = useState(false);

    const fetchEventParticipants = useCallback(async () => {
        setLoading(true);
        try {
            if (!event.participants || event.participants.length === 0) {
                setParticipants([]);
                setLoading(false);
                return;
            }

            const promises = event.participants.map(async (id) => {
                if (event.type === 'group') {
                    const d = await getDoc(doc(db, "teams", id));
                    return d.exists() ? { id: d.id, ...d.data(), isTeam: true } as (Team & { isTeam: true }) : null;
                } else {
                    const d = await getDoc(doc(db, "participants", id));
                    return d.exists() ? { id: d.id, ...d.data(), isTeam: false } as (Participant & { isTeam: false }) : null;
                }
            });

            const results = await Promise.all(promises);
            setParticipants(results.filter(Boolean) as (Participant | Team)[]);
        } catch (error) {
            console.error("Error fetching participants", error);
        } finally {
            setLoading(false);
        }
    }, [event.participants, event.type]);

    const fetchMetadata = useCallback(async () => {
        const dSnap = await getDocs(collection(db, "departments"));
        setDepartments(dSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
        const bSnap = await getDocs(collection(db, "batches"));
        setBatches(bSnap.docs.map(b => ({ id: b.id, ...b.data() } as Batch)));
    }, []);

    // Initial Fetch
    useEffect(() => {
        if (isOpen) {
            fetchEventParticipants();
            fetchMetadata();
        }
    }, [isOpen, fetchEventParticipants, fetchMetadata]);


    // --- Searches ---
    const handleSearch = async (chestNo: string) => {
        setSearchChestNo(chestNo);
        setSearchedParticipant(null);
        setSearchError("");
        if (!chestNo) return;

        const q = query(collection(db, "participants"), where("chestNumber", "==", chestNo));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            setSearchError("Not found");
            return;
        }

        const p = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Participant;

        // Validate Gender
        if (event.gender !== 'mixed' && p.gender !== event.gender) {
            setSearchError(`Gender mismatch (${p.gender})`);
            return;
        }

        // Check if already in event (for individual)
        if (event.type === 'individual' && event.participants.includes(p.id)) {
            setSearchError("Already added");
            return;
        }

        setSearchedParticipant(p);
    };

    const handleTeamMemberSearch = async (index: number, chestNo: string) => {
        const newChestNos = [...teamChestNos];
        newChestNos[index] = chestNo;
        setTeamChestNos(newChestNos);

        const newMembers = [...teamMembers];
        newMembers[index] = null; // Reset current

        if (chestNo) {
            const q = query(collection(db, "participants"), where("chestNumber", "==", chestNo));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const p = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Participant;
                // Basic validation
                if (event.gender !== 'mixed' && p.gender !== event.gender) {
                    // Invalid gender, maybe show error visually? For now just don't set member
                } else {
                    newMembers[index] = p;
                }
            }
        }
        setTeamMembers(newMembers);
    };


    // --- Actions ---
    const addIndividual = async () => {
        if (!searchedParticipant) return;
        setProcessing(true);
        try {
            await updateDoc(doc(db, "events", event.id), {
                participants: arrayUnion(searchedParticipant.id)
            });
            setSearchChestNo("");
            setSearchedParticipant(null);
            fetchEventParticipants();
            onUpdate();
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(false);
        }
    };

    const registerTeam = async () => {
        if (teamMembers.some(m => !m)) {
            alert("Please find all team members first.");
            return;
        }
        if (!teamName) {
            alert("Please select a department.");
            return;
        }
        setProcessing(true);
        try {
            const memberIds = teamMembers.map(m => m!.id);
            const teamData: Omit<Team, 'id'> = {
                name: teamName,
                eventId: event.id,
                departmentId: departments.find(d => d.name === teamName)?.id || "",
                memberIds: memberIds
            };

            const teamRef = await addDoc(collection(db, "teams"), teamData);

            await updateDoc(doc(db, "events", event.id), {
                participants: arrayUnion(teamRef.id)
            });

            setTeamChestNos(Array(event.teamSize || 1).fill(""));
            setTeamMembers(Array(event.teamSize || 1).fill(null));
            setTeamName("");
            fetchEventParticipants();
            onUpdate();
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(false);
        }
    };

    const createAndAddParticipant = async () => {
        if (!newParticipant.name || !newParticipant.registerNumber || !newParticipant.departmentId) return;
        setProcessing(true);
        try {
            // Auto generate chest no
            const allParts = await getDocs(collection(db, "participants"));
            let maxChest = 100;
            allParts.docs.forEach(d => {
                const cn = parseInt(d.data().chestNumber);
                if (!isNaN(cn) && cn > maxChest) maxChest = cn;
            });
            const nextChest = String(maxChest + 1);

            const docRef = await addDoc(collection(db, "participants"), {
                ...newParticipant,
                chestNumber: nextChest,
                totalPoints: 0,
                individualWins: 0
            });

            const createdP = { id: docRef.id, ...newParticipant, chestNumber: nextChest } as Participant;

            if (event.type === 'individual') {
                await updateDoc(doc(db, "events", event.id), {
                    participants: arrayUnion(docRef.id)
                });
                setIsCreating(false);
                fetchEventParticipants();
                onUpdate();
            } else {
                alert(`Created ${createdP.name} with Chest No ${createdP.chestNumber}`);
                setIsCreating(false);
                // User has to type the new chest no into the team slot
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(false);
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm("Remove from event?")) return;
        try {
            await updateDoc(doc(db, "events", event.id), {
                participants: arrayRemove(id)
            });
            fetchEventParticipants();
            onUpdate();
        } catch (e) { console.error(e); }
    };

    const getDeptName = (id?: string) => departments.find(d => d.id === id)?.name || id;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Users className="mr-2 h-4 w-4" /> Participants ({event.participants?.length || 0})
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Participants - {event.name}</DialogTitle>
                    <DialogDescription>{event.type === 'group' ? `Register Teams (${event.teamSize} members)` : "Register Participants"}</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* LEFT: Registration Form */}
                    <div className="space-y-4 border-r pr-4">
                        <h3 className="font-semibold text-sm text-muted-foreground mr-2">
                            {isCreating ? "New Participant" : (event.type === 'group' ? "New Team" : "Add Participant")}
                        </h3>

                        {isCreating ? (
                            <div className="space-y-3 bg-muted/20 p-4 rounded-md border">
                                <Input placeholder="Name" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} />
                                <Input placeholder="Reg No" value={newParticipant.registerNumber} onChange={e => setNewParticipant({ ...newParticipant, registerNumber: e.target.value })} />
                                <Select value={newParticipant.departmentId} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, departmentId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                                    <SelectContent>
                                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {newParticipant.departmentId && (
                                    <Select value={newParticipant.batchId} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, batchId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
                                        <SelectContent>
                                            {batches.filter(b => b.departmentId === newParticipant.departmentId).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={createAndAddParticipant} disabled={processing}>
                                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create & Add"}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            // REGISTRATION MODE
                            event.type === 'group' ? (
                                <div className="space-y-3">
                                    <Select value={teamName} onValueChange={setTeamName}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select Department (Team Name)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map((dep) => (
                                                <SelectItem key={dep.id} value={dep.name}>
                                                    {dep.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="space-y-2">
                                        {Array.from({ length: event.teamSize || 1 }).map((_, i) => (
                                            <div key={i} className="flex gap-2 items-center">
                                                <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                                                <Input
                                                    className="w-24"
                                                    placeholder="Chest No"
                                                    value={teamChestNos[i]}
                                                    onChange={e => handleTeamMemberSearch(i, e.target.value)}
                                                />
                                                <div className="text-sm flex-1 truncate">
                                                    {teamMembers[i] ? (
                                                        <span className="text-green-600 flex items-center gap-1">
                                                            {teamMembers[i]?.name} <Badge variant="outline" className="text-[10px]">{getDeptName(teamMembers[i]?.departmentId)}</Badge>
                                                        </span>
                                                    ) : (
                                                        teamChestNos[i] && <span className="text-red-500 text-xs">Not found</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Button className="w-full" onClick={registerTeam} disabled={processing || teamMembers.some(m => !m)}>
                                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Team"}
                                    </Button>
                                </div>
                            ) : (
                                // INDIVIDUAL
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                className="pl-8"
                                                placeholder="Enter Chest Number"
                                                value={searchChestNo}
                                                onChange={e => handleSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {searchedParticipant ? (
                                        <div className="p-4 border rounded-md bg-green-50 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-lg">{searchedParticipant.name}</p>
                                                    <p className="text-sm text-muted-foreground">{getDeptName(searchedParticipant.departmentId)} • {searchedParticipant.registerNumber}</p>
                                                </div>
                                                <Badge className="text-lg px-3">{searchedParticipant.chestNumber}</Badge>
                                            </div>
                                            <Button className="w-full" onClick={addIndividual} disabled={processing}>
                                                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to Event"}
                                            </Button>
                                        </div>
                                    ) : (
                                        searchError ? (
                                            <Alert variant="destructive">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertDescription className="flex justify-between items-center">
                                                    <span>{searchError}</span>
                                                    {searchError === "Not found" && (
                                                        <Button variant="outline" size="sm" className="h-6 px-2" onClick={() => setIsCreating(true)}>
                                                            Create New
                                                        </Button>
                                                    )}
                                                </AlertDescription>
                                            </Alert>
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground text-sm">
                                                Type a chest number to search...
                                            </div>
                                        )
                                    )}
                                </div>
                            )
                        )}
                        {!isCreating && <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground text-center">
                                Don't have a chest number? <Button variant="link" className="p-0 h-auto" onClick={() => setIsCreating(true)}>Create new participant</Button>
                            </p>
                        </div>}
                    </div>

                    {/* RIGHT: Participation List */}
                    <div className="max-h-[500px] overflow-y-auto">
                        <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                            Current Participants ({participants.length})
                        </h3>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{event.type === 'group' ? 'Team' : 'Chest No'}</TableHead>
                                    <TableHead>Name/Members</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={3} className="text-center">Loading...</TableCell></TableRow>
                                ) : participants.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No participants.</TableCell></TableRow>
                                ) : (
                                    participants.map(p => {
                                        // Type guard
                                        const isTeam = 'memberIds' in p;
                                        if (isTeam) {
                                            const team = p as Team;
                                            return (
                                                <TableRow key={team.id}>
                                                    <TableCell className="font-medium">{team.name}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {team.memberIds.length} Members
                                                        {/* Could expand to show names if needed */}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemove(team.id)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        } else {
                                            const part = p as Participant;
                                            return (
                                                <TableRow key={part.id}>
                                                    <TableCell className="font-mono font-bold">{part.chestNumber}</TableCell>
                                                    <TableCell>
                                                        <div>{part.name}</div>
                                                        <div className="text-xs text-muted-foreground">{getDeptName(part.departmentId)}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemove(part.id)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
