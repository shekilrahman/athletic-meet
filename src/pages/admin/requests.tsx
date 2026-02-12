import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Loader2, Check, X, Filter } from "lucide-react";
import type { ParticipationRequest, Participant, Event } from "../../types";

type RequestWithDetails = ParticipationRequest & {
    participantDetails?: Participant;
    eventDetails?: Event;
};

export default function AdminRequests() {
    const [requests, setRequests] = useState<RequestWithDetails[]>([]);
    const [allEvents, setAllEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("all");
    const [selectedGender, setSelectedGender] = useState<string>("male");
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<{ id: string, type: 'approve' | 'reject' } | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // 1. Fetch pending requests
            const { data: requestData, error: reqError } = await supabase
                .from('participation_requests')
                .select('*')
                .eq('status', 'pending');

            if (reqError) throw reqError;

            if (!requestData || requestData.length === 0) {
                setRequests([]);
                setLoading(false);
                return;
            }

            // 2. Collect IDs
            const participantIds = [...new Set(requestData.map(r => r.participant_id))];
            const eventIds = [...new Set(requestData.map(r => r.event_id))];

            // 3. Fetch related data
            const { data: participantsData, error: partError } = await supabase
                .from('participants')
                .select('*')
                .in('id', participantIds);

            if (partError) throw partError;

            const { data: eventsData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .in('id', eventIds);

            if (eventError) throw eventError;

            // 4. Map details
            const participantsMap = new Map(participantsData?.map(p => [p.id, {
                id: p.id,
                name: p.name,
                registerNumber: p.register_number,
                gender: p.gender,
                departmentId: p.department_id
                // ... other fields if needed
            } as Participant]));

            const eventsMap = new Map(eventsData?.map(e => [e.id, {
                id: e.id,
                name: e.name,
                type: e.type,
                gender: e.gender,
                participants: e.participants
            } as Event]));

            const combinedRequests: RequestWithDetails[] = requestData
                .map((r: any) => ({
                    id: r.id,
                    participantId: r.participant_id,
                    eventId: r.event_id,
                    status: r.status,
                    created_at: r.created_at,
                    participantDetails: participantsMap.get(r.participant_id),
                    eventDetails: eventsMap.get(r.event_id)
                }))
                .filter(r => r.eventDetails?.type !== 'group');

            setRequests(combinedRequests);

            // 5. Fetch all events for filter
            const { data: allEvData, error: allEvError } = await supabase
                .from('events')
                .select('*')
                .order('name');

            if (allEvError) throw allEvError;
            const individualEvents = (allEvData as Event[]).filter(e => e.type !== 'group');
            setAllEvents(individualEvents);

        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    useEffect(() => {
        setSelectedEventId("all");
    }, [selectedGender]);

    const handleApprove = async (request: RequestWithDetails) => {
        if (!request.eventDetails || !request.participantDetails) return;
        setProcessing({ id: request.id, type: 'approve' });

        try {
            // 1. Update request status
            const { error: updateError } = await supabase
                .from('participation_requests')
                .update({ status: 'approved' })
                .eq('id', request.id);

            if (updateError) throw updateError;

            // 2. Add participant to event
            // Fetch fresh event data to be safe against race conditions (optimistic locking would be better but simple for now)
            const { data: currentEvent, error: fetchEventError } = await supabase
                .from('events')
                .select('participants')
                .eq('id', request.eventId)
                .single();

            if (fetchEventError) throw fetchEventError;

            const currentParticipants = currentEvent.participants || [];
            if (!currentParticipants.includes(request.participantId)) {
                const updatedParticipants = [...currentParticipants, request.participantId];

                const { error: eventUpdateError } = await supabase
                    .from('events')
                    .update({ participants: updatedParticipants })
                    .eq('id', request.eventId);

                if (eventUpdateError) throw eventUpdateError;
            }

            // Remove from local state
            setRequests(prev => prev.filter(r => r.id !== request.id));

        } catch (error) {
            console.error("Error approving request:", error);
            alert("Failed to approve request");
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (requestId: string) => {
        setProcessing({ id: requestId, type: 'reject' });
        try {
            const { error } = await supabase
                .from('participation_requests')
                .update({ status: 'rejected' })
                .eq('id', requestId);

            if (error) throw error;

            // Remove from local state
            setRequests(prev => prev.filter(r => r.id !== requestId));

        } catch (error) {
            console.error("Error rejecting request:", error);
            alert("Failed to reject request");
        } finally {
            setProcessing(null);
        }
    };

    const finalFilteredRequests = requests.filter(r => {
        const matchesEvent = selectedEventId === 'all' || r.eventId === selectedEventId;
        const matchesGender = r.participantDetails?.gender === selectedGender;
        return matchesEvent && matchesGender;
    });

    const maleCount = requests.filter(r =>
        (selectedEventId === 'all' || r.eventId === selectedEventId) &&
        r.participantDetails?.gender === 'male'
    ).length;

    const femaleCount = requests.filter(r =>
        (selectedEventId === 'all' || r.eventId === selectedEventId) &&
        r.participantDetails?.gender === 'female'
    ).length;

    const RequestsTable = ({ data }: { data: RequestWithDetails[] }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Register No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Requested Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                            No pending requests
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map((request) => (
                        <TableRow key={request.id}>
                            <TableCell className="font-mono">{request.participantDetails?.registerNumber || 'N/A'}</TableCell>
                            <TableCell>{request.participantDetails?.name || 'Unknown'}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{request.eventDetails?.name || 'Unknown Event'}</span>
                                    {request.eventDetails?.gender && (
                                        <Badge variant="outline" className="text-xs">{request.eventDetails.gender}</Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                                {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                                        onClick={() => handleApprove(request)}
                                        disabled={!!processing && processing.id === request.id}
                                    >
                                        {processing?.id === request.id && processing.type === 'approve' ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Check className="h-4 w-4 mr-1" />
                                        )}
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                                        onClick={() => handleReject(request.id)}
                                        disabled={!!processing && processing.id === request.id}
                                    >
                                        {processing?.id === request.id && processing.type === 'reject' ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <X className="h-4 w-4 mr-1" />
                                        )}
                                        Reject
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Participation Requests</h2>
                    <p className="text-muted-foreground">Manage student requests to join events.</p>
                </div>
                <Button variant="outline" onClick={fetchRequests} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Refresh
                </Button>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center bg-white dark:bg-gray-800 p-4 rounded-lg border shadow-sm gap-6">
                <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Event:</span>
                    </div>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                        <SelectTrigger className="w-full md:w-[250px]">
                            <SelectValue placeholder="All Events" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Events</SelectItem>
                            {allEvents
                                .filter(e => e.gender === selectedGender || e.gender === 'mixed')
                                .map((event) => (
                                    <SelectItem key={event.id} value={event.id}>
                                        {event.name} ({event.gender})
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                    <Tabs value={selectedGender} onValueChange={setSelectedGender} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-9 p-1">
                            <TabsTrigger value="male" className="text-xs">
                                Male ({maleCount})
                            </TabsTrigger>
                            <TabsTrigger value="female" className="text-xs">
                                Female ({femaleCount})
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="border rounded-md bg-white dark:bg-gray-800 overflow-hidden">
                <RequestsTable data={finalFilteredRequests} />
            </div>
        </div>
    );
}
