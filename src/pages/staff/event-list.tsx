import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Loader2, Users, User, ChevronRight, Trophy, Clock, PlayCircle, LogOut } from "lucide-react";
import { useAuth } from "../../components/auth-provider";
import type { Event } from "../../types";

const statusConfig = {
    upcoming: { color: "bg-amber-100 text-amber-800", icon: Clock, label: "Upcoming" },
    ongoing: { color: "bg-green-100 text-green-800", icon: PlayCircle, label: "Live" },
    completed: { color: "bg-gray-100 text-gray-600", icon: Trophy, label: "Completed" },
};


export default function StaffEventList() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const snapshot = await getDocs(collection(db, "events"));
                const eventsData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Event[];
                setEvents(eventsData);
            } catch (error) {
                console.error("Error fetching events:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const upcomingEvents = events.filter(e => e.status === 'upcoming' || e.status === 'ongoing');
    const completedEvents = events.filter(e => e.status === 'completed');

    const renderEventCard = (event: Event) => {
        const cfg = statusConfig[event.status];
        const StatusIcon = cfg.icon;
        const currentRound = event.rounds?.[event.currentRoundIndex];

        return (
            <Card
                key={event.id}
                className={`overflow-hidden transition-all active:scale-[0.98] cursor-pointer ${event.status === 'ongoing' ? 'ring-2 ring-green-400 shadow-md' : ''
                    }`}
                onClick={() => navigate(`/ontrack/events/${event.id}`)}
            >
                <CardContent className="p-0">
                    <div className="flex items-center gap-3 p-4">
                        {/* Left: Status indicator */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.color}`}>
                            <StatusIcon className="h-5 w-5" />
                        </div>

                        {/* Center: Event info */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base truncate">{event.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs capitalize py-0">
                                    {event.gender}
                                </Badge>
                                <Badge variant="secondary" className="text-xs py-0">
                                    {event.type === 'group' ? (
                                        <><Users className="h-3 w-3 mr-1" />Group</>
                                    ) : (
                                        <><User className="h-3 w-3 mr-1" />Individual</>
                                    )}
                                </Badge>
                            </div>
                        </div>

                        {/* Right: Arrow */}
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>

                    {/* Bottom info bar */}
                    <div className="bg-muted/30 px-4 py-2 flex justify-between items-center text-xs text-muted-foreground border-t">
                        <span>
                            {event.participants?.length || 0} participants
                        </span>
                        <span>
                            {currentRound
                                ? `${currentRound.name} (Round ${event.currentRoundIndex + 1})`
                                : event.rounds?.length
                                    ? `${event.rounds.length} rounds`
                                    : "No rounds yet"
                            }
                        </span>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="p-4 space-y-5 max-w-lg mx-auto">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold">Events</h1>
                    <p className="text-sm text-muted-foreground">
                        Select an event to manage rounds and results.
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={async () => {
                    navigate('/');
                    await logout();
                }}>
                    <LogOut className="h-5 w-5" />
                </Button>
            </header>

            <Tabs defaultValue="upcoming" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upcoming">Upcoming ({upcomingEvents.length})</TabsTrigger>
                    <TabsTrigger value="done">Done ({completedEvents.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="upcoming" className="space-y-3 mt-4">
                    {upcomingEvents.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No upcoming events.</p>
                        </div>
                    ) : (
                        upcomingEvents.map(renderEventCard)
                    )}
                </TabsContent>

                <TabsContent value="done" className="space-y-3 mt-4">
                    {completedEvents.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No completed events.</p>
                        </div>
                    ) : (
                        completedEvents.map(renderEventCard)
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
