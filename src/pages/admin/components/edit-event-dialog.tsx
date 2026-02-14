import { useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { supabase } from "../../../lib/supabase";
import type { Event } from "../../../types";

interface EditEventDialogProps {
    event: Event | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEventUpdated: () => void;
}

export function EditEventDialog({ event, open, onOpenChange, onEventUpdated }: EditEventDialogProps) {
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

    useEffect(() => {
        if (event) {
            const defaultPoints = event.type === "group"
                ? { points1st: 10, points2nd: 6, points3rd: 4 }
                : { points1st: 5, points2nd: 3, points3rd: 1 };

            setFormData({
                name: event.name,
                type: event.type,
                gender: event.gender,
                teamSize: event.teamSize || 4,
                points1st: event.points1st ?? defaultPoints.points1st,
                points2nd: event.points2nd ?? defaultPoints.points2nd,
                points3rd: event.points3rd ?? defaultPoints.points3rd,
            });
        }
    }, [event]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!event) return;
        setLoading(true);

        try {
            const updatedData: any = {
                name: formData.name,
                type: formData.type,
                gender: formData.gender,
                points_1st: formData.points1st,
                points_2nd: formData.points2nd,
                points_3rd: formData.points3rd,
            };

            if (formData.type === "group") {
                updatedData.team_size = formData.teamSize;
            }

            const { error } = await supabase
                .from('events')
                .update(updatedData)
                .eq('id', event.id);

            if (error) throw error;

            onOpenChange(false);
            onEventUpdated();
        } catch (error) {
            console.error("Error updating event:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Event</DialogTitle>
                    <DialogDescription>
                        Update the details of the athletic event.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right">
                                Event Name
                            </Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-type" className="text-right">
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
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="individual">Individual</SelectItem>
                                    <SelectItem value="group">Group / Relay</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.type === "group" && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-teamSize" className="text-right">
                                    Team Size
                                </Label>
                                <Input
                                    id="edit-teamSize"
                                    type="number"
                                    min="2"
                                    value={formData.teamSize}
                                    onChange={(e) => setFormData({ ...formData, teamSize: parseInt(e.target.value) || 2 })}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                        )}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-gender" className="text-right">
                                Gender
                            </Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(val) => setFormData({ ...formData, gender: val })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue />
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
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
