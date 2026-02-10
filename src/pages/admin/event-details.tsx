import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Card, CardContent } from "../../components/ui/card";
import {
    ArrowLeft, Trash2, Loader2, Search, AlertCircle, Plus,
    Users,
    Edit,
    ChevronRight,
} from "lucide-react";
import type { Event, Participant, Department, Batch, Team } from "../../types";

// Helper function to display semester as group
const getSemesterGroup = (sem: number): string => {
    if (sem <= 2) return "S1/S2";
    if (sem <= 4) return "S3/S4";
    if (sem <= 6) return "S5/S6";
    return "S7/S8";
};

export default function AdminEventDetails() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();

    const [event, setEvent] = useState<Event | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);

    // Metadata
    const [departments, setDepartments] = useState<Department[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);

    // Helper functions (moved up to avoid ReferenceError)
    const getDeptName = (id?: string) => departments.find(d => d.id === id)?.name || "Unknown";
    const getBatchName = (id?: string) => batches.find(b => b.id === id)?.name || "Unknown";

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchChestNo, setSearchChestNo] = useState("");
    const [searchedParticipant, setSearchedParticipant] = useState<Participant | null>(null);
    const [searchError, setSearchError] = useState("");
    const [processing, setProcessing] = useState(false);

    // Group/Team state
    const [teamChestNos, setTeamChestNos] = useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [teamMembers, setTeamMembers] = useState<(Participant | null)[]>([]);
    const [teamErrors, setTeamErrors] = useState<string[]>([]);

    // Create new participant state
    const [isCreating, setIsCreating] = useState(false);
    const [newParticipant, setNewParticipant] = useState({
        name: "",
        registerNumber: "",
        departmentId: "",
        batchId: "",
        gender: "male" as "male" | "female",
        semester: 1,
    });

    // Edit participant state
    const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Fetch event
    const fetchEvent = useCallback(async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const eventDoc = await getDoc(doc(db, "events", eventId));
            if (eventDoc.exists()) {
                const eventData = { id: eventDoc.id, ...eventDoc.data() } as Event;
                setEvent(eventData);
                if (eventData.type === "group" && eventData.teamSize) {
                    setTeamChestNos(Array(eventData.teamSize).fill(""));
                    setTeamMembers(Array(eventData.teamSize).fill(null));
                    setTeamErrors(Array(eventData.teamSize).fill(""));
                }
                setNewParticipant(prev => ({
                    ...prev,
                    gender: eventData.gender === "mixed" ? "male" : eventData.gender
                }));
            }
        } catch (error) {
            console.error("Error fetching event:", error);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    // Fetch participants or teams
    const fetchParticipants = useCallback(async () => {
        if (!event?.participants || event.participants.length === 0) {
            setParticipants([]);
            setTeams([]);
            return;
        }

        try {
            if (event.type === "group") {
                const teamPromises = event.participants.map(async (id) => {
                    const d = await getDoc(doc(db, "teams", id));
                    if (!d.exists()) return null;
                    const team = { id: d.id, ...d.data() } as Team;
                    // Fetch team members
                    const memberPromises = team.memberIds.map(async (pid) => {
                        const pd = await getDoc(doc(db, "participants", pid));
                        return pd.exists() ? { id: pd.id, ...pd.data() } as Participant : null;
                    });
                    const members = (await Promise.all(memberPromises)).filter(Boolean) as Participant[];
                    return { ...team, members };
                });
                const teamsWithMembers = (await Promise.all(teamPromises)).filter(Boolean) as (Team & { members: Participant[] })[];
                setTeams(teamsWithMembers as Team[]);
            } else {
                const partPromises = event.participants.map(async (id) => {
                    const d = await getDoc(doc(db, "participants", id));
                    return d.exists() ? { id: d.id, ...d.data() } as Participant : null;
                });
                const parts = (await Promise.all(partPromises)).filter(Boolean) as Participant[];
                setParticipants(parts);
            }
        } catch (error) {
            console.error("Error fetching participants:", error);
        }
    }, [event?.participants, event?.type]);

    // Fetch metadata
    const fetchMetadata = useCallback(async () => {
        const dSnap = await getDocs(collection(db, "departments"));
        setDepartments(dSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
        const bSnap = await getDocs(collection(db, "batches"));
        setBatches(bSnap.docs.map(b => ({ id: b.id, ...b.data() } as Batch)));
    }, []);

    useEffect(() => {
        fetchEvent();
        fetchMetadata();
    }, [fetchEvent, fetchMetadata]);

    useEffect(() => {
        if (event) fetchParticipants();
    }, [event, fetchParticipants]);

    // Search handler
    const handleSearch = async (chestNo: string) => {
        setSearchChestNo(chestNo);
        setSearchedParticipant(null);
        setSearchError("");
        if (!chestNo || !event) return;

        const q = query(collection(db, "participants"), where("chestNumber", "==", chestNo));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            setSearchError("Not found");
            return;
        }

        const p = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Participant;

        if (event.gender !== "mixed" && p.gender !== event.gender) {
            setSearchError(`Gender mismatch (${p.gender})`);
            return;
        }

        if (event.participants?.includes(p.id)) {
            setSearchError("Already added");
            return;
        }

        setSearchedParticipant(p);
    };

    // Team member search with validation
    const handleTeamMemberSearch = async (index: number, chestNo: string) => {
        if (!event) return;

        const newChestNos = [...teamChestNos];
        newChestNos[index] = chestNo;
        setTeamChestNos(newChestNos);

        const newMembers = [...teamMembers];
        const newErrors = [...teamErrors];
        newMembers[index] = null;
        newErrors[index] = "";

        if (!chestNo) {
            setTeamMembers(newMembers);
            setTeamErrors(newErrors);
            return;
        }

        // Check duplicate
        const duplicateIndex = newChestNos.findIndex((cn, i) => i !== index && cn === chestNo && cn !== "");
        if (duplicateIndex !== -1) {
            newErrors[index] = "Duplicate";
            setTeamMembers(newMembers);
            setTeamErrors(newErrors);
            return;
        }

        const q = query(collection(db, "participants"), where("chestNumber", "==", chestNo));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            newErrors[index] = "Not found";
            setTeamMembers(newMembers);
            setTeamErrors(newErrors);
            return;
        }

        const p = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Participant;

        if (event.gender !== "mixed" && p.gender !== event.gender) {
            newErrors[index] = "Wrong gender";
            setTeamMembers(newMembers);
            setTeamErrors(newErrors);
            return;
        }

        const selectedDeptId = departments.find(d => d.name === selectedDepartment)?.id;
        if (selectedDeptId && p.departmentId !== selectedDeptId) {
            newErrors[index] = "Wrong dept";
            setTeamMembers(newMembers);
            setTeamErrors(newErrors);
            return;
        }

        newMembers[index] = p;
        setTeamMembers(newMembers);
        setTeamErrors(newErrors);
    };

    // Add individual participant
    const addIndividual = async () => {
        if (!searchedParticipant || !event) return;
        setProcessing(true);
        try {
            await updateDoc(doc(db, "events", event.id), {
                participants: arrayUnion(searchedParticipant.id)
            });
            setSearchChestNo("");
            setSearchedParticipant(null);
            setIsAddModalOpen(false);
            fetchEvent();
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(false);
        }
    };

    // Register team
    const registerTeam = async () => {
        if (!event) return;

        if (teamMembers.some(m => !m)) {
            alert("Please find all team members first.");
            return;
        }
        if (!selectedDepartment) {
            alert("Please select a department.");
            return;
        }
        if (teamErrors.some(e => e !== "")) {
            alert("Please fix all errors before registering.");
            return;
        }

        const ids = teamMembers.map(m => m!.id);
        if (new Set(ids).size !== ids.length) {
            alert("Duplicate members detected.");
            return;
        }

        setProcessing(true);
        try {
            const selectedDeptId = departments.find(d => d.name === selectedDepartment)?.id || "";
            const teamData: Omit<Team, "id"> = {
                name: selectedDepartment,
                eventId: event.id,
                departmentId: selectedDeptId,
                memberIds: ids
            };

            const teamRef = await addDoc(collection(db, "teams"), teamData);
            await updateDoc(doc(db, "events", event.id), {
                participants: arrayUnion(teamRef.id)
            });

            setTeamChestNos(Array(event.teamSize || 1).fill(""));
            setTeamMembers(Array(event.teamSize || 1).fill(null));
            setTeamErrors(Array(event.teamSize || 1).fill(""));
            setSelectedDepartment("");
            setIsAddModalOpen(false);
            fetchEvent();
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(false);
        }
    };

    // Create new participant
    const createAndAddParticipant = async () => {
        if (!newParticipant.name || !newParticipant.registerNumber || !newParticipant.departmentId || !event) return;
        setProcessing(true);
        try {
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

            if (event.type === "individual") {
                await updateDoc(doc(db, "events", event.id), {
                    participants: arrayUnion(docRef.id)
                });
                setIsCreating(false);
                setIsAddModalOpen(false);
                fetchEvent();
            } else {
                alert(`Created with Chest No ${nextChest}. Enter this in the team form.`);
                setIsCreating(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(false);
        }
    };

    // Remove participant or team
    const handleRemove = async (id: string) => {
        if (!confirm("Remove from event?") || !event) return;
        try {
            await updateDoc(doc(db, "events", event.id), {
                participants: arrayRemove(id)
            });
            fetchEvent();
        } catch (e) {
            console.error(e);
        }
    };

    // Update participant
    const handleUpdateParticipant = async () => {
        if (!editingParticipant) return;
        setProcessing(true);
        try {
            await updateDoc(doc(db, "participants", editingParticipant.id), {
                name: editingParticipant.name,
                registerNumber: editingParticipant.registerNumber,
                departmentId: editingParticipant.departmentId,
                batchId: editingParticipant.batchId,
                semester: editingParticipant.semester,
                gender: editingParticipant.gender
            });
            setIsEditModalOpen(false);
            setEditingParticipant(null);
            fetchEvent();
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(false);
        }
    };

    // ─── Round Manager Logic (Ported from Staff) ────────────────
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isNextRoundFinal, setIsNextRoundFinal] = useState(false);
    const [renameRoundName, setRenameRoundName] = useState("");
    const [roundSaving, setRoundSaving] = useState(false);

    const getRoundName = (index: number): string => `Round ${index + 1}`;

    const handleAdvanceExperiment = async (nextName: string) => {
        if (!event || !eventId) return;
        setRoundSaving(true);
        try {
            const nextIndex = (event.currentRoundIndex || 0) + 1;
            const updatedRounds = [...(event.rounds || [])];

            // Mark current as complete if exists
            if (updatedRounds[event.currentRoundIndex]) {
                updatedRounds[event.currentRoundIndex].status = "completed";
            }

            updatedRounds.push({
                id: `r_${Date.now()}`,
                name: nextName,
                sequence: nextIndex + 1,
                status: "pending",
                participants: []
            });

            await updateDoc(doc(db, "events", eventId), {
                rounds: updatedRounds,
                currentRoundIndex: nextIndex
            });

            setIsManagerOpen(false);
            fetchEvent();
        } catch (e) { console.error(e); alert("Failed to advance."); }
        setRoundSaving(false);
    };

    const handleMakeFinal = async () => {
        if (!event || !eventId) return;
        setRoundSaving(true);
        try {
            const updatedRounds = [...(event.rounds || [])];
            const curIdx = event.currentRoundIndex || 0;
            if (updatedRounds[curIdx]) {
                updatedRounds[curIdx].name = "Final";
                await updateDoc(doc(db, "events", eventId), { rounds: updatedRounds });
                setIsManagerOpen(false);
                fetchEvent();
            }
        } catch (e) {
            console.error(e);
            alert("Failed to update round.");
        }
        setRoundSaving(false);
    };

    const handleRenameCurrent = async () => {
        if (!event || !eventId || !renameRoundName.trim()) return;
        setRoundSaving(true);
        try {
            const updatedRounds = [...(event.rounds || [])];
            const curIdx = event.currentRoundIndex || 0;
            if (updatedRounds[curIdx]) {
                updatedRounds[curIdx].name = renameRoundName.trim();
                await updateDoc(doc(db, "events", eventId), { rounds: updatedRounds });
                setIsManagerOpen(false);
                fetchEvent();
            }
        } catch (e) { console.error(e); alert("Failed to rename."); }
        setRoundSaving(false);
    };

    const handleCloseEvent = async () => {
        if (!event || !eventId) return;
        setRoundSaving(true);
        try {
            const updatedRounds = [...(event.rounds || [])];
            const curIdx = event.currentRoundIndex || 0;
            if (updatedRounds[curIdx]) {
                updatedRounds[curIdx].status = "completed";
            }
            await updateDoc(doc(db, "events", eventId), {
                rounds: updatedRounds,
                status: "completed"
            });
            setIsManagerOpen(false);
            fetchEvent();
        } catch (e) { console.error(e); }
        setRoundSaving(false);
    };

    // ────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
                <p className="text-muted-foreground text-lg">Event not found.</p>
                <Button variant="link" onClick={() => navigate("/admin/events")}>Back to Events</Button>
            </div>
        );
    }

    // Derived for UI
    const curRoundData = event.rounds?.[event.currentRoundIndex || 0];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/events")}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold">{event.name}</h1>
                                <div className="flex gap-2 mt-1">
                                    <Badge>{event.gender}</Badge>
                                    <Badge variant="outline">
                                        {event.type === "group" ? <><Users className="h-3 w-3 mr-1" />{event.type} ({event.teamSize})</> : event.type}
                                    </Badge>
                                    <Badge variant={event.status === "completed" ? "secondary" : "default"}>{event.status}</Badge>
                                    {curRoundData && <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">{curRoundData.name}</Badge>}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {/* Round Manager */}
                            <Dialog open={isManagerOpen} onOpenChange={setIsManagerOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <Edit className="h-4 w-4" /> Manage Event
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Event Control</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-6 pt-4">
                                        <div className="space-y-2 p-3 bg-gray-50 rounded-xl border">
                                            <AlertDescription className="text-xs font-bold uppercase text-muted-foreground">Current Round</AlertDescription>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder={curRoundData?.name || "Round Name"}
                                                    onChange={(e) => setRenameRoundName(e.target.value)}
                                                />
                                                <Button size="sm" onClick={handleRenameCurrent} disabled={roundSaving}>Rename</Button>
                                                {curRoundData?.name !== "Final" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleMakeFinal}
                                                        disabled={roundSaving}
                                                        className="whitespace-nowrap"
                                                    >
                                                        Make Final
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2"><div className="h-px bg-gray-200 flex-1"></div><span className="text-xs font-bold text-muted-foreground uppercase">Progression</span><div className="h-px bg-gray-200 flex-1"></div></div>

                                                <div className="p-4 bg-gray-50 rounded-xl border space-y-4">
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            id="isFinalAdmin"
                                                            checked={isNextRoundFinal}
                                                            onChange={(e) => setIsNextRoundFinal(e.target.checked)}
                                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                                        />
                                                        <label
                                                            htmlFor="isFinalAdmin"
                                                            className="text-sm font-medium leading-none cursor-pointer select-none"
                                                        >
                                                            Is this the <strong>Final Round</strong>?
                                                        </label>
                                                    </div>

                                                    <Button
                                                        className="w-full"
                                                        onClick={() => handleAdvanceExperiment(isNextRoundFinal ? "Final" : getRoundName((event.currentRoundIndex || 0) + 1))}
                                                        disabled={roundSaving}
                                                    >
                                                        Start {isNextRoundFinal ? "Final" : getRoundName((event.currentRoundIndex || 0) + 1)}
                                                        <ChevronRight className="ml-2 h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <Button variant="ghost" className="w-full text-red-600" onClick={handleCloseEvent} disabled={roundSaving}>Complete Event</Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            {/* Add Participant Button */}
                            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                                <DialogTrigger asChild>
                                    <Button>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add {event.type === "group" ? "Team" : "Participant"}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>
                                            {isCreating ? "Create New Participant" : (event.type === "group" ? "Register Team" : "Add Participant")}
                                        </DialogTitle>
                                    </DialogHeader>

                                    {isCreating ? (
                                        <div className="space-y-3">
                                            <Input placeholder="Name" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} />
                                            <Input placeholder="Register Number" value={newParticipant.registerNumber} onChange={e => setNewParticipant({ ...newParticipant, registerNumber: e.target.value })} />
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
                                            <Select value={String(newParticipant.semester)} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, semester: parseInt(v) })}>
                                                <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">S1/S2</SelectItem>
                                                    <SelectItem value="3">S3/S4</SelectItem>
                                                    <SelectItem value="5">S5/S6</SelectItem>
                                                    <SelectItem value="7">S7/S8</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <div className="flex gap-2 pt-2">
                                                <Button onClick={createAndAddParticipant} disabled={processing}>
                                                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create & Add"}
                                                </Button>
                                                <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                                            </div>
                                        </div>
                                    ) : event.type === "group" ? (
                                        <div className="space-y-4">
                                            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                                <SelectTrigger><SelectValue placeholder="Select Department (Team Name)" /></SelectTrigger>
                                                <SelectContent>
                                                    {departments.map(dep => <SelectItem key={dep.id} value={dep.name}>{dep.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>

                                            <div className="space-y-2">
                                                {Array.from({ length: event.teamSize || 1 }).map((_, i) => (
                                                    <div key={i} className="flex gap-2 items-center">
                                                        <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                                                        <Input
                                                            className="w-28"
                                                            placeholder="Chest No"
                                                            value={teamChestNos[i] || ""}
                                                            onChange={e => handleTeamMemberSearch(i, e.target.value)}
                                                        />
                                                        <div className="text-sm flex-1 truncate">
                                                            {teamMembers[i] ? (
                                                                <span className="text-green-600">{teamMembers[i]?.name}</span>
                                                            ) : teamErrors[i] ? (
                                                                <span className="text-red-500 text-xs">{teamErrors[i]}</span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <Button className="w-full" onClick={registerTeam} disabled={processing || teamMembers.some(m => !m) || !selectedDepartment}>
                                                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Team"}
                                            </Button>
                                            <p className="text-xs text-muted-foreground text-center">
                                                <Button variant="link" className="p-0 h-auto text-xs" onClick={() => setIsCreating(true)}>Create new participant</Button>
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    className="pl-10"
                                                    placeholder="Enter Chest Number"
                                                    value={searchChestNo}
                                                    onChange={e => handleSearch(e.target.value)}
                                                />
                                            </div>

                                            {searchedParticipant ? (
                                                <Card className="bg-green-50 border-green-200">
                                                    <CardContent className="p-4">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <p className="font-bold text-lg">{searchedParticipant.name}</p>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {getDeptName(searchedParticipant.departmentId)} • {getBatchName(searchedParticipant.batchId)} • {getSemesterGroup(searchedParticipant.semester)}
                                                                </p>
                                                            </div>
                                                            <Badge className="text-lg px-3">{searchedParticipant.chestNumber}</Badge>
                                                        </div>
                                                        <Button className="w-full" onClick={addIndividual} disabled={processing}>
                                                            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to Event"}
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            ) : searchError ? (
                                                <Alert variant="destructive">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertDescription className="flex justify-between items-center">
                                                        <span>{searchError}</span>
                                                        {searchError === "Not found" && (
                                                            <Button variant="outline" size="sm" onClick={() => setIsCreating(true)}>Create New</Button>
                                                        )}
                                                    </AlertDescription>
                                                </Alert>
                                            ) : (
                                                <p className="text-center py-6 text-muted-foreground">Type a chest number to search...</p>
                                            )}

                                            <p className="text-xs text-muted-foreground text-center">
                                                <Button variant="link" className="p-0 h-auto text-xs" onClick={() => setIsCreating(true)}>Create new participant</Button>
                                            </p>
                                        </div>
                                    )}
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 py-6">
                <h2 className="text-lg font-semibold mb-4">
                    {event.type === "group" ? "Teams" : "Participants"} ({event.type === "group" ? teams.length : participants.length})
                </h2>

                {event.type === "group" ? (
                    // Teams Grid
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {teams.length === 0 ? (
                            <p className="text-muted-foreground col-span-full text-center py-12">No teams registered yet.</p>
                        ) : (
                            teams.map((team: Team & { members?: Participant[] }) => (
                                <Card key={team.id} className="overflow-hidden">
                                    <CardContent className="p-0">
                                        <div className="bg-primary/5 px-4 py-3 flex justify-between items-center border-b">
                                            <span className="font-semibold">{team.name}</span>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemove(team.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-2">
                                            {team.members?.map((member) => (
                                                <div key={member.id} className="flex items-center gap-3 text-sm">
                                                    <span className="font-mono text-primary font-bold">#{member.chestNumber}</span>
                                                    <div className="flex-1">
                                                        <p className="font-medium">{member.name}</p>
                                                        <p className="text-xs text-muted-foreground">{getSemesterGroup(member.semester)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                ) : (
                    // Participants Grid
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {participants.length === 0 ? (
                            <p className="text-muted-foreground col-span-full text-center py-12">No participants registered yet.</p>
                        ) : (
                            participants.map(p => (
                                <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-start gap-3">
                                                <div className="bg-primary text-primary-foreground font-mono font-bold text-lg px-3 py-1 rounded">
                                                    {p.chestNumber}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-lg">{p.name}</p>
                                                    <p className="text-sm text-muted-foreground">{getDeptName(p.departmentId)}</p>
                                                    <div className="flex gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs">{getBatchName(p.batchId)}</Badge>
                                                        <Badge variant="secondary" className="text-xs">{getSemesterGroup(p.semester)}</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingParticipant(p); setIsEditModalOpen(true); }}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemove(p.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                )}
            </main>

            {/* Edit Participant Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Participant</DialogTitle>
                    </DialogHeader>
                    {editingParticipant && (
                        <div className="space-y-3">
                            <Input
                                placeholder="Name"
                                value={editingParticipant.name}
                                onChange={e => setEditingParticipant({ ...editingParticipant, name: e.target.value })}
                            />
                            <Input
                                placeholder="Register Number"
                                value={editingParticipant.registerNumber}
                                onChange={e => setEditingParticipant({ ...editingParticipant, registerNumber: e.target.value })}
                            />
                            <Select value={editingParticipant.departmentId} onValueChange={(v: string) => setEditingParticipant({ ...editingParticipant, departmentId: v })}>
                                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                                <SelectContent>
                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={editingParticipant.batchId} onValueChange={(v: string) => setEditingParticipant({ ...editingParticipant, batchId: v })}>
                                <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
                                <SelectContent>
                                    {batches.filter(b => b.departmentId === editingParticipant.departmentId).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={String(editingParticipant.semester)} onValueChange={(v: string) => setEditingParticipant({ ...editingParticipant, semester: parseInt(v) })}>
                                <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">S1/S2</SelectItem>
                                    <SelectItem value="3">S3/S4</SelectItem>
                                    <SelectItem value="5">S5/S6</SelectItem>
                                    <SelectItem value="7">S7/S8</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex gap-2 pt-2">
                                <Button onClick={handleUpdateParticipant} disabled={processing}>
                                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
                                </Button>
                                <Button variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditingParticipant(null); }}>Cancel</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
