import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Loader2, Users, User, ChevronRight, Trophy, Clock, PlayCircle } from "lucide-react";
import type { Event } from "../../types";

const statusConfig = {
    upcoming: { color: "bg-amber-100 text-amber-800", icon: Clock, label: "Upcoming" },
    ongoing: { color: "bg-green-100 text-green-800", icon: PlayCircle, label: "Live" },
    completed: { color: "bg-gray-100 text-gray-600", icon: Trophy, label: "Completed" },
};


export default function StaffEventList() {
    const navigate = useNavigate();
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
                // Sort: ongoing first, then upcoming, then completed
                eventsData.sort((a, b) => {
                    const order = { ongoing: 0, upcoming: 1, completed: 2 };
                    return order[a.status] - order[b.status];
                });
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

    return (
        <div className="p-4 space-y-5 max-w-lg mx-auto">
            <header>
                <h1 className="text-2xl font-bold">Events</h1>
                <p className="text-sm text-muted-foreground">
                    Select an event to manage rounds and results.
                </p>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">
                        {events.filter(e => e.status === 'ongoing').length}
                    </p>
                    <p className="text-xs text-green-600">Live</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                        {events.filter(e => e.status === 'upcoming').length}
                    </p>
                    <p className="text-xs text-amber-600">Upcoming</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-gray-600">
                        {events.filter(e => e.status === 'completed').length}
                    </p>
                    <p className="text-xs text-gray-500">Done</p>
                </div>
            </div>

            {/* Event Cards */}
            <div className="space-y-3">
                {events.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>No events found.</p>
                    </div>
                ) : (
                    events.map((event) => {
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
                    })
                )}
            </div>
        </div>
    );
}
