import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../components/ui/dialog";
import { Plus, Loader2, Edit, Trash2 } from "lucide-react";
import type { Program } from "../../types";

export default function AdminPrograms() {
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState<Program | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        category: 'department' as 'department' | 'semester' | 'mixed'
    });
    const [saving, setSaving] = useState(false);

    const fetchPrograms = async () => {
        const { data, error } = await supabase
            .from('programs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error("Error fetching programs:", error);
        else setPrograms(data as Program[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchPrograms();
    }, []);

    const openCreate = () => {
        setEditingProgram(null);
        setFormData({ name: "", category: 'department' });
        setIsDialogOpen(true);
    };

    const openEdit = (program: Program) => {
        setEditingProgram(program);
        setFormData({ name: program.name, category: program.category });
        setIsDialogOpen(true);
    };

    const handleSaveProgram = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;
        setSaving(true);

        try {
            if (editingProgram) {
                // Update
                const { error } = await supabase
                    .from('programs')
                    .update({
                        name: formData.name,
                        category: formData.category
                    })
                    .eq('id', editingProgram.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('programs')
                    .insert([{
                        name: formData.name,
                        category: formData.category,
                        status: 'inactive'
                    }]);
                if (error) throw error;
            }

            setIsDialogOpen(false);
            fetchPrograms();
        } catch (error) {
            console.error("Error saving program:", error);
            alert("Failed to save program");
        } finally {
            setSaving(false);
        }
    };

    const handleActivate = async (programId: string) => {
        try {
            // 1. Deactivate all currently active programs
            const { error: deactivateError } = await supabase
                .from('programs')
                .update({ status: 'inactive' })
                .eq('status', 'active'); // Deactivate only those that are currently active

            if (deactivateError) throw deactivateError;

            // 2. Activate selected program
            const { error: activateError } = await supabase
                .from('programs')
                .update({ status: 'active' })
                .eq('id', programId);

            if (activateError) throw activateError;

            fetchPrograms();
        } catch (error) {
            console.error("Error setting active program:", error);
            alert("Failed to update active program.");
        }
    };

    const handleDeleteProgram = async (programId: string) => {
        if (!confirm("Are you sure? This will delete all events, teams, and requests associated with this program.")) return;

        setSaving(true);
        try {
            // 1. Fetch all events associated with this program
            const { data: events, error: fetchError } = await supabase
                .from('events')
                .select('id')
                .eq('program_id', programId);

            if (fetchError) throw fetchError;

            const eventIds = events?.map(e => e.id) || [];

            if (eventIds.length > 0) {
                // 2. Delete dependent resources for these events
                // Teams
                const { error: teamsError } = await supabase
                    .from('teams')
                    .delete()
                    .in('event_id', eventIds);
                if (teamsError) throw teamsError;

                // Participation Requests
                const { error: requestsError } = await supabase
                    .from('participation_requests')
                    .delete()
                    .in('event_id', eventIds);
                if (requestsError) throw requestsError;

                // 3. Delete the events themselves
                const { error: eventsError } = await supabase
                    .from('events')
                    .delete()
                    .eq('program_id', programId);
                if (eventsError) throw eventsError;
            }

            // 4. Finally, delete the program
            const { error: programError } = await supabase
                .from('programs')
                .delete()
                .eq('id', programId);

            if (programError) throw programError;

            fetchPrograms();
        } catch (error) {
            console.error("Error deleting program:", error);
            alert("Failed to delete program and its data.");
        } finally {
            setSaving(false);
        }
    };



    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Programs</h2>
                    <p className="text-muted-foreground">
                        Manage sports meets and programs. Only one program can be active at a time.
                    </p>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" /> Create Program
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Programs</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-4">Loading...</TableCell>
                                </TableRow>
                            ) : programs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No programs found.</TableCell>
                                </TableRow>
                            ) : (
                                programs.map((program) => (
                                    <TableRow key={program.id}>
                                        <TableCell>
                                            <div className="font-medium text-lg">{program.name}</div>
                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                Created: {new Date(program.created_at!).toLocaleDateString()}
                                                <Badge variant="outline" className="capitalize">{program.category || 'department'}</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {program.status === 'active' && <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>}
                                            {program.status === 'inactive' && <Badge variant="secondary">Inactive</Badge>}
                                            {program.status === 'ended' && <Badge variant="destructive">Ended</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEdit(program)}
                                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                title="Edit"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>

                                            <Select
                                                value={program.status}
                                                onValueChange={(val) => {
                                                    if (val === 'active') handleActivate(program.id);
                                                    else {
                                                        // For inactive or ended, just update directly
                                                        const updateStatus = async () => {
                                                            const { error } = await supabase
                                                                .from('programs')
                                                                .update({ status: val })
                                                                .eq('id', program.id);
                                                            if (error) {
                                                                console.error(error);
                                                                alert("Failed to update status");
                                                            } else {
                                                                fetchPrograms();
                                                            }
                                                        };
                                                        updateStatus();
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-[110px] h-8 inline-flex">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                    <SelectItem value="ended">Ended</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteProgram(program.id)}
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingProgram ? "Edit Program" : "Create New Program"}</DialogTitle>
                        <DialogDescription>
                            {editingProgram ? "Update the program details." : "Start a new sports meet."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveProgram}>
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
                                    placeholder="e.g. Sports Meet 2025"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="category" className="text-right">
                                    Category
                                </Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(val: any) => setFormData({ ...formData, category: val })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="department">Department-wise</SelectItem>
                                        <SelectItem value="semester">Semester-wise</SelectItem>
                                        <SelectItem value="mixed">Mixed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {editingProgram ? "Update Program" : "Create Program"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
