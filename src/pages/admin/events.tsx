import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Event, Program } from "../../types";
import { CreateEventDialog } from "./components/create-event-dialog";
import { EditEventDialog } from "./components/edit-event-dialog";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Edit, Trash2, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";

export default function AdminEvents() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);

    // Program state
    const [programs, setPrograms] = useState<Program[]>([]);
    const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all programs to populate dropdown
            const { data: programsData, error: programsError } = await supabase
                .from('programs')
                .select('*')
                .order('created_at', { ascending: false });

            if (programsError) throw programsError;
            setPrograms((programsData || []) as Program[]);

            // Default to active program if no selection, or first available
            let targetProgramId = selectedProgramId;
            if (!targetProgramId && programsData && programsData.length > 0) {
                const active = programsData.find((p: any) => p.status === 'active');
                targetProgramId = active ? active.id : programsData[0].id;
                setSelectedProgramId(targetProgramId);
            }

            if (targetProgramId) {
                // 2. Fetch Events for Selected Program
                const { data: eventsData, error: eventsError } = await supabase
                    .from('events')
                    .select('*, programs(name, id, category)')
                    .eq('program_id', targetProgramId);

                if (eventsError) throw eventsError;
                setEvents(eventsData as Event[]);
            } else {
                setEvents([]);
            }

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;
        try {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', id);

            if (error) throw error;

            fetchData();
        } catch (error) {
            console.error("Error deleting event:", error);
            alert("Failed to delete event.");
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedProgramId]); // Re-fetch when selection changes

    const filterEvents = (gender: 'male' | 'female' | 'mixed') => {
        return events.filter(event => event.gender === gender);
    };

    const nav = useNavigate();

    const EventTable = ({ data }: { data: Event[] }) => (
        <div className="rounded-md border bg-white shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Event Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Round</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
                                Loading events...
                            </TableCell>
                        </TableRow>
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No events found in this category.
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((event) => (
                            <TableRow key={event.id} className="cursor-pointer hover:bg-muted/50" onClick={() => nav(`/admin/events/${event.id}`)}>
                                <TableCell className="font-medium text-primary hover:underline">
                                    <span className="font-mono text-xs text-muted-foreground mr-2">
                                        {event.programs?.name}
                                    </span>
                                    {event.name}
                                </TableCell>

                                <TableCell className="capitalize">
                                    {event.type}
                                    {event.type === 'group' && event.teamSize && ` (${event.teamSize})`}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={event.status === "completed" ? "secondary" : "default"}>
                                        {event.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {event.rounds?.[event.currentRoundIndex]?.name || "N/A"}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingEvent(event)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(event.id)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );



    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Events</h2>
                    <p className="text-muted-foreground">
                        Manage events for the selected program.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select
                        value={selectedProgramId || undefined}
                        onValueChange={setSelectedProgramId}
                    >
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select a program..." />
                        </SelectTrigger>
                        <SelectContent>
                            {programs.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    <div className="flex items-center gap-2">
                                        {p.name}
                                        <Badge variant="outline" className="ml-2 h-5 text-[10px] px-1 capitalize">{p.category || 'Dept'}</Badge>
                                        {p.status === 'active' && <Badge className="ml-2 h-5 text-[10px] px-1 bg-green-500">Active</Badge>}
                                        {p.status === 'ended' && <Badge variant="destructive" className="ml-2 h-5 text-[10px] px-1">Ended</Badge>}
                                        {p.status === 'inactive' && <Badge variant="outline" className="ml-2 h-5 text-[10px] px-1">Inactive</Badge>}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <CreateEventDialog
                        onEventCreated={fetchData}
                        programId={selectedProgramId}
                    />
                </div>
            </div>

            {!selectedProgramId && !loading && programs.length === 0 && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Programs Found</AlertTitle>
                    <AlertDescription>
                        Please create a program in the Programs section first.
                    </AlertDescription>
                </Alert>
            )}

            {selectedProgramId && (
                <Tabs defaultValue="male" className="w-full">
                    <TabsList>
                        <TabsTrigger value="male">Men</TabsTrigger>
                        <TabsTrigger value="female">Women</TabsTrigger>
                        <TabsTrigger value="mixed">Mixed</TabsTrigger>
                    </TabsList>
                    <TabsContent value="male">
                        <EventTable data={filterEvents('male')} />
                    </TabsContent>
                    <TabsContent value="female">
                        <EventTable data={filterEvents('female')} />
                    </TabsContent>
                    <TabsContent value="mixed">
                        <EventTable data={filterEvents('mixed')} />
                    </TabsContent>
                </Tabs>
            )}

            <EditEventDialog
                event={editingEvent}
                open={!!editingEvent}
                onOpenChange={(open) => !open && setEditingEvent(null)}
                onEventUpdated={fetchData}
            />
        </div>
    );
}
