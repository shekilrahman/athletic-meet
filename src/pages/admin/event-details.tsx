import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
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
    Printer,
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import type { Event, Participant, Department, Batch, Team } from "../../types";

// Helper function to display semester as group
const getSemesterGroup = (sem: number | string): string => {
    const s = typeof sem === 'string' ? parseInt(sem) : sem;
    if (s <= 2) return "S1/S2";
    if (s <= 4) return "S3/S4";
    if (s <= 6) return "S5/S6";
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
    const getDeptName = (id?: string) => {
        if (!id) return "Unknown";
        const d = departments.find(d => d.id === id);
        return d ? d.name : "Unknown";
    };
    const getDeptCode = (id?: string) => {
        if (!id) return "-";
        const d = departments.find(d => d.id === id);
        return d ? d.code : "-";
    };
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
        semester: "1",
    });

    // Edit participant state
    const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Fetch event
    const fetchEvent = useCallback(async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*, programs(name, id, category)')
                .eq('id', eventId)
                .single();

            if (error) throw error;

            if (data) {
                // Ensure data matches Event type
                const eventData = {
                    ...data,
                    teamSize: data.team_size || data.teamSize, // Handle snake_case from DB
                    points1st: data.points_1st || data.points1st, // potential other snake_case
                    points2nd: data.points_2nd || data.points2nd,
                    points3rd: data.points_3rd || data.points3rd,
                } as Event;

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
                const { data: teamsData, error: teamsError } = await supabase
                    .from('teams')
                    .select('*')
                    .in('id', event.participants);

                if (teamsError) throw teamsError;

                if (teamsError) throw teamsError;

                // Map snake_case to camelCase for Teams
                const teamsList = (teamsData || []).map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    eventId: t.event_id,
                    departmentId: t.department_id,
                    memberIds: t.member_ids || []
                })) as Team[];

                // Fetch members for all teams
                // We need to fetch all participants that are in any of these teams
                const allMemberIds = teamsList.flatMap(t => t.memberIds);
                if (allMemberIds.length > 0) {
                    const { data: membersData, error: membersError } = await supabase
                        .from('participants')
                        .select('*')
                        .in('id', allMemberIds);

                    if (membersError) throw membersError;

                    const membersMap = new Map((membersData || []).map((p: any) => [
                        p.id,
                        mapParticipant(p)
                    ]));

                    const teamsWithMembers = teamsList.map(t => {
                        const members = t.memberIds.map(mid => membersMap.get(mid)).filter(Boolean) as Participant[];
                        // Sort team members numerically by chest number
                        members.sort((a, b) => {
                            const aNum = parseInt(a.chestNumber) || 0;
                            const bNum = parseInt(b.chestNumber) || 0;
                            return aNum - bNum;
                        });
                        return { ...t, members };
                    });
                    setTeams(teamsWithMembers);
                } else {
                    setTeams(teamsList.map(t => ({ ...t, members: [] })));
                }

            } else {
                const { data: partsData, error: partsError } = await supabase
                    .from('participants')
                    .select('*')
                    .in('id', event.participants);

                if (partsError) throw partsError;

                // Map snake_case to camelCase
                const mappedParticipants = (partsData || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    registerNumber: p.register_number,
                    departmentId: p.department_id,
                    batchId: p.batch_id,
                    semester: p.semester,
                    gender: p.gender,
                    chestNumber: p.chest_number,
                    totalPoints: p.total_points,
                    individualWins: p.individual_wins
                })) as Participant[];

                // Sort numerically by chest number
                mappedParticipants.sort((a, b) => {
                    const aNum = parseInt(a.chestNumber) || 0;
                    const bNum = parseInt(b.chestNumber) || 0;
                    return aNum - bNum;
                });

                setParticipants(mappedParticipants);
            }
        } catch (error) {
            console.error("Error fetching participants:", error);
        }
    }, [event?.participants, event?.type]);

    // Fetch metadata
    // Fetch metadata
    const fetchMetadata = useCallback(async () => {
        try {
            const [
                { data: dData, error: dError },
                { data: bData, error: bError }
            ] = await Promise.all([
                supabase.from('departments').select('*'),
                supabase.from('batches').select('*')
            ]);

            if (dError) throw dError;
            if (bError) throw bError;

            setDepartments((dData || []) as Department[]);
            setBatches((bData || []).map((b: any) => ({
                id: b.id,
                name: b.name,
                departmentId: b.department_id
            })) as Batch[]);
        } catch (error) {
            console.error("Error fetching metadata:", error);
        }
    }, []);

    useEffect(() => {
        fetchEvent();
        fetchMetadata();
    }, [fetchEvent, fetchMetadata]);

    useEffect(() => {
        if (event) fetchParticipants();
    }, [event, fetchParticipants]);

    // Helper to map DB result to Participant
    const mapParticipant = (p: any): Participant => ({
        id: p.id,
        name: p.name,
        registerNumber: p.register_number,
        departmentId: p.department_id,
        batchId: p.batch_id,
        semester: p.semester,
        gender: p.gender,
        chestNumber: p.chest_number,
        totalPoints: p.total_points,
        individualWins: p.individual_wins
    });

    // Search handler
    const handleSearch = async (chestNo: string) => {
        const term = chestNo.toUpperCase(); // Force uppercase
        setSearchChestNo(term);
        setSearchedParticipant(null);
        setSearchError("");
        if (!term || !event) return;

        const { data, error } = await supabase
            .from('participants')
            .select('*')
            .or(`chest_number.eq.${term},register_number.eq.${term}`); // exact match


        if (error) {
            console.error("Search error", error);
            setSearchError("Error searching");
            return;
        }

        if (!data || data.length === 0) {
            setSearchError("Not found");
            return;
        }

        const p = mapParticipant(data[0]);

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

        const { data, error } = await supabase
            .from('participants')
            .select('*')
            .or(`chest_number.ilike.%${chestNo}%,register_number.ilike.%${chestNo}%`);

        if (error || !data || data.length === 0) {
            newErrors[index] = "Not found";
            setTeamMembers(newMembers);
            setTeamErrors(newErrors);
            return;
        }

        const p = mapParticipant(data[0]);

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

    // Helper to open create form with pre-filled register number
    const openCreateFormWithPreFill = (regNo: string) => {
        setNewParticipant(prev => ({ ...prev, registerNumber: regNo }));
        setIsCreating(true);
    };

    // Add individual participant
    const addIndividual = async () => {
        if (!searchedParticipant || !event) return;
        setProcessing(true);
        try {
            const currentParticipants = event.participants || [];
            const updatedParticipants = [...currentParticipants, searchedParticipant.id];

            const { error } = await supabase
                .from('events')
                .update({ participants: updatedParticipants })
                .eq('id', event.id);

            if (error) throw error;

            setSearchChestNo("");
            setSearchedParticipant(null);
            setIsAddModalOpen(false);
            fetchEvent();
        } catch (e) {
            console.error(e);
            alert("Failed to add participant");
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
            const selectedDeptId = departments.find(d => d.name === selectedDepartment)?.id || null;
            // Insert Team
            const { data: teamRef, error: createError } = await supabase
                .from('teams')
                .insert([{
                    id: crypto.randomUUID(),
                    name: selectedDepartment,
                    event_id: event.id,
                    department_id: selectedDeptId,
                    member_ids: ids
                }])
                .select()
                .single();

            if (createError) throw createError;

            // Update Event participants
            const currentParticipants = event.participants || [];
            const updatedParticipants = [...currentParticipants, teamRef.id];

            const { error: updateError } = await supabase
                .from('events')
                .update({ participants: updatedParticipants })
                .eq('id', event.id);

            if (updateError) throw updateError;

            setTeamChestNos(Array(event.teamSize || 1).fill(""));
            setTeamMembers(Array(event.teamSize || 1).fill(null));
            setTeamErrors(Array(event.teamSize || 1).fill(""));
            setSelectedDepartment("");
            setIsAddModalOpen(false);
            fetchEvent();
        } catch (e) {
            console.error(e);
            alert("Failed to register team");
        } finally {
            setProcessing(false);
        }
    };

    // Create new participant
    const createAndAddParticipant = async () => {
        if (!newParticipant.name || !newParticipant.registerNumber || !newParticipant.departmentId || !event) return;
        setProcessing(true);
        try {
            // Auto-generate chest number (simple MAX + 1)
            const { data: allParts, error: fetchError } = await supabase
                .from('participants')
                .select('chest_number'); // Snake case in DB

            if (fetchError) throw fetchError;

            let maxChest = 100;
            allParts.forEach((p: any) => {
                const cn = parseInt(p.chest_number);
                if (!isNaN(cn) && cn > maxChest) maxChest = cn;
            });
            const nextChest = String(maxChest + 1);

            const { data: docRef, error: insertError } = await supabase
                .from('participants')
                .insert([{
                    id: crypto.randomUUID(),
                    name: newParticipant.name,
                    register_number: newParticipant.registerNumber,
                    department_id: newParticipant.departmentId,
                    batch_id: newParticipant.batchId || null,
                    gender: newParticipant.gender,
                    semester: newParticipant.semester,
                    chest_number: nextChest,
                    total_points: 0,
                    individual_wins: 0
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            if (event.type === "individual") {
                const currentParticipants = event.participants || [];
                const updatedParticipants = [...currentParticipants, docRef.id];

                const { error: updateError } = await supabase
                    .from('events')
                    .update({ participants: updatedParticipants })
                    .eq('id', event.id);

                if (updateError) throw updateError;

                setIsCreating(false);
                setIsAddModalOpen(false);
                fetchEvent();
            } else {
                alert(`Created with Chest No ${nextChest}. Enter this in the team form.`);
                setIsCreating(false);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to create participant");
        } finally {
            setProcessing(false);
        }
    };

    // Remove participant or team
    const handleRemove = async (id: string) => {
        if (!confirm("Remove from event?") || !event) return;
        try {
            const currentParticipants = event.participants || [];
            const updatedParticipants = currentParticipants.filter(pid => pid !== id);

            const { error } = await supabase
                .from('events')
                .update({ participants: updatedParticipants })
                .eq('id', event.id);

            if (error) throw error;
            fetchEvent();
        } catch (e) {
            console.error(e);
            alert("Failed to remove participant");
        }
    };

    // Update participant
    const handleUpdateParticipant = async () => {
        if (!editingParticipant) return;
        setProcessing(true);
        try {
            const { error } = await supabase
                .from('participants')
                .update({
                    name: editingParticipant.name,
                    register_number: editingParticipant.registerNumber,
                    department_id: editingParticipant.departmentId,
                    batch_id: editingParticipant.batchId,
                    semester: editingParticipant.semester,
                    gender: editingParticipant.gender
                })
                .eq('id', editingParticipant.id);

            if (error) throw error;

            setIsEditModalOpen(false);
            setEditingParticipant(null);
            fetchEvent(); // Refresh event/participants list
        } catch (e) {
            console.error(e);
            alert("Failed to update participant");
        } finally {
            setProcessing(false);
        }
    };

    // ─── Round Manager Logic ────────────────
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

            const { error } = await supabase
                .from('events')
                .update({
                    rounds: updatedRounds, // Jsonb update
                    current_round_index: nextIndex
                })
                .eq('id', eventId);

            if (error) throw error;

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
                const { error } = await supabase
                    .from('events')
                    .update({ rounds: updatedRounds })
                    .eq('id', eventId);

                if (error) throw error;
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
                const { error } = await supabase
                    .from('events')
                    .update({ rounds: updatedRounds })
                    .eq('id', eventId);

                if (error) throw error;

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
            const { error } = await supabase
                .from('events')
                .update({
                    rounds: updatedRounds,
                    status: "completed"
                })
                .eq('id', eventId);

            if (error) throw error;

            setIsManagerOpen(false);
            fetchEvent();
        } catch (e) { console.error(e); }
        setRoundSaving(false);
    };

    const handlePrint = () => {
        window.print();
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

                            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                                <Printer className="h-4 w-4" /> Print List
                            </Button>

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
                                            <Select value={newParticipant.semester} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, semester: v })}>
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
                                            {event.programs?.category === 'department' ? (
                                                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                                    <SelectTrigger><SelectValue placeholder="Select Department (Team Name)" /></SelectTrigger>
                                                    <SelectContent>
                                                        {departments.map(dep => <SelectItem key={dep.id} value={dep.name}>{dep.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            ) : event.programs?.category === 'semester' ? (
                                                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                                    <SelectTrigger><SelectValue placeholder="Select Semester (Team Name)" /></SelectTrigger>
                                                    <SelectContent>
                                                        {['S1/S2', 'S3/S4', 'S5/S6', 'S7/S8'].map((semPair) => (
                                                            <SelectItem key={semPair} value={semPair}>
                                                                {semPair}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input
                                                    placeholder="Enter Team Name"
                                                    value={selectedDepartment}
                                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                                />
                                            )}

                                            <div className="space-y-2">
                                                {Array.from({ length: event.teamSize || 1 }).map((_, i) => (
                                                    <div key={i} className="flex gap-2 items-center">
                                                        <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                                                        <Input
                                                            className="w-28 uppercase"
                                                            placeholder="Chest/Reg No"
                                                            value={teamChestNos[i] || ""}
                                                            onChange={e => handleTeamMemberSearch(i, e.target.value.toUpperCase())}
                                                        />
                                                        <div className="text-sm flex-1 truncate flex items-center gap-2">
                                                            {teamMembers[i] ? (
                                                                <span className="text-green-600">{teamMembers[i]?.name}</span>
                                                            ) : teamErrors[i] ? (
                                                                <>
                                                                    <span className="text-red-500 text-xs">{teamErrors[i]}</span>
                                                                    {teamErrors[i] === "Not found" && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            className="h-6 text-xs px-2"
                                                                            onClick={() => openCreateFormWithPreFill(teamChestNos[i])}
                                                                        >
                                                                            Register
                                                                        </Button>
                                                                    )}
                                                                </>
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
                                                    className="pl-10 uppercase" // Visual uppercase
                                                    placeholder="Chest Number or Register Number"
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
                                                            <Button variant="outline" size="sm" onClick={() => {
                                                                setNewParticipant(prev => ({ ...prev, registerNumber: searchChestNo }));
                                                                setIsCreating(true);
                                                            }}>Create New</Button>
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
            <main className="max-w-6xl mx-auto px-4 py-6 print:p-0 print:max-w-none">
                {/* Print Only Header */}
                <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
                    <h1 className="text-3xl font-black uppercase tracking-widest">{event.name}</h1>
                    <div className="flex justify-center gap-6 mt-2 text-sm font-bold">
                        <span className="uppercase">{event.type} EVENT</span>
                        <span className="uppercase">{event.gender}</span>
                        {curRoundData && <span className="uppercase">{curRoundData.name}</span>}
                    </div>
                </div>

                <div className="flex justify-between items-center mb-4 print:hidden">
                    <h2 className="text-xl font-bold">
                        {event.type === "group" ? "Teams" : "Participants"} ({event.type === "group" ? teams.length : participants.length})
                    </h2>
                </div>

                {event.type === "group" ? (
                    // Teams Table
                    <div className="rounded-md border bg-white shadow-sm print:border-0 print:shadow-none overflow-hidden">
                        <Table className="print:border print:border-slate-300">
                            <TableHeader className="print:bg-slate-100">
                                <TableRow className="print:border-b-2 print:border-slate-400">
                                    <TableHead className="w-[150px] print:text-black print:font-bold">Team / Dept</TableHead>
                                    <TableHead className="print:text-black print:font-bold">Members (Chest - Name - Reg No)</TableHead>
                                    <TableHead className="w-[100px] print:text-black print:font-bold hidden print:table-cell">Remark</TableHead>
                                    <TableHead className="w-[100px] print:text-black print:font-bold hidden print:table-cell">Position</TableHead>
                                    <TableHead className="w-[80px] print:hidden">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {teams.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                            No teams registered yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    teams.map((team: Team & { members?: Participant[] }) => (
                                        <TableRow key={team.id} className="align-top print:border-b print:border-slate-300">
                                            <TableCell className="font-semibold print:text-black">
                                                {team.name}
                                                <div className="hidden print:block text-[10px] font-normal opacity-70">
                                                    {getDeptCode(team.departmentId)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-2">
                                                    {team.members?.map((member) => (
                                                        <div key={member.id} className="flex items-center gap-3 text-sm print:text-black">
                                                            <span className="font-mono text-primary font-bold w-12 print:text-black">#{member.chestNumber}</span>
                                                            <div className="flex-1">
                                                                <span className="font-medium mr-2">{member.name}</span>
                                                                <span className="text-xs text-muted-foreground print:text-slate-500">
                                                                    ({member.registerNumber})
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden print:table-cell">
                                                <div className="w-full h-10 border border-slate-300 rounded"></div>
                                            </TableCell>
                                            <TableCell className="hidden print:table-cell">
                                                <div className="w-full h-10 border border-slate-300 rounded"></div>
                                            </TableCell>
                                            <TableCell className="print:hidden">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemove(team.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    // Participants Table
                    <div className="rounded-md border bg-white shadow-sm print:border-0 print:shadow-none overflow-hidden">
                        <Table className="print:border print:border-slate-300">
                            <TableHeader className="print:bg-slate-100">
                                <TableRow className="print:border-b-2 print:border-slate-400">
                                    <TableHead className="w-[80px] print:text-black print:font-bold">Chest</TableHead>
                                    <TableHead className="print:text-black print:font-bold">Name</TableHead>
                                    <TableHead className="print:text-black print:font-bold">Register No</TableHead>
                                    <TableHead className="w-[100px] print:text-black print:font-bold">Dept</TableHead>
                                    <TableHead className="w-[120px] print:text-black print:font-bold hidden print:table-cell">Remark</TableHead>
                                    <TableHead className="w-[100px] print:text-black print:font-bold hidden print:table-cell">Position</TableHead>
                                    <TableHead className="w-[80px] print:hidden">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {participants.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                            No participants registered yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    participants.map(p => (
                                        <TableRow key={p.id} className="print:border-b print:border-slate-300">
                                            <TableCell>
                                                <div className="bg-primary/10 text-primary font-mono font-bold text-center py-1 rounded print:bg-transparent print:p-0 print:text-black print:text-left">
                                                    {p.chestNumber}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold print:text-black">{p.name}</TableCell>
                                            <TableCell className="font-mono text-sm print:text-black">{p.registerNumber}</TableCell>
                                            <TableCell className="print:text-black">
                                                <span className="font-bold">{getDeptCode(p.departmentId)}</span>
                                            </TableCell>
                                            <TableCell className="hidden print:table-cell">
                                                <div className="w-full h-8 border border-slate-300 rounded"></div>
                                            </TableCell>
                                            <TableCell className="hidden print:table-cell">
                                                <div className="w-full h-8 border border-slate-300 rounded"></div>
                                            </TableCell>
                                            <TableCell className="print:hidden">
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingParticipant(p); setIsEditModalOpen(true); }}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemove(p.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <div className="hidden print:flex justify-between mt-12 px-8">
                    <div className="text-center">
                        <div className="w-32 border-b border-black mb-1"></div>
                        <p className="text-xs font-bold uppercase">General Captain</p>
                    </div>
                    <div className="text-center">
                        <div className="w-32 border-b border-black mb-1"></div>
                        <p className="text-xs font-bold uppercase">Sports Coordinator</p>
                    </div>
                    <div className="text-center">
                        <div className="w-32 border-b border-black mb-1"></div>
                        <p className="text-xs font-bold uppercase">Principal</p>
                    </div>
                </div>
            </main>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    main, main * {
                        visibility: visible;
                    }
                    main {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}} />

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
                                onChange={e => setEditingParticipant(prev => prev ? { ...prev, name: e.target.value } : null)}
                            />
                            <Input
                                placeholder="Register Number"
                                value={editingParticipant.registerNumber}
                                onChange={e => setEditingParticipant(prev => prev ? { ...prev, registerNumber: e.target.value } : null)}
                            />
                            <Select value={editingParticipant.departmentId} onValueChange={(v: string) => setEditingParticipant(prev => prev ? { ...prev, departmentId: v } : null)}>
                                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                                <SelectContent>
                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={editingParticipant.batchId} onValueChange={(v: string) => setEditingParticipant(prev => prev ? { ...prev, batchId: v } : null)}>
                                <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
                                <SelectContent>
                                    {batches.filter(b => b.departmentId === editingParticipant!.departmentId).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={editingParticipant.semester} onValueChange={(v: string) => setEditingParticipant(prev => prev ? { ...prev, semester: v } : null)}>
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
