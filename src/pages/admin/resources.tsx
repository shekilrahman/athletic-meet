import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import type { Department, Batch } from "../../types";

import { StaffManagement } from "./components/staff-management";
import { ParticipantManagement } from "./components/participant-management";

export default function ManageResources() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);

    const [newDeptName, setNewDeptName] = useState("");
    const [newDeptCode, setNewDeptCode] = useState("");

    const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
    const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
    const [newBatchName, setNewBatchName] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: deptsData, error: deptsError } = await supabase
                .from('departments')
                .select('*');

            if (deptsError) throw deptsError;
            setDepartments((deptsData || []) as Department[]);

            const { data: batchesData, error: batchesError } = await supabase
                .from('batches')
                .select('*');

            if (batchesError) throw batchesError;
            setBatches((batchesData || []) as Batch[]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const addDepartment = async () => {
        if (!newDeptName || !newDeptCode) return;
        try {
            const { error } = await supabase
                .from('departments')
                .insert([{
                    id: crypto.randomUUID(),
                    name: newDeptName,
                    code: newDeptCode,
                    total_points: 0,
                    medal_count: { gold: 0, silver: 0, bronze: 0 }
                }]);

            if (error) throw error;

            setNewDeptName("");
            setNewDeptCode("");
            fetchData();
        } catch (error) {
            console.error("Error adding department:", error);
        }
    };

    const removeDepartment = async (id: string) => {
        if (!confirm("Are you sure? This will delete the department.")) return;
        try {
            const { error } = await supabase
                .from('departments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchData();
        } catch (error) {
            console.error("Error removing department:", error);
        }
    };

    const openAddBatch = (deptId: string) => {
        setSelectedDeptId(deptId);
        setNewBatchName("");
        setIsAddBatchOpen(true);
    };

    const handleAddBatch = async () => {
        if (!newBatchName || !selectedDeptId) return;
        try {
            const { error } = await supabase
                .from('batches')
                .insert([{
                    id: crypto.randomUUID(),
                    name: newBatchName,
                    department_id: selectedDeptId
                }]);

            if (error) throw error;

            setIsAddBatchOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error adding batch:", error);
        }
    };

    const getBatchesForDept = (deptId: string) => {
        return batches.filter(b => b.departmentId === deptId);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Manage Resources</h2>
                <p className="text-muted-foreground">Configure departments and batches.</p>
            </div>

            <Tabs defaultValue="departments" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="departments">Departments & Batches</TabsTrigger>
                    <TabsTrigger value="staff">Staff Accounts</TabsTrigger>
                    <TabsTrigger value="participants">Participants</TabsTrigger>
                </TabsList>

                <TabsContent value="departments" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Departments</CardTitle>
                            <CardDescription>Manage departments and their batches.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4 mb-6">
                                <Input placeholder="Department Name" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} />
                                <Input placeholder="Code (e.g. CSE)" className="w-32" value={newDeptCode} onChange={e => setNewDeptCode(e.target.value)} />
                                <Button onClick={addDepartment}><Plus className="mr-2 h-4 w-4" /> Add Dept</Button>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Batches (Sub-units)</TableHead>
                                        <TableHead className="w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                                    ) : departments.map((dept) => {
                                        const deptBatches = getBatchesForDept(dept.id);
                                        return (
                                            <TableRow key={dept.id}>
                                                <TableCell className="font-medium">{dept.code}</TableCell>
                                                <TableCell>{dept.name}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        {deptBatches.length > 0 ? (
                                                            deptBatches.map(b => (
                                                                <Badge key={b.id} variant="secondary">{b.name}</Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs italic">Single Unit</span>
                                                        )}
                                                        <Button variant="outline" size="icon" className="h-6 w-6 ml-2 rounded-full" onClick={() => openAddBatch(dept.id)}>
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => removeDepartment(dept.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="staff">
                    <StaffManagement />
                </TabsContent>

                <TabsContent value="participants">
                    <ParticipantManagement />
                </TabsContent>
            </Tabs>

            <Dialog open={isAddBatchOpen} onOpenChange={setIsAddBatchOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Batch</DialogTitle>
                        <DialogDescription>Add a new batch/sub-unit to the department.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="batchName" className="text-right">Name</Label>
                            <Input id="batchName" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} className="col-span-3" placeholder="e.g. A, B, or 2024" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddBatch}>Save Batch</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
