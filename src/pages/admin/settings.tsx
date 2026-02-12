
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Loader2, Save, Trash2 } from "lucide-react";
import type { SystemSettings } from "../../types";

export default function AdminSettings() {
    const [settings, setSettings] = useState<SystemSettings>({
        id: "config",
        college_name: "",
        hod_name: "",
        principal_name: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .eq('id', 'config')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No settings found, use defaults
                    console.log("No settings found, using defaults");
                } else {
                    throw error;
                }
            }

            if (data) {
                setSettings(data);
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('settings')
                .upsert(settings);

            if (error) throw error;
            alert("Settings saved successfully!");
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: keyof SystemSettings) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(field);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${field}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('assets')
                .getPublicUrl(filePath);

            const newSettings = { ...settings, [field]: publicUrl };
            setSettings(newSettings);

            // Auto-save on upload
            await supabase.from('settings').upsert(newSettings);

        } catch (error) {
            console.error("Error uploading file:", error);
            alert("Failed to upload file.");
        } finally {
            setUploading(null);
        }
    };

    const handleRemoveImage = async (field: keyof SystemSettings) => {
        if (!confirm("Are you sure you want to remove this image?")) return;

        try {
            // Update local state
            const newSettings = { ...settings, [field]: null };
            setSettings(newSettings);

            // Update database
            // Note: We are setting the field to null in the DB.
            // We are NOT deleting the file from storage to avoid complexity with tracking old files,
            // but in a production app you might want to clean up storage.
            const { error } = await supabase
                .from('settings')
                .upsert(newSettings);

            if (error) throw error;

        } catch (error) {
            console.error("Error removing image:", error);
            alert("Failed to remove image.");
        }
    };


    const ImagePreview = ({ url, alt, onRemove }: { url?: string | null, alt: string, onRemove: () => void }) => {
        if (!url) return <div className="h-24 w-full bg-gray-100 rounded-md flex items-center justify-center text-gray-400 text-sm border-dashed border-2">No Image</div>;

        return (
            <div className="relative group w-fit">
                <img src={url} alt={alt} className="h-24 object-contain rounded-md border bg-white" />
                <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-md"
                    onClick={onRemove}
                    title="Remove Image"
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        );
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
                <p className="text-muted-foreground">Manage certificate assets and signatures.</p>
            </div>

            <div className="grid gap-6">
                {/* General Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Organization Details</CardTitle>
                        <CardDescription>Details that appear on certificates.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="college_name">College Name</Label>
                            <Input
                                id="college_name"
                                value={settings.college_name}
                                onChange={(e) => setSettings({ ...settings, college_name: e.target.value })}
                                placeholder="GOVERNMENT ENGINEERING COLLEGE WAYANAD"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="hod_name">HOD Name</Label>
                                <Input
                                    id="hod_name"
                                    value={settings.hod_name}
                                    onChange={(e) => setSettings({ ...settings, hod_name: e.target.value })}
                                    placeholder="Dr. Joly Thomas"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="principal_name">Principal Name</Label>
                                <Input
                                    id="principal_name"
                                    value={settings.principal_name}
                                    onChange={(e) => setSettings({ ...settings, principal_name: e.target.value })}
                                    placeholder="Dr. Pradeep V"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Assets */}
                <Card>
                    <CardHeader>
                        <CardTitle>Assets & Logos</CardTitle>
                        <CardDescription>Upload images for the certificate generation.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        <div className="space-y-2">
                            <Label>College Logo</Label>
                            <ImagePreview
                                url={settings.college_logo_url}
                                alt="College Logo"
                                onRemove={() => handleRemoveImage('college_logo_url')}
                            />
                            <div className="flex items-center gap-2">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, 'college_logo_url')}
                                    disabled={uploading === 'college_logo_url'}
                                    className="cursor-pointer"
                                />
                                {uploading === 'college_logo_url' && <Loader2 className="animate-spin h-4 w-4" />}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Company/Sponsor Logo</Label>
                            <ImagePreview
                                url={settings.company_logo_url}
                                alt="Company Logo"
                                onRemove={() => handleRemoveImage('company_logo_url')}
                            />
                            <div className="flex items-center gap-2">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, 'company_logo_url')}
                                    disabled={uploading === 'company_logo_url'}
                                />
                                {uploading === 'company_logo_url' && <Loader2 className="animate-spin h-4 w-4" />}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Watermark</Label>
                            <ImagePreview
                                url={settings.watermark_url}
                                alt="Watermark"
                                onRemove={() => handleRemoveImage('watermark_url')}
                            />
                            <div className="flex items-center gap-2">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, 'watermark_url')}
                                    disabled={uploading === 'watermark_url'}
                                />
                                {uploading === 'watermark_url' && <Loader2 className="animate-spin h-4 w-4" />}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>HOD Signature</Label>
                            <ImagePreview
                                url={settings.hod_signature_url}
                                alt="HOD Sig"
                                onRemove={() => handleRemoveImage('hod_signature_url')}
                            />
                            <div className="flex items-center gap-2">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, 'hod_signature_url')}
                                    disabled={uploading === 'hod_signature_url'}
                                />
                                {uploading === 'hod_signature_url' && <Loader2 className="animate-spin h-4 w-4" />}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Principal Signature</Label>
                            <ImagePreview
                                url={settings.principal_signature_url}
                                alt="Principal Sig"
                                onRemove={() => handleRemoveImage('principal_signature_url')}
                            />
                            <div className="flex items-center gap-2">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, 'principal_signature_url')}
                                    disabled={uploading === 'principal_signature_url'}
                                />
                                {uploading === 'principal_signature_url' && <Loader2 className="animate-spin h-4 w-4" />}
                            </div>
                        </div>

                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving} size="lg">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
}
