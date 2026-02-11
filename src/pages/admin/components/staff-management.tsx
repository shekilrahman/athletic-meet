import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
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
    DialogDescription,
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
import { Plus, Trash2, Edit, Loader2, Eye, EyeOff } from "lucide-react";
import type { UserProfile } from "../../../types";
import { Badge } from "../../../components/ui/badge";

export function StaffManagement() {
    const [staff, setStaff] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
    const [creating, setCreating] = useState(false);

    // Visibility states
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
    const [showAddPassword, setShowAddPassword] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: "", // Added password field
        staffType: "ontrack",
    });

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('staff')
                .select('*')
                .eq('role', 'staff');

            if (error) throw error;

            // Map Supabase data to UserProfile type if needed, but structure should match
            setStaff((data as any[]).map(s => ({
                uid: s.uid || s.id, // Handle potential id vs uid difference
                ...s
            })) as UserProfile[]);
        } catch (error) {
            console.error("Error fetching staff:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const handleAddStaff = async () => {
        if (!formData.email || !formData.password || !formData.name) {
            alert("Name, Email and Password are required");
            return;
        }

        setCreating(true);

        try {
            // Note: In a real Supabase app, creating a user usually requires
            // calling supabase.auth.signUp() (which logs you in) or using the Admin API (server-side).
            // For now, we are just creating the DB record. The Admin will need to create the Auth User
            // in the Supabase Dashboard manually or we need an Edge Function.

            // We'll generate a random ID for the DB record if we can't create the auth user
            const fakeUid = crypto.randomUUID();

            const { error } = await supabase.from('staff').insert([
                {
                    uid: fakeUid, // Ideally this should match the Auth User ID
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    role: "staff",
                    staff_type: formData.staffType, // Snake_case in DB likely
                    password: formData.password,
                }
            ]);

            if (error) throw error;

            setIsAddOpen(false);
            setFormData({ name: "", email: "", phone: "", password: "", staffType: "ontrack" });
            fetchStaff();
            alert(`Staff profile created! \n\nIMPORTANT: Since client-side admin creation isn't secure/supported directly, please go to your Supabase Dashboard > Authentication and CREATE the user manually with:\n\nEmail: ${formData.email}\nPassword: ${formData.password}\n\nCopy the User ID from the dashboard and update this record if needed.`);

        } catch (error) {
            console.error("Error adding staff:", error);
            alert("Failed to create staff. Check console.");
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteStaff = async (id: string) => {
        if (!confirm("Are you sure? This removes the staff profile from the database.")) return;
        try {
            const { error } = await supabase
                .from('staff')
                .delete()
                .eq('uid', id);

            if (error) throw error;
            fetchStaff();
        } catch (error) {
            console.error("Error deleting staff:", error);
        }
    };

    const openEdit = (staffMember: UserProfile) => {
        setEditingStaff(staffMember);
        setFormData({
            name: staffMember.name,
            email: staffMember.email,
            phone: staffMember.phone || "",
            password: "",
            staffType: staffMember.staffType || "ontrack",
        });
        setIsEditOpen(true);
    };

    const handleEditStaff = async () => {
        if (!editingStaff) return;
        try {
            const { error } = await supabase
                .from('staff')
                .update({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    staff_type: formData.staffType,
                    password: formData.password || undefined // Only update if provided
                })
                .eq('uid', editingStaff.uid);

            if (error) throw error;

            setIsEditOpen(false);
            setEditingStaff(null);
            fetchStaff();
        } catch (error) {
            console.error("Error updating staff:", error);
        }
    };

    const togglePasswordVisibility = (uid: string) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [uid]: !prev[uid]
        }));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Staff Accounts</h3>
                    <p className="text-sm text-muted-foreground">Manage ontrack and offtrack staff.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Add Staff
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Staff</DialogTitle>
                            <DialogDescription>
                                Create a new staff profile.
                                <span className="block mt-2 text-amber-600 text-xs font-bold">
                                    NOTE: You must also create the Auth User in Supabase Dashboard.
                                </span>
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Name</Label>
                                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="email" className="text-right">Email</Label>
                                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="password" className="text-right">Password</Label>
                                <div className="col-span-3 relative">
                                    <Input
                                        id="password"
                                        type={showAddPassword ? "text" : "password"}
                                        placeholder="Set login password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                        onClick={() => setShowAddPassword(!showAddPassword)}
                                    >
                                        {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="phone" className="text-right">Phone</Label>
                                <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="type" className="text-right">Type</Label>
                                <Select value={formData.staffType} onValueChange={(val: string) => setFormData({ ...formData, staffType: val })}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ontrack">Ontrack (Judges/Marshals)</SelectItem>
                                        <SelectItem value="offtrack">Offtrack (Registration/Logistics)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddStaff} disabled={creating}>
                                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {creating ? "Creating..." : "Create Profile"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Password</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-4">Loading staff...</TableCell></TableRow>
                        ) : staff.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No staff found.</TableCell></TableRow>
                        ) : (
                            staff.map((s) => (
                                <TableRow key={s.uid}>
                                    <TableCell className="font-medium">{s.name}</TableCell>
                                    <TableCell>{s.email}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm">
                                                {visiblePasswords[s.uid] ? (s.password || "Not Set") : "••••••••"}
                                            </span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePasswordVisibility(s.uid)}>
                                                {visiblePasswords[s.uid] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>{s.phone || "-"}</TableCell>
                                    <TableCell>
                                        <Badge variant={s.staffType === 'ontrack' ? 'default' : 'secondary'}>
                                            {s.staffType === 'ontrack' ? 'Ontrack' : 'Offtrack'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteStaff(s.uid)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Staff</DialogTitle>
                        <DialogDescription>Update staff details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right">Name</Label>
                            <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-email" className="text-right">Email</Label>
                            <Input id="edit-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-password" className="text-right">Password</Label>
                            <div className="col-span-3 relative">
                                <Input
                                    id="edit-password"
                                    type={showEditPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    onClick={() => setShowEditPassword(!showEditPassword)}
                                >
                                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-phone" className="text-right">Phone</Label>
                            <Input id="edit-phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-type" className="text-right">Type</Label>
                            <Select value={formData.staffType} onValueChange={(val: string) => setFormData({ ...formData, staffType: val })}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ontrack">Ontrack</SelectItem>
                                    <SelectItem value="offtrack">Offtrack</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleEditStaff}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
