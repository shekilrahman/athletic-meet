import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../../components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../../../components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../components/ui/select";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import type { Participant, Department, Batch } from "../../../types";

// Helper function to display semester as group
const getSemesterGroup = (sem: number): string => {
    if (sem <= 2) return "S1/S2";
    if (sem <= 4) return "S3/S4";
    if (sem <= 6) return "S5/S6";
    return "S7/S8";
};

export function ParticipantManagement() {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);

    // Add Participant State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newParticipant, setNewParticipant] = useState({
        name: "",
        registerNumber: "",
        departmentId: "",
        batchId: "",
        gender: "male" as "male" | "female",
        semester: 1,
        chestNumber: "",
    });
    const [adding, setAdding] = useState(false);

    // Edit Participant State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
    const [updating, setUpdating] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [
                { data: participantsData, error: pError },
                { data: deptData, error: dError },
                { data: batchData, error: bError }
            ] = await Promise.all([
                supabase.from('participants').select('*'),
                supabase.from('departments').select('*'),
                supabase.from('batches').select('*')
            ]);

            if (pError) throw pError;
            if (dError) throw dError;
            if (bError) throw bError;

            // Map Supabase snake_case to TS camelCase
            const mappedParticipants = (participantsData || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                registerNumber: p.register_number,
                departmentId: p.department_id,
                batchId: p.batch_id,
                semester: p.semester,
                gender: p.gender,
                chestNumber: p.chest_number,
                totalPoints: p.total_points,
                individualWins: p.individual_wins
            })) as Participant[];

            const mappedBatches = (batchData || []).map((b: any) => ({
                id: b.id,
                name: b.name,
                departmentId: b.department_id
            })) as Batch[];

            // Batch updates
            setParticipants(mappedParticipants);
            setDepartments(deptData as Department[]);
            setBatches(mappedBatches);

        } catch (error) {
            console.error("Error fetching data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddParticipant = async () => {
        if (!newParticipant.name || !newParticipant.registerNumber || !newParticipant.departmentId) {
            alert("Name, Register Number, and Department are required.");
            return;
        }
        setAdding(true);
        try {
            const { registerParticipant } = await import("../../../lib/participant-service");
            await registerParticipant({
                name: newParticipant.name,
                registerNumber: newParticipant.registerNumber,
                departmentId: newParticipant.departmentId,
                batchId: newParticipant.batchId,
                semester: newParticipant.semester,
                gender: newParticipant.gender,
            });

            setIsAddOpen(false);
            setNewParticipant({
                name: "",
                registerNumber: "",
                departmentId: "",
                batchId: "",
                gender: "male",
                semester: 1,
                chestNumber: "",
            });
            fetchData();
        } catch (error: any) {
            console.error("Error adding participant", error);
            alert(error.message || "Failed to add participant");
        } finally {
            setAdding(false);
        }
    };

    const handleEditParticipant = async () => {
        if (!editingParticipant) return;
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('participants')
                .update({
                    name: editingParticipant.name,
                    register_number: editingParticipant.registerNumber,
                    department_id: editingParticipant.departmentId,
                    batch_id: editingParticipant.batchId,
                    semester: editingParticipant.semester,
                    gender: editingParticipant.gender
                })
                .eq('id', editingParticipant.id);

            if (error) throw error;

            setIsEditOpen(false);
            setEditingParticipant(null);
            fetchData();
        } catch (error) {
            console.error("Error updating participant", error);
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteParticipant = async (id: string) => {
        if (!confirm("Are you sure you want to delete this participant?")) return;
        try {
            const { error } = await supabase
                .from('participants')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error("Error deleting participant", error);
        }
    };

    const openEditDialog = (p: Participant) => {
        setEditingParticipant(p);
        setIsEditOpen(true);
    };

    const getDeptName = (id: string) => {
        if (!id) return "Unknown";
        const dept = departments.find(d => d.id === id);
        return dept ? dept.name : "Unknown";
    };

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedParticipants = [...participants].sort((a, b) => {
        if (!sortConfig) return 0;

        let aValue: any = a[sortConfig.key as keyof Participant];
        let bValue: any = b[sortConfig.key as keyof Participant];

        // Handle nested/special sorts
        if (sortConfig.key === 'department') {
            aValue = getDeptName(a.departmentId);
            bValue = getDeptName(b.departmentId);
        } else if (sortConfig.key === 'chestNumber') {
            aValue = parseInt(a.chestNumber) || 0;
            bValue = parseInt(b.chestNumber) || 0;
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig?.key !== column) return <div className="w-4 h-4 inline-block" />;
        return <span className="ml-1 inline-block">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const HeaderCell = ({ label, sortKey, className }: { label: string, sortKey: string, className?: string }) => (
        <TableHead
            className={`cursor-pointer hover:bg-muted/50 select-none ${className || ''}`}
            onClick={() => handleSort(sortKey)}
        >
            {label}
            <SortIcon column={sortKey} />
        </TableHead>
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Participants</h3>
                    <p className="text-sm text-muted-foreground">Manage students and assign chest numbers.</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add Participant
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Participant</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Input placeholder="Name" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} />
                                <Input placeholder="Register Number" value={newParticipant.registerNumber} onChange={e => setNewParticipant({ ...newParticipant, registerNumber: e.target.value })} />
                                <Select value={newParticipant.departmentId} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, departmentId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                                    <SelectContent>
                                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {newParticipant.departmentId && batches.filter(b => b.departmentId === newParticipant.departmentId).length > 0 && (
                                    <Select value={newParticipant.batchId} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, batchId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
                                        <SelectContent>
                                            {batches.filter(b => b.departmentId === newParticipant.departmentId).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                                <Select value={newParticipant.gender} onValueChange={(v: "male" | "female") => setNewParticipant({ ...newParticipant, gender: v })}>
                                    <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={String(newParticipant.semester)} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, semester: parseInt(v) })}>
                                    <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">S1/S2</SelectItem>
                                        <SelectItem value="3">S3/S4</SelectItem>
                                        <SelectItem value="5">S5/S6</SelectItem>
                                        <SelectItem value="7">S7/S8</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddParticipant} disabled={adding}>
                                    {adding ? "Adding..." : "Add Participant"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <HeaderCell label="Chest No" sortKey="chestNumber" />
                            <HeaderCell label="Name" sortKey="name" />
                            <HeaderCell label="Reg No" sortKey="registerNumber" />
                            <HeaderCell label="Dept" sortKey="department" />
                            <HeaderCell label="Gender" sortKey="gender" />
                            <HeaderCell label="Semester" sortKey="semester" />
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-4">Loading participants...</TableCell></TableRow>
                        ) : sortedParticipants.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground">No participants found.</TableCell></TableRow>
                        ) : (
                            sortedParticipants.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-mono font-bold">{p.chestNumber || "-"}</TableCell>
                                    <TableCell>{p.name}</TableCell>
                                    <TableCell>{p.registerNumber}</TableCell>
                                    <TableCell>{getDeptName(p.departmentId)}</TableCell>
                                    <TableCell className="capitalize">{p.gender}</TableCell>
                                    <TableCell>{getSemesterGroup(p.semester)}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(p)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteParticipant(p.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Participant</DialogTitle>
                    </DialogHeader>
                    {editingParticipant && (
                        <div className="grid gap-4 py-4">
                            <Input placeholder="Name" value={editingParticipant.name} onChange={e => setEditingParticipant({ ...editingParticipant, name: e.target.value })} />
                            <Input placeholder="Register Number" value={editingParticipant.registerNumber} onChange={e => setEditingParticipant({ ...editingParticipant, registerNumber: e.target.value })} />
                            <Select value={editingParticipant.departmentId} onValueChange={(v: string) => setEditingParticipant({ ...editingParticipant, departmentId: v })}>
                                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                                <SelectContent>
                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {editingParticipant.departmentId && batches.filter(b => b.departmentId === editingParticipant.departmentId).length > 0 && (
                                <Select value={editingParticipant.batchId} onValueChange={(v: string) => setEditingParticipant({ ...editingParticipant, batchId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
                                    <SelectContent>
                                        {batches.filter(b => b.departmentId === editingParticipant.departmentId).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                            <Select value={editingParticipant.gender} onValueChange={(v: "male" | "female") => setEditingParticipant({ ...editingParticipant, gender: v })}>
                                <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={String(editingParticipant.semester)} onValueChange={(v: string) => setEditingParticipant({ ...editingParticipant, semester: parseInt(v) })}>
                                <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">S1/S2</SelectItem>
                                    <SelectItem value="3">S3/S4</SelectItem>
                                    <SelectItem value="5">S5/S6</SelectItem>
                                    <SelectItem value="7">S7/S8</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={handleEditParticipant} disabled={updating}>
                            {updating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</> : "Update Participant"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
