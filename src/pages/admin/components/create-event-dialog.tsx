import { useState } from "react";
import { Button } from "../../../components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import type { Event } from "../../../types";

export function CreateEventDialog({ onEventCreated }: { onEventCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        type: "individual",
        gender: "male",
        teamSize: 4,
        points1st: 5,
        points2nd: 3,
        points3rd: 1,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const newEvent: Omit<Event, "id"> = {
                name: formData.name,
                type: formData.type as "individual" | "group",
                gender: formData.gender as "male" | "female" | "mixed",
                status: "upcoming",
                currentRoundIndex: 0,
                participants: [],
                ...(formData.type === "group" && { teamSize: formData.teamSize }),
                points1st: formData.points1st,
                points2nd: formData.points2nd,
                points3rd: formData.points3rd,
                rounds: [
                    { id: "r1", name: "Round 1", sequence: 1, status: "pending", participants: [] },
                ],
            };

            const { error } = await supabase
                .from('events')
                .insert([{ ...newEvent, id: crypto.randomUUID() }]);

            if (error) throw error;

            setOpen(false);
            setFormData({ name: "", type: "individual", gender: "male", teamSize: 4, points1st: 5, points2nd: 3, points3rd: 1 });
            onEventCreated();
        } catch (error) {
            console.error("Error creating event:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Event
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Event</DialogTitle>
                    <DialogDescription>
                        Add a new athletic event to the meet.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="col-span-3"
                                placeholder="e.g. 100m Sprint"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                                Type
                            </Label>
                            <Select
                                value={formData.type}
                                onValueChange={(val) => {
                                    const newPoints = val === "group"
                                        ? { points1st: 10, points2nd: 6, points3rd: 4 }
                                        : { points1st: 5, points2nd: 3, points3rd: 1 };
                                    setFormData({ ...formData, type: val, ...newPoints });
                                }}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="individual">Individual</SelectItem>
                                    <SelectItem value="group">Group / Relay</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.type === "group" && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="teamSize" className="text-right">
                                    Team Size
                                </Label>
                                <Input
                                    id="teamSize"
                                    type="number"
                                    min="2"
                                    value={formData.teamSize}
                                    onChange={(e) => setFormData({ ...formData, teamSize: parseInt(e.target.value) || 2 })}
                                    className="col-span-3"
                                    placeholder="Participants per team"
                                    required
                                />
                            </div>
                        )}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="gender" className="text-right">
                                Category
                            </Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(val) => setFormData({ ...formData, gender: val })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Men</SelectItem>
                                    <SelectItem value="female">Women</SelectItem>
                                    <SelectItem value="mixed">Mixed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Points</Label>
                            <div className="col-span-3 flex gap-2">
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground">1st</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.points1st}
                                        onChange={(e) => setFormData({ ...formData, points1st: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground">2nd</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.points2nd}
                                        onChange={(e) => setFormData({ ...formData, points2nd: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground">3rd</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.points3rd}
                                        onChange={(e) => setFormData({ ...formData, points3rd: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Event"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    );
}
