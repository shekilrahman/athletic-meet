import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
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
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "../../components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Plus, Edit, Trash2, Loader2, Search } from "lucide-react";
import type { Participant, Department, Batch } from "../../types";

export default function OfftrackParticipants() {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Add/Edit State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
    const [newParticipant, setNewParticipant] = useState({
        name: "",
        registerNumber: "",
        chestNumber: "",
        departmentId: "",
        batchId: "",
        semester: 1,
        gender: "male",
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [pSnap, dSnap, bSnap] = await Promise.all([
                getDocs(collection(db, "participants")),
                getDocs(collection(db, "departments")),
                getDocs(collection(db, "batches")),
            ]);
            setParticipants(pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]);
            setDepartments(dSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Department[]);
            setBatches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Batch[]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newParticipant.name.trim() || !newParticipant.registerNumber || !newParticipant.departmentId) {
            alert("Name, Register Number, and Department are required.");
            return;
        }
        setSaving(true);
        try {
            // Check if Register Number is unique
            const existingReg = participants.find(p => p.registerNumber === newParticipant.registerNumber);
            if (existingReg) {
                alert(`Participant already exists!\nName: ${existingReg.name}\nChest No: ${existingReg.chestNumber}\nReg No: ${existingReg.registerNumber}`);
                setSaving(false);
                return;
            }

            // Auto-generate Chest Number
            let maxChest = 100; // Default start before 101
            participants.forEach(p => {
                const cn = parseInt(p.chestNumber);
                if (!isNaN(cn) && cn > maxChest) {
                    maxChest = cn;
                }
            });
            const nextChestNumber = String(maxChest + 1);

            await addDoc(collection(db, "participants"), {
                name: newParticipant.name,
                registerNumber: newParticipant.registerNumber,
                departmentId: newParticipant.departmentId,
                batchId: newParticipant.batchId,
                semester: newParticipant.semester,
                gender: newParticipant.gender,
                chestNumber: nextChestNumber,
                totalPoints: 0,
                individualWins: 0,
            });
            setIsAddOpen(false);
            setNewParticipant({ name: "", registerNumber: "", chestNumber: "", departmentId: "", batchId: "", semester: 1, gender: "male" });
            fetchData();
        } catch (error) {
            console.error("Error creating participant:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingParticipant) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "participants", editingParticipant.id), {
                name: editingParticipant.name,
                registerNumber: editingParticipant.registerNumber,
                chestNumber: editingParticipant.chestNumber,
                departmentId: editingParticipant.departmentId,
                batchId: editingParticipant.batchId,
                semester: editingParticipant.semester,
                gender: editingParticipant.gender,
            });
            setIsEditOpen(false);
            setEditingParticipant(null);
            fetchData();
        } catch (error) {
            console.error("Error updating participant:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this participant?")) return;
        try {
            await deleteDoc(doc(db, "participants", id));
            fetchData();
        } catch (error) {
            console.error("Error deleting participant:", error);
        }
    };

    const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || id;
    const getSemesterGroup = (sem: number): string => {
        if (sem <= 2) return "S1/S2";
        if (sem <= 4) return "S3/S4";
        if (sem <= 6) return "S5/S6";
        return "S7/S8";
    };

    const filterParticipants = (gender: 'male' | 'female') => {
        return participants.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.chestNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.registerNumber?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch && p.gender === gender;
        });
    };

    const ParticipantTable = ({ data }: { data: Participant[] }) => (
        <div className="rounded-md border bg-white shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Chest #</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Register #</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Semester</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                        </TableRow>
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No participants found</TableCell>
                        </TableRow>
                    ) : (
                        data.map(p => (
                            <TableRow key={p.id}>
                                <TableCell className="font-mono font-bold">{p.chestNumber}</TableCell>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell className="font-mono text-sm">{p.registerNumber}</TableCell>
                                <TableCell>{getDeptName(p.departmentId)}</TableCell>
                                <TableCell><Badge variant="outline">{getSemesterGroup(p.semester)}</Badge></TableCell>
                                <TableCell>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingParticipant(p); setIsEditOpen(true); }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(p.id)}>
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
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Participants</h2>
                    <p className="text-muted-foreground">Manage all registered participants</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="h-4 w-4 mr-2" /> Add Participant</Button>
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
                            <Select value={newParticipant.batchId} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, batchId: v })}>
                                <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
                                <SelectContent>
                                    {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={String(newParticipant.semester)} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, semester: Number(v) })}>
                                <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">S1/S2</SelectItem>
                                    <SelectItem value="3">S3/S4</SelectItem>
                                    <SelectItem value="5">S5/S6</SelectItem>
                                    <SelectItem value="7">S7/S8</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={newParticipant.gender} onValueChange={(v: string) => setNewParticipant({ ...newParticipant, gender: v })}>
                                <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Add Participant
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by name, chest#, register#..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                    </div>
                </CardContent>
            </Card>

            {/* Tabbed View */}
            <Tabs defaultValue="male" className="w-full">
                <TabsList>
                    <TabsTrigger value="male">Men ({filterParticipants('male').length})</TabsTrigger>
                    <TabsTrigger value="female">Women ({filterParticipants('female').length})</TabsTrigger>
                </TabsList>
                <TabsContent value="male">
                    <ParticipantTable data={filterParticipants('male')} />
                </TabsContent>
                <TabsContent value="female">
                    <ParticipantTable data={filterParticipants('female')} />
                </TabsContent>
            </Tabs>

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
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Chest #:</span>
                                <Badge variant="outline" className="font-mono">{editingParticipant.chestNumber}</Badge>
                            </div>
                            <Select value={editingParticipant.departmentId} onValueChange={(v: string) => setEditingParticipant({ ...editingParticipant, departmentId: v })}>
                                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                                <SelectContent>
                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={String(editingParticipant.semester)} onValueChange={(v: string) => setEditingParticipant({ ...editingParticipant, semester: Number(v) })}>
                                <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">S1/S2</SelectItem>
                                    <SelectItem value="3">S3/S4</SelectItem>
                                    <SelectItem value="5">S5/S6</SelectItem>
                                    <SelectItem value="7">S7/S8</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={editingParticipant.gender} onValueChange={(v: string) => setEditingParticipant({ ...editingParticipant, gender: v as "male" | "female" })}>
                                <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={handleUpdate} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Update Participant
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
