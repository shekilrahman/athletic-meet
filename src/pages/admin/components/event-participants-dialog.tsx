import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DialogHeader } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Users, Trash2, Loader2, Search, AlertCircle } from "lucide-react";
import { supabase } from "../../../lib/supabase";
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
            // Need to re-fetch event to get latest participants list to be sure
            const { data: latestEvent, error: eventError } = await supabase
                .from('events')
                .select('participants')
                .eq('id', event.id)
                .single();

            if (eventError || !latestEvent) throw eventError || new Error("Event not found");

            const participantIds = latestEvent.participants || [];

            if (participantIds.length === 0) {
                setParticipants([]);
                setLoading(false);
                return;
            }

            if (event.type === 'group') {
                const { data: teamsData, error: teamsError } = await supabase
                    .from('teams')
                    .select('*')
                    .in('id', participantIds);

                if (teamsError) throw teamsError;

                // Add isTeam flag
                setParticipants((teamsData || []).map(t => ({ ...t, isTeam: true })) as (Team & { isTeam: true })[]);
            } else {
                const { data: partsData, error: partsError } = await supabase
                    .from('participants')
                    .select('*')
                    .in('id', participantIds);

                if (partsError) throw partsError;

                setParticipants((partsData || []).map(p => ({ ...p, isTeam: false })) as (Participant & { isTeam: false })[]);
            }
        } catch (error) {
            console.error("Error fetching participants", error);
        } finally {
            setLoading(false);
        }
    }, [event.id, event.type]);

    const fetchMetadata = useCallback(async () => {
        const { data: dData } = await supabase.from('departments').select('*');
        setDepartments((dData || []) as Department[]);

        const { data: bData } = await supabase.from('batches').select('*');
        setBatches((bData || []) as Batch[]);
    }, []);

    // Initial Fetch
    useEffect(() => {
        if (isOpen) {
            fetchEventParticipants();
            fetchMetadata();
        }
    }, [isOpen, fetchEventParticipants, fetchMetadata]);


    // --- Searches ---
    const handleSearch = async (term: string) => {
        const upperTerm = term.toUpperCase();
        setSearchChestNo(upperTerm);
        setSearchedParticipant(null);
        setSearchError("");
        if (!upperTerm) return;

        const { data, error } = await supabase
            .from('participants')
            .select('*')
            .or(`chest_number.eq.${upperTerm},register_number.eq.${upperTerm}`);

        if (error) {
            console.error(error);
            setSearchError("Error searching");
            return;
        }

        if (!data || data.length === 0) {
            setSearchError("Not found");
            return;
        }

        const p = data[0] as Participant;

        // Validate Gender
        if (event.gender !== 'mixed' && p.gender !== event.gender) {
            setSearchError(`Gender mismatch (${p.gender})`);
            return;
        }

        // Check if already in event (for individual)
        if (event.type === 'individual' && participants.some(existing => existing.id === p.id)) {
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
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .eq('chest_number', chestNo);

            if (!error && data && data.length > 0) {
                const p = data[0] as Participant;
                if (event.gender !== 'mixed' && p.gender !== event.gender) {
                    // Invalid gender
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
            // Read-Modify-Write for array update
            const { data: currentEvent, error: fetchError } = await supabase
                .from('events')
                .select('participants')
                .eq('id', event.id)
                .single();

            if (fetchError) throw fetchError;

            const currentParticipants = currentEvent.participants || [];
            if (currentParticipants.includes(searchedParticipant.id)) {
                alert("Already added!");
                return;
            }

            const updatedParticipants = [...currentParticipants, searchedParticipant.id];

            const { error: updateError } = await supabase
                .from('events')
                .update({ participants: updatedParticipants })
                .eq('id', event.id);

            if (updateError) throw updateError;

            setSearchChestNo("");
            setSearchedParticipant(null);
            fetchEventParticipants(); // Refresh list
            onUpdate();
        } catch (e) {
            console.error(e);
            alert("Failed to add participant");
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
            const teamData = {
                name: teamName,
                event_id: event.id,
                department_id: departments.find(d => d.name === teamName)?.id || "",
                member_ids: memberIds
            };

            const { data: teamRef, error: createError } = await supabase
                .from('teams')
                .insert([teamData])
                .select()
                .single();

            if (createError) throw createError;

            // Read-Modify-Write for event participants
            const { data: currentEvent, error: fetchError } = await supabase
                .from('events')
                .select('participants')
                .eq('id', event.id)
                .single();

            if (fetchError) throw fetchError;

            const currentParticipants = currentEvent.participants || [];
            const updatedParticipants = [...currentParticipants, teamRef.id];

            const { error: updateError } = await supabase
                .from('events')
                .update({ participants: updatedParticipants })
                .eq('id', event.id);

            if (updateError) throw updateError;

            setTeamChestNos(Array(event.teamSize || 1).fill(""));
            setTeamMembers(Array(event.teamSize || 1).fill(null));
            setTeamName("");
            fetchEventParticipants();
            onUpdate();
        } catch (e) {
            console.error(e);
            alert("Failed to register team");
        } finally {
            setProcessing(false);
        }
    };

    const createAndAddParticipant = async () => {
        if (!newParticipant.name || !newParticipant.registerNumber || !newParticipant.departmentId) return;
        setProcessing(true);
        try {
            // Auto generate chest no: Get max chest_number (cast to int if needed)
            // Doing simpler approach: Fetch all and find max in JS, or use a DB function. 
            // Fetching all 'participants' specific columns is okay if not huge.
            // Or order by chest_number desc limit 1.

            // Note: chest_number is likely a string in DB based on usage. 
            // We need to cast to int for correct max finding. 
            // Supabase/Postgres sorting on string '10' vs '2' -> '2' is greater.
            // So we fetch all (optimization needed later if > 1000s users)

            const { data: allParts, error: fetchError } = await supabase
                .from('participants')
                .select('chest_number');

            if (fetchError) throw fetchError;

            let maxChest = 100;
            allParts.forEach(p => {
                const cn = parseInt(p.chest_number);
                if (!isNaN(cn) && cn > maxChest) maxChest = cn;
            });
            const nextChest = String(maxChest + 1);

            const { data: docRef, error: insertError } = await supabase
                .from('participants')
                .insert([{
                    name: newParticipant.name,
                    register_number: newParticipant.registerNumber,
                    department_id: newParticipant.departmentId,
                    batch_id: newParticipant.batchId,
                    gender: newParticipant.gender,
                    semester: newParticipant.semester,
                    chest_number: nextChest,
                    total_points: 0,
                    individual_wins: 0
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            const createdP = { ...docRef } as Participant;

            if (event.type === 'individual') {
                // Add to event
                const { data: currentEvent, error: evFetchError } = await supabase
                    .from('events')
                    .select('participants')
                    .eq('id', event.id)
                    .single();

                if (evFetchError) throw evFetchError;

                const currentParticipants = currentEvent.participants || [];
                const updatedParticipants = [...currentParticipants, createdP.id];

                const { error: updateError } = await supabase
                    .from('events')
                    .update({ participants: updatedParticipants })
                    .eq('id', event.id);

                if (updateError) throw updateError;

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
            alert("Failed to create participant");
        } finally {
            setProcessing(false);
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm("Remove from event?")) return;
        try {
            const { data: currentEvent, error: fetchError } = await supabase
                .from('events')
                .select('participants')
                .eq('id', event.id)
                .single();

            if (fetchError) throw fetchError;

            const currentParticipants = currentEvent.participants || [];
            const updatedParticipants = currentParticipants.filter((pId: string) => pId !== id);

            const { error: updateError } = await supabase
                .from('events')
                .update({ participants: updatedParticipants })
                .eq('id', event.id);

            if (updateError) throw updateError;

            fetchEventParticipants();
            onUpdate();
        } catch (e) {
            console.error(e);
            alert("Failed to remove participant");
        }
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
                                                className="pl-8 uppercase"
                                                placeholder="Chest Number or Register Number"
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
                                                        <Button variant="outline" size="sm" className="h-6 px-2" onClick={() => {
                                                            setNewParticipant(prev => ({ ...prev, registerNumber: searchChestNo }));
                                                            setIsCreating(true);
                                                        }}>
                                                            Create New
                                                        </Button>
                                                    )}
                                                </AlertDescription>
                                            </Alert>
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground text-sm">
                                                Type a Chest Number or Register Number to search...
                                            </div>
                                        )
                                    )}
                                </div>
                            )
                        )}
                        {!isCreating && <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground text-center">
                                Don't have a chest number? <Button variant="link" className="p-0 h-auto" onClick={() => {
                                    setNewParticipant(prev => ({ ...prev, registerNumber: searchChestNo }));
                                    setIsCreating(true);
                                }}>Create new participant</Button>
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
                                        const isTeam = 'memberIds' in p || (p as any).isTeam;
                                        if (isTeam) {
                                            const team = p as Team;
                                            return (
                                                <TableRow key={team.id}>
                                                    <TableCell className="font-medium">{team.name}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {team.memberIds?.length || 0} Members
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
