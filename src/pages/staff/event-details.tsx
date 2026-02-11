import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
    ArrowLeft,
    Loader2,
    CheckCircle2,
    Play,
    Flag,
    Users,
    Settings,
    ChevronRight,
    Medal,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { Event, Participant, RoundParticipant, Department, Team } from "../../types";

// ─── Helpers ────────────────────────────────────────────────────
const getRoundName = (index: number): string => `Round ${index + 1}`;

// ─── Types ──────────────────────────────────────────────────────
type RosterStatus = 'racing' | 'waiting' | 'qualified' | 'eliminated' | 'ranked';

interface RosterItem {
    id: string;
    details: Participant | undefined;
    teamDetails?: Team | undefined;
    assigned: RoundParticipant | undefined;
    status: RosterStatus;
}

// ─── Component ──────────────────────────────────────────────────
export default function EventDetails() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();

    // ─── Core Data ──────────────────────────────────────────────
    const [event, setEvent] = useState<Event | null>(null);
    const [participantMap, setParticipantMap] = useState<Record<string, Participant>>({});
    const [teamMap, setTeamMap] = useState<Record<string, Team>>({});
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // ─── UI State ───────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<string>("0");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentSetParticipants, setCurrentSetParticipants] = useState<RoundParticipant[]>([]);
    const [currentSetNumber, setCurrentSetNumber] = useState(1);

    // Round Manager Dialog State
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isNextRoundFinal, setIsNextRoundFinal] = useState(false);
    const [renameRoundName, setRenameRoundName] = useState("");

    // ─── Fetching ───────────────────────────────────────────────
    const fetchEvent = useCallback(async () => {
        if (!eventId) return;
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (error) throw error;
            const eventData = data as Event;
            setEvent(eventData);

            const curRoundIdx = eventData.currentRoundIndex || 0;
            const curRound = eventData.rounds?.[curRoundIdx];
            if (curRound && curRound.status !== "completed") {
                const usedSets = new Set(curRound.participants.map(p => p.set).filter(Boolean));
                const maxSet = usedSets.size > 0 ? Math.max(...Array.from(usedSets) as number[]) : 0;
                if (currentSetParticipants.length === 0) {
                    setCurrentSetNumber(maxSet + 1);
                }
            }
        } catch (error) {
            console.error("Error fetching event:", error);
        } finally {
            setLoading(false);
        }
    }, [eventId, currentSetParticipants.length]);

    // Initial Sync for Active Tab
    useEffect(() => {
        if (event && !loading) {
            setActiveTab(String(event.currentRoundIndex || 0));
        }
    }, [loading]);

    const fetchParticipants = useCallback(async () => {
        try {
            // Need to fetch all potential participants. 
            // In a larger app, we would filter this more strictly.
            // For now, let's just fetch all participants to be safe and simple given the map logic.
            // Alternatively, we could collect all IDs from event.participants and teams.

            let relativeIds = new Set<string>();
            if (event?.participants) event.participants.forEach(id => relativeIds.add(id));
            // We can't easily get team members without fetching teams first.
            // But we fetch teams in parallel or shortly after.
            // Let's just fetch all participants for now to simplify.
            // Better: use `in` query if possible, but the list might be long.
            // Let's assume fetching all is okay for this event scale.

            const { data, error } = await supabase
                .from('participants')
                .select('*');

            if (error) throw error;

            const map: Record<string, Participant> = {};
            data.forEach((p: any) => {
                map[p.id] = p as Participant;
            });
            setParticipantMap(map);
        } catch (error) {
            console.error("Error fetching participants:", error);
        }
    }, [event]);

    const fetchTeams = useCallback(async () => {
        if (!event || event.type !== 'group' || !event.participants) return;
        try {
            const { data, error } = await supabase
                .from('teams')
                .select('*')
                .eq('event_id', eventId);

            if (error) throw error;

            const map: Record<string, Team> = {};
            data.forEach((t: any) => {
                map[t.id] = t as Team;
            });
            setTeamMap(map);
        } catch (error) {
            console.error("Error fetching teams:", error);
        }
    }, [event, eventId]);

    const fetchDepartments = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('departments')
                .select('*');

            if (error) throw error;
            setDepartments((data || []) as Department[]);
        } catch (e) {
            console.error("Error fetching departments", e);
        }
    }, []);

    useEffect(() => { fetchEvent(); fetchDepartments(); }, [fetchEvent, fetchDepartments]);
    useEffect(() => { if (event) { fetchParticipants(); fetchTeams(); } }, [event, fetchParticipants, fetchTeams]);


    // ─── Computed Data ──────────────────────────────────────────
    const activeRoundIndex = parseInt(activeTab);
    const viewedRound = event?.rounds?.[activeRoundIndex];
    const isCurrentRoundActive = event?.currentRoundIndex === activeRoundIndex;
    const isFinalRound = viewedRound?.name === "Final"; // Simple check, but name can be customized now
    const getDeptName = (id?: string) => departments.find(d => d.id === id)?.name || "";

    const activeSetParticipants = isCurrentRoundActive && currentSetParticipants.length > 0;

    // Build Roster
    const getRoster = (): RosterItem[] => {
        if (!event || !viewedRound) return [];
        let allIds: string[] = [];

        if (activeRoundIndex === 0) {
            allIds = event.participants || [];
        } else {
            const prevRound = event.rounds[activeRoundIndex - 1];
            allIds = (prevRound?.participants || []).filter(p => p.qualified).map(p => p.participantId);
        }

        return allIds.map(id => {
            const assigned = viewedRound.participants.find(p => p.participantId === id);
            const racing = currentSetParticipants.find(p => p.participantId === id);

            let status: RosterStatus = 'waiting';
            if (racing) status = 'racing';
            else if (assigned) {
                if (assigned.rank) status = 'ranked';
                else if (assigned.qualified) status = 'qualified';
                else status = 'eliminated';
            }

            return {
                id,
                details: participantMap[id],
                teamDetails: teamMap[id],
                assigned: assigned || racing,
                status
            };
        });
    };

    const roster = getRoster();
    const anyQualified = roster.some(r => r.status === 'qualified' || r.status === 'ranked' || (r.status === 'racing' && r.assigned?.qualified));

    const sortedRoster = [...roster].sort((a, b) => {
        const order = { 'racing': 0, 'waiting': 1, 'qualified': 2, 'ranked': 2, 'eliminated': 3 };
        return order[a.status] - order[b.status];
    });



    // ─── Logic: Save & Update ───────────────────────────────────
    const saveCurrentSet = async (): Promise<boolean> => {
        if (!event || !eventId || !viewedRound) return false;

        const updatedRounds = [...event.rounds];
        const curRound = updatedRounds[activeRoundIndex];

        const existingParticipants = curRound.participants || [];
        const otherParticipants = existingParticipants.filter(p => p.set !== currentSetNumber);

        updatedRounds[activeRoundIndex] = {
            ...curRound,
            participants: [...otherParticipants, ...currentSetParticipants],
        };
        try {
            const { error } = await supabase
                .from('events')
                .update({ rounds: updatedRounds })
                .eq('id', eventId);

            if (error) throw error;
            return true;
        } catch (e) {
            console.error("Supabase Error:", e);
            return false;
        }
    };

    // ─── Actions ────────────────────────────────────────────────
    const handleSelectionToggle = (id: string) => {
        if (activeSetParticipants) return;
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleStartRace = () => {
        const participantsToAdd = Array.from(selectedIds).map(id => ({
            participantId: id,
            qualified: false,
            set: currentSetNumber
        } as RoundParticipant));
        setCurrentSetParticipants(participantsToAdd);
        setSelectedIds(new Set());
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleResult = (participantId: string, type: 'Q' | 1 | 2 | 3) => {
        setCurrentSetParticipants(prev => prev.map(p => {
            if (p.participantId !== participantId) return p;
            if (type === 'Q') {
                // Explicitly set rank to undefined
                return { ...p, qualified: !p.qualified, rank: undefined };
            } else {
                if (p.rank === type) {
                    return { ...p, rank: undefined, qualified: false };
                }
                return { ...p, rank: type, qualified: true };
            }
        }));
    };

    const handleFinishSet = async () => {
        if (currentSetParticipants.length === 0) return;
        setSaving(true);
        try {
            const success = await saveCurrentSet();
            if (success) {
                setCurrentSetParticipants([]);
                setCurrentSetNumber(prev => prev + 1);
                fetchEvent();
            } else {
                alert("Failed to save result. Please check connection.");
            }
        } catch (error) {
            console.error("Save failed", error);
            alert("An error occurred while saving.");
        }
        setSaving(false);
    };

    // ─── Round Manager Actions ──────────────────────────────────
    const handleAdvanceExperiment = async (nextName: string) => {
        if (!event || !eventId) return;
        setSaving(true);
        try {
            // 1. Finish Current Round
            const nextIndex = event.currentRoundIndex + 1;
            const updatedRounds = [...event.rounds];
            updatedRounds[event.currentRoundIndex].status = "completed";

            // 2. Add Next Round
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
                    rounds: updatedRounds,
                    current_round_index: nextIndex
                })
                .eq('id', eventId);

            if (error) throw error;

            // 3. Reset Local State
            setActiveTab(String(nextIndex));
            setCurrentSetNumber(1);
            setCurrentSetParticipants([]);
            setIsManagerOpen(false);

            // 4. Refresh
            fetchEvent();

        } catch (e) { console.error(e); alert("Failed to advance round."); }
        setSaving(false);
    };

    const handleMakeFinal = async () => {
        if (!event || !eventId) return;
        setSaving(true);
        try {
            const updatedRounds = [...event.rounds];
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
        setSaving(false);
    };

    const handleRenameCurrent = async () => {
        if (!event || !eventId || !renameRoundName.trim()) return;
        setSaving(true);
        try {
            const updatedRounds = [...event.rounds];
            updatedRounds[activeRoundIndex].name = renameRoundName.trim();

            const { error } = await supabase
                .from('events')
                .update({ rounds: updatedRounds })
                .eq('id', eventId);

            if (error) throw error;

            setIsManagerOpen(false);
            fetchEvent();
        } catch (e) { console.error(e); alert("Failed to rename."); }
        setSaving(false);
    };

    const handleCloseEvent = async () => {
        if (!event || !eventId) return;
        setSaving(true);
        try {
            if (currentSetParticipants.length > 0) {
                await saveCurrentSet();
            }
            const updatedRounds = [...event.rounds];
            updatedRounds[event.currentRoundIndex].status = "completed";

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
        setSaving(false);
    };


    // ─── Render ────────────────────────────────────────────────
    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><Loader2 className="animate-spin" /></div>;
    if (!event) return <div className="p-8 text-center">Event not found</div>;

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden font-sans relative">

            {/* ── HEADER ────────────────────────────────────────── */}
            <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-none z-20">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/ontrack")} className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">{event.name}</h1>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="uppercase tracking-wider font-semibold text-[10px]">{event.gender} {event.type}</span>
                                <span className={`text-[10px] font-bold ${event.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>{event.status}</span>
                            </div>
                        </div>
                    </div>

                    {/* Management Action */}
                    {isCurrentRoundActive && event.status !== 'completed' && (
                        <Dialog open={isManagerOpen} onOpenChange={setIsManagerOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="rounded-full gap-2 px-4 shadow-sm">
                                    <Settings className="h-4 w-4" />
                                    Manage
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle>Round Management</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6 pt-4">

                                    {/* 1. Rename Current */}
                                    <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Current Round Name</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                defaultValue={viewedRound?.name}
                                                onChange={(e) => setRenameRoundName(e.target.value)}
                                                placeholder={viewedRound?.name}
                                                className="h-10 text-sm font-medium"
                                            />
                                            <Button size="sm" onClick={handleRenameCurrent} disabled={saving} variant="secondary">Rename</Button>
                                            {viewedRound?.name !== "Final" && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleMakeFinal}
                                                    disabled={saving}
                                                    className="whitespace-nowrap"
                                                >
                                                    Make Final
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. Advance / Next Stage */}
                                    {anyQualified && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-px bg-gray-200 flex-1"></div>
                                                <span className="text-xs font-bold text-muted-foreground uppercase">Next Stage</span>
                                                <div className="h-px bg-gray-200 flex-1"></div>
                                            </div>

                                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4">
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        id="isFinal"
                                                        checked={isNextRoundFinal}
                                                        onChange={(e) => setIsNextRoundFinal(e.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                                    />
                                                    <label
                                                        htmlFor="isFinal"
                                                        className="text-sm font-medium leading-none cursor-pointer select-none"
                                                    >
                                                        Is this the <strong>Final Round</strong>?
                                                    </label>
                                                </div>

                                                <Button
                                                    className="w-full"
                                                    onClick={() => handleAdvanceExperiment(isNextRoundFinal ? "Final" : getRoundName(event.currentRoundIndex + 1))}
                                                    disabled={saving}
                                                >
                                                    Start {isNextRoundFinal ? "Final" : getRoundName(event.currentRoundIndex + 1)}
                                                    <ChevronRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Close Event */}
                                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                        <Button
                                            variant="ghost"
                                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                            onClick={handleCloseEvent}
                                            disabled={saving}
                                        >
                                            Complete Event & Archive
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                {/* ── TABS ────────────────────────────────────────── */}
                {event.rounds && event.rounds.length > 0 && (
                    <div className="px-4 pb-0 overflow-x-auto no-scrollbar">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="bg-transparent p-0 h-auto gap-6 justify-start w-full border-b border-transparent">
                                {event.rounds.map((round, idx) => (
                                    <TabsTrigger
                                        key={round.id}
                                        value={String(idx)}
                                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-1 py-3 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
                                    >
                                        {round.name}
                                        {round.status === 'completed' && <CheckCircle2 className="ml-1.5 h-3.5 w-3.5 text-green-500" />}
                                        {event.currentRoundIndex === idx && round.status !== 'completed' && <div className="ml-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>
                )}
            </header>

            {/* ── ROSTER LIST ────────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto p-4 pb-32 space-y-4">

                {/* Empty State */}
                {sortedRoster.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
                        <Users className="h-12 w-12 text-gray-300 mb-4" />
                        <h3 className="font-bold">Paddock Empty</h3>
                        <p className="text-sm">Waiting for previous round results.</p>
                    </div>
                )}

                {/* Active Set Header */}
                {activeSetParticipants && (
                    <div className="flex items-center justify-between mb-2 sticky top-0 bg-gray-50 dark:bg-gray-950 z-10 py-2 border-b border-gray-100 dark:border-gray-800">
                        <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-wider px-1 flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            Live Track • Set {currentSetNumber}
                        </h3>
                        <Badge variant="outline" className="text-[10px] border-red-200 text-red-500 bg-red-50 dark:bg-red-900/10 dark:border-900">{currentSetParticipants.length} Racing</Badge>
                    </div>
                )}

                <div className="space-y-2">
                    {sortedRoster.map(({ id, details, teamDetails, assigned, status }) => {
                        const displayName = teamDetails ? teamDetails.name : details?.name;
                        const displayId = teamDetails ? "T" : details?.chestNumber;

                        let subText = "";
                        if (teamDetails) {
                            // Show Chest Numbers of members
                            const memberChestNos = teamDetails.memberIds?.map(mid => participantMap[mid]?.chestNumber).filter(Boolean).join(", ");
                            subText = memberChestNos ? `Chest Nos: ${memberChestNos}` : `${teamDetails.memberIds?.length || 0} Members`;
                        } else {
                            subText = getDeptName(details?.departmentId);
                        }

                        if (!displayName && !details && !teamDetails) return null;

                        const isSelected = selectedIds.has(id);
                        const isRacing = status === 'racing';
                        const isWaiting = status === 'waiting';

                        return (
                            <div
                                key={id}
                                onClick={() => isWaiting && handleSelectionToggle(id)}
                                className={`
                                     flex items-center justify-between p-3 rounded-xl border transition-all duration-200
                                     ${isRacing
                                        ? 'bg-white dark:bg-gray-900 border-red-100 dark:border-red-900/30 shadow-sm ring-1 ring-red-50 dark:ring-red-900/20'
                                        : isSelected
                                            ? 'bg-primary/5 border-primary shadow-sm'
                                            : status === 'eliminated'
                                                ? 'bg-gray-50/50 dark:bg-gray-900/30 border-transparent opacity-60'
                                                : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                                    }
                                     ${isWaiting ? 'cursor-pointer active:scale-[0.99]' : ''}
                                 `}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`
                                         font-mono text-xs font-bold w-8 h-8 flex items-center justify-center rounded-lg
                                         ${isRacing ? 'bg-red-50 text-red-600 dark:bg-900/20 dark:text-red-400'
                                            : isSelected ? 'bg-primary text-primary-foreground'
                                                : 'bg-gray-100 dark:bg-gray-800 text-muted-foreground'}
                                     `}>
                                        {displayId}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-sm truncate">{displayName}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">{subText}</div>
                                    </div>
                                </div>
                                {/* Status / Actions */}
                                <div className="flex-shrink-0">
                                    {isRacing ? (
                                        isFinalRound ? (
                                            <div className="flex gap-1">
                                                {[1, 2, 3].map(rank => {
                                                    const isSelected = assigned?.rank === rank;
                                                    const colorClass = rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : "text-amber-700";
                                                    const bgClass = isSelected
                                                        ? (rank === 1 ? "bg-yellow-100 border-yellow-200" : rank === 2 ? "bg-gray-100 border-gray-200" : "bg-amber-100 border-amber-200")
                                                        : "bg-gray-50 border-transparent opacity-50 hover:opacity-100";

                                                    return (
                                                        <button
                                                            key={rank}
                                                            onClick={(e) => { e.stopPropagation(); handleResult(id, rank as 1 | 2 | 3); }}
                                                            className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all ${bgClass}`}
                                                        >
                                                            <Medal className={`h-5 w-5 ${colorClass} ${isSelected ? 'fill-current' : ''}`} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleResult(id, 'Q'); }}
                                                className={`
                                                     h-7 px-3 rounded font-bold text-xs transition-colors flex items-center gap-1
                                                     ${assigned?.qualified
                                                        ? 'bg-green-500 text-white shadow-sm'
                                                        : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'}
                                                 `}
                                            >
                                                {assigned?.qualified ? <><CheckCircle2 className="h-3 w-3" /> Q</> : "Qualify"}
                                            </button>
                                        )
                                    ) : status === 'qualified' ? (
                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">Q (Set {assigned?.set})</Badge>
                                    ) : status === 'ranked' ? (
                                        isFinalRound ? (
                                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${assigned?.rank === 1 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                                assigned?.rank === 2 ? "bg-gray-50 text-gray-600 border-gray-200" :
                                                    "bg-amber-50 text-amber-800 border-amber-200"
                                                }`}>
                                                <Medal className={`h-3.5 w-3.5 ${assigned?.rank === 1 ? "text-yellow-500 fill-yellow-500" :
                                                    assigned?.rank === 2 ? "text-gray-400 fill-gray-400" :
                                                        "text-amber-600 fill-amber-600"
                                                    }`} />
                                                {assigned?.rank === 1 ? "Gold" : assigned?.rank === 2 ? "Silver" : "Bronze"}
                                            </div>
                                        ) : (
                                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">#{assigned?.rank}</Badge>
                                        )
                                    ) : status === 'eliminated' ? (
                                        <span className="text-xs text-muted-foreground">Eliminated</span>
                                    ) : isSelected ? (
                                        <CheckCircle2 className="h-5 w-5 text-primary" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-700" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* ── FLOATING ACTION BAR ──────────────────────────── */}
            {(selectedIds.size > 0 || currentSetParticipants.length > 0) && isCurrentRoundActive && (
                <div className="absolute bottom-6 left-4 right-4 z-30">
                    {currentSetParticipants.length > 0 ? (
                        <Button
                            className="w-full h-14 text-lg font-bold shadow-xl shadow-black/20 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                            onClick={handleFinishSet}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <>Finish Set {currentSetNumber} <Flag className="ml-2 h-5 w-5" /></>}
                        </Button>
                    ) : (
                        <Button
                            className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/30 rounded-2xl"
                            onClick={handleStartRace}
                        >
                            Start Race ({selectedIds.size}) <Play className="ml-2 h-5 w-5 fill-current" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
