import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Event } from "../../types";
import { CreateEventDialog } from "./components/create-event-dialog";
import { EditEventDialog } from "./components/edit-event-dialog";
import { Card, CardContent } from "../../components/ui/card";

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
import { Edit, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

interface AdminEventsProps {
    isEmbedded?: boolean;
}

export default function AdminEvents({ isEmbedded = false }: AdminEventsProps) {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);

    const { programId } = useParams();

    const fetchData = async () => {
        if (!programId) return;
        setLoading(true);
        try {
            // 1. Fetch Events for Selected Program
            const { data: eventsData, error: eventsError } = await supabase
                .from('events')
                .select('*, programs(name, id, category)')
                .eq('program_id', programId);

            if (eventsError) throw eventsError;
            const fetchedEvents = eventsData as Event[];
            setEvents(fetchedEvents);

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
        if (programId) fetchData();
    }, [programId]); // Re-fetch when programId changes

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


    const content = (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold tracking-tight">{isEmbedded ? "Manage Events" : ""}</h3>
                <CreateEventDialog
                    onEventCreated={fetchData}
                    programId={programId || null}
                />
            </div>

            <Card className="border shadow-sm bg-white dark:bg-gray-800 overflow-hidden">
                <CardContent className="p-0">
                    <Tabs defaultValue="male" className="w-full">
                        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-14 px-4 gap-4">
                            <TabsTrigger value="male" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Men</TabsTrigger>
                            <TabsTrigger value="female" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Women</TabsTrigger>
                            <TabsTrigger value="mixed" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-full">Mixed</TabsTrigger>
                        </TabsList>
                        <div className="p-4">
                            <TabsContent value="male" className="mt-0">
                                <EventTable data={filterEvents('male')} />
                            </TabsContent>
                            <TabsContent value="female" className="mt-0">
                                <EventTable data={filterEvents('female')} />
                            </TabsContent>
                            <TabsContent value="mixed" className="mt-0">
                                <EventTable data={filterEvents('mixed')} />
                            </TabsContent>
                        </div>
                    </Tabs>
                </CardContent>
            </Card>

            <EditEventDialog
                event={editingEvent}
                open={!!editingEvent}
                onOpenChange={(open) => !open && setEditingEvent(null)}
                onEventUpdated={fetchData}
            />
        </div>
    );

    return content;
}
