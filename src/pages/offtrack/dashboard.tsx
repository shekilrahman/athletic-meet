import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Calendar, Users, PlayCircle, Loader2 } from "lucide-react";
import type { Event } from "../../types";

export default function OfftrackDashboard() {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllEvents = async () => {
            try {
                // Fetch ALL events for offtrack staff
                const snapshot = await getDocs(collection(db, "events"));
                const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
                setEvents(allEvents);
            } catch (error) {
                console.error("Error fetching events:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllEvents();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ongoing":
                return <Badge className="bg-green-100 text-green-800"><PlayCircle className="h-3 w-3 mr-1" /> Live</Badge>;
            case "completed":
                return <Badge variant="secondary">Completed</Badge>;
            default:
                return <Badge variant="outline">Upcoming</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Welcome! Manage your assigned events below.</p>
            </header>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{events.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ongoing</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                            {events.filter(e => e.status === "ongoing").length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {events.filter(e => e.status === "completed").length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Events List */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Your Assigned Events</h2>
                {events.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No events assigned to you yet.</p>
                            <p className="text-sm">Contact an administrator to be assigned to an event.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {events.map((event) => (
                            <Card key={event.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg">{event.name}</CardTitle>
                                        {getStatusBadge(event.status)}
                                    </div>
                                    <CardDescription className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="capitalize">{event.gender}</Badge>
                                        <Badge variant="outline">
                                            {event.type === "group" ? <><Users className="h-3 w-3 mr-1" />{event.teamSize}</> : "Individual"}
                                        </Badge>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground">
                                        <p>Participants: {event.participants?.length || 0}</p>
                                        <p>Points: 1st: {event.points1st || 10} | 2nd: {event.points2nd || 7} | 3rd: {event.points3rd || 5}</p>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" onClick={() => navigate(`/offtrack/events/${event.id}`)}>
                                        Manage Event
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
