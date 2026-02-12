
import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { generateCertificate, type CertificateType } from "../../lib/certificate-generator";
import { Download, RefreshCw, Eye } from "lucide-react";

export default function CertificatePreview() {
    const [formData, setFormData] = useState({
        type: '1st' as CertificateType,
        participantName: 'Muhammed Arshad N',
        eventName: '400m Race',
        departmentName: 'Electronics and Communication Engineering',
        registerNumber: 'WYD22EC074',
        semester: '5',
        gender: 'male'
    });
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleGeneratePreview = async () => {
        const url = await generateCertificate({
            type: formData.type,
            participantName: formData.participantName,
            eventName: formData.eventName,
            departmentName: formData.departmentName,
            registerNumber: formData.registerNumber,
            semester: formData.semester,
            gender: formData.gender,
            returnDataUrl: true
        });
        if (url) {
            setPreviewUrl(url);
        }
    };

    const handleDownload = () => {
        generateCertificate({
            type: formData.type,
            participantName: formData.participantName,
            eventName: formData.eventName,
            departmentName: formData.departmentName,
            registerNumber: formData.registerNumber,
            semester: formData.semester,
            gender: formData.gender
        });
    };

    // Auto-generate preview on mount
    useEffect(() => {
        handleGeneratePreview();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 gap-6">
            <div className="w-full max-w-6xl flex gap-6 flex-col md:flex-row items-start">

                {/* Control Panel */}
                <Card className="w-full md:w-1/3">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center justify-between">
                            Controls
                            <RefreshCw className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={handleGeneratePreview} />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Certificate Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(v: CertificateType) => setFormData({ ...formData, type: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1st">First Place (Merit)</SelectItem>
                                    <SelectItem value="2nd">Second Place (Merit)</SelectItem>
                                    <SelectItem value="3rd">Third Place (Merit)</SelectItem>
                                    <SelectItem value="participation">Participation</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Participant Name</Label>
                            <Input
                                value={formData.participantName}
                                onChange={(e) => setFormData({ ...formData, participantName: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Semester</Label>
                            <Input
                                value={formData.semester}
                                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Gender</Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(v) => setFormData({ ...formData, gender: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Event Name</Label>
                            <Input
                                value={formData.eventName}
                                onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Input
                                value={formData.departmentName}
                                onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
                            />
                        </div>

                        <div className="flex gap-2 mt-4">
                            <Button onClick={handleGeneratePreview} variant="outline" className="flex-1">
                                <Eye className="mr-2 h-4 w-4" />
                                Refresh Preview
                            </Button>
                            <Button onClick={handleDownload} className="flex-1">
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Live Preview Panel */}
                <Card className="w-full md:w-2/3 h-[80vh] flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xl">Live Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden bg-gray-200 rounded-b-lg relative">
                        {previewUrl ? (
                            <iframe
                                src={previewUrl}
                                className="w-full h-full border-0"
                                title="Certificate Preview"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                Generating preview...
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
