import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Event } from "../../types";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "../../components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

export default function AdminEvents() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*');

            if (error) throw error;

            setEvents(data as Event[]);
        } catch (error) {
            console.error("Error fetching events:", error);
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

            fetchEvents();
        } catch (error) {
            console.error("Error deleting event:", error);
            alert("Failed to delete event.");
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

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
                        <TableHead>Category</TableHead>
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
                                <TableCell className="font-medium text-primary hover:underline">{event.name}</TableCell>
                                <TableCell className="capitalize">{event.gender}</TableCell>
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
                                    {event.rounds[event.currentRoundIndex]?.name || "N/A"}
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
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Events</h2>
                    <p className="text-muted-foreground">
                        Manage athletic events and schedule.
                    </p>
                </div>
                <CreateEventDialog onEventCreated={fetchEvents} />
            </div>

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

            <EditEventDialog
                event={editingEvent}
                open={!!editingEvent}
                onOpenChange={(open) => !open && setEditingEvent(null)}
                onEventUpdated={fetchEvents}
            />
        </div>
    );
}
