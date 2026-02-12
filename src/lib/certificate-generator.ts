import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from './supabase';
import type { SystemSettings } from '../types';

// Default assets (make sure these exist or provide fallback URLs if possible, otherwise rely on DB)
import collegeLogoDefault from '../assets/college.png';
import principalSignatureDefault from '../assets/princiaple.png';
import hodSignatureDefault from '../assets/HOD.png';

export type CertificateType = '1st' | '2nd' | '3rd' | 'participation';

interface CertificateOptions {
    type: CertificateType;
    participantName: string;
    eventName: string;
    departmentName: string;
    registerNumber: string;
    semester: string;
    gender: string;
    returnDataUrl?: boolean;
}

// Helper to load image as base64 or HTMLImageElement for jsPDF
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`Failed to load image: ${src}`);
            // Resolve with empty image to prevent crash
            resolve(new Image());
        };
        img.src = src;
    });
};

/* --- COLORS --- */
const COLORS = {
    GOLD: '#B8860B',
    SILVER: '#757575',
    BRONZE: '#A0522D',
    BLUE: '#1E88E5',
    BLACK: '#000000',
    DARK_GRAY: '#333333',
    GRAY: '#333333',
    RED: '#D32F2F',
    LIGHT_GOLD: '#f9f3e5', // Very light for watermark
    LIGHT_SILVER: '#f2f2f2',
    LIGHT_BRONZE: '#f5e8e4',
};

const getThemeColor = (type: CertificateType) => {
    switch (type) {
        case '1st': return COLORS.GOLD;
        case '2nd': return COLORS.SILVER;
        case '3rd': return COLORS.BRONZE;
        case 'participation': return COLORS.BLUE;
        default: return COLORS.BLACK;
    }
};

/* --- JUSTIFIED TEXT ENGINE --- */
interface TextToken {
    text: string;
    font: 'normal' | 'bolditalic';
    color?: string; // Optional color override
    width?: number; // Calculated width
}

const drawJustifiedParagraph = (
    doc: jsPDF,
    tokens: TextToken[],
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    fontSize: number
) => {
    // 1. Measure all tokens
    doc.setFontSize(fontSize);

    // Space width
    doc.setFont("times", "normal");
    const spaceWidth = doc.getTextWidth(" ");

    const measuredTokens = tokens.map(token => {
        const text = String(token.text);
        doc.setFont("times", token.font);
        return {
            ...token,
            text,
            width: doc.getTextWidth(text)
        };
    });

    // 2. Break into lines
    const lines: TextToken[][] = [];
    let currentLine: TextToken[] = [];
    let currentLineWidth = 0;

    measuredTokens.forEach(token => {
        const textParts = token.text.split('\n');

        textParts.forEach((part, partIndex) => {
            if (partIndex > 0) {
                // Force line break
                lines.push(currentLine);
                currentLine = [];
                currentLineWidth = 0;
            }

            if (!part) return;

            const subWords = part.split(' ');
            subWords.forEach((word) => {
                if (!word) return;

                doc.setFont("times", token.font);
                const wordWidth = doc.getTextWidth(word);

                if (currentLineWidth + wordWidth + (currentLine.length > 0 ? spaceWidth : 0) > maxWidth) {
                    lines.push(currentLine);
                    currentLine = [];
                    currentLineWidth = 0;
                }

                currentLine.push({
                    text: word,
                    font: token.font,
                    color: token.color,
                    width: wordWidth
                });
                currentLineWidth += wordWidth + spaceWidth;
            });
        });
    });
    if (currentLine.length > 0) lines.push(currentLine);


    // 3. Draw Lines
    let cursorY = y;

    lines.forEach((line, lineIndex) => {
        const isLastLine = lineIndex === lines.length - 1;

        // Calculate total text width
        const totalTextWidth = line.reduce((acc, t) => acc + (t.width || 0), 0);

        // Calculate gaps
        const gaps = line.length - 1;
        let gapWidth = spaceWidth; // Default for last line

        if (!isLastLine && gaps > 0) {
            const availableSpace = maxWidth - totalTextWidth;
            gapWidth = availableSpace / gaps;
        }

        // Draw tokens
        let cursorX = x;
        if (isLastLine) {
            const lastLineWidth = totalTextWidth + (gaps * spaceWidth);
            cursorX = x + (maxWidth - lastLineWidth) / 2;
            gapWidth = spaceWidth;
        }

        line.forEach((token) => {
            doc.setFont("times", token.font);
            doc.setTextColor(token.color || COLORS.GRAY); // Default gray, override if set
            doc.text(token.text, cursorX, cursorY);

            cursorX += (token.width || 0) + gapWidth;
        });

        cursorY += lineHeight;
    });
};

const generateQrCodeDataUrl = async (text: string): Promise<string> => {
    try {
        return await QRCode.toDataURL(text, {
            errorCorrectionLevel: 'M',
            margin: 0,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
    } catch (err) {
        console.error("Error generating QR code", err);
        return "";
    }
};

// Fetch settings helper
const fetchSystemSettings = async (): Promise<SystemSettings | null> => {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 'config')
            .single();

        if (error) {
            console.warn("Failed to fetch settings, using defaults", error);
            return null;
        }
        return data as SystemSettings;
    } catch (e) {
        console.warn("Exception fetching settings", e);
        return null;
    }
}

/* --- MAIN FUNCTION --- */
export async function generateCertificate(options: CertificateOptions): Promise<string | void> {
    const { type, participantName, eventName, departmentName, registerNumber, semester, gender, returnDataUrl } = options;

    // Fetch settings
    const settings = await fetchSystemSettings();

    // Fallback values
    const collegeName = settings?.college_name || "GOVERNMENT ENGINEERING COLLEGE WAYANAD";
    const hodName = settings?.hod_name || "Dr. Joly Thomas";
    const principalName = settings?.principal_name || "Dr. Pradeep V";

    // Image URLs (Prioritize settings, fallback to imports)
    const collegeLogoUrl = settings?.college_logo_url || collegeLogoDefault;
    const companyLogoUrl = settings?.company_logo_url || "";
    const watermarkUrl = settings?.watermark_url || "";
    const principalSigUrl = settings?.principal_signature_url || principalSignatureDefault;
    const hodSigUrl = settings?.hod_signature_url || hodSignatureDefault; // Fallback to principal sig if HOD missing for now? Or blank?

    const themeColor = getThemeColor(type);

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;

    const [collegeImg, companyImg, watermarkImg, principalSigImg, hodSigImg] = await Promise.all([
        loadImage(collegeLogoUrl),
        loadImage(companyLogoUrl),
        loadImage(watermarkUrl),
        loadImage(principalSigUrl),
        loadImage(hodSigUrl)
    ]);

    // Border
    doc.setDrawColor(themeColor);
    doc.setLineWidth(1.5);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

    // Inner Border
    if (type === 'participation') {
        doc.setLineWidth(0.5);
        doc.rect(12, 12, pageWidth - 24, pageHeight - 24);
        doc.setFillColor(themeColor);
        doc.triangle(10, 10, 30, 10, 10, 30, 'F');
        doc.triangle(pageWidth - 10, pageHeight - 10, pageWidth - 30, pageHeight - 10, pageWidth - 10, pageHeight - 30, 'F');
    } else {
        doc.setDrawColor(themeColor);
        doc.setLineWidth(0.5);
        doc.rect(13, 13, pageWidth - 26, pageHeight - 26);
        doc.setFillColor(themeColor);
        const cornerSize = 5;
        doc.rect(10, 10, cornerSize, cornerSize, 'F');
        doc.rect(pageWidth - 10 - cornerSize, 10, cornerSize, cornerSize, 'F');
        doc.rect(10, pageHeight - 10 - cornerSize, cornerSize, cornerSize, 'F');
        doc.rect(pageWidth - 10 - cornerSize, pageHeight - 10 - cornerSize, cornerSize, cornerSize, 'F');
    }

    // WATERMARK (Background) - Center of Page
    const watermarkSize = 120;
    // @ts-ignore
    doc.setGState(new doc.GState({ opacity: 0.2 })); // 20% opacity
    if (watermarkImg.width > 0) {
        doc.addImage(
            watermarkImg,
            'PNG',
            centerX - (watermarkSize / 2),
            (pageHeight / 2) - (watermarkSize / 2),
            watermarkSize,
            watermarkSize * (watermarkImg.height / watermarkImg.width),
            undefined,
            'FAST'
        );
    }
    // @ts-ignore
    doc.setGState(new doc.GState({ opacity: 1.0 }));

    // Header Images
    const logoY = 20;
    const logoSize = 25;

    if (collegeImg.width > 0) {
        doc.addImage(collegeImg, 'PNG', 20, logoY, logoSize, logoSize * (collegeImg.height / collegeImg.width), undefined, 'FAST');
    }

    // QR Code (Top Right)
    const qrSize = 25;
    const qrX = pageWidth - 20 - qrSize;
    const qrY = logoY;

    // Use current origin for verification link
    const verificationUrl = `${window.location.origin}/verify/${registerNumber}`;

    try {
        const qrDataUrl = await generateQrCodeDataUrl(verificationUrl);
        if (qrDataUrl) {
            doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        }
    } catch (e) {
        console.warn("Failed to generate QR code", e);
        // Fallback or leave empty
        doc.setDrawColor(COLORS.BLACK);
        doc.setLineWidth(0.5);
        doc.rect(qrX, qrY, qrSize, qrSize);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.GRAY);
    doc.text("Scan to Verify", qrX + (qrSize / 2), qrY + qrSize + 4, { align: 'center' });

    // Header Text
    let currentY = 25;
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.setTextColor(COLORS.BLACK);
    const maxTitleWidth = pageWidth - 100;
    const titleLines = doc.splitTextToSize(collegeName.toUpperCase(), maxTitleWidth);
    doc.text(titleLines, centerX, currentY, { align: 'center' });
    currentY += 8 * titleLines.length;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(COLORS.DARK_GRAY);
    doc.text("DEPARTMENT OF PHYSICAL EDUCATION ", centerX, currentY, { align: 'center' });

    currentY += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(COLORS.RED);
    doc.text("ANNUAL SPORTS MEET 2025-26", centerX, currentY, { align: 'center' });

    currentY += 15;
    const certTitle = type === 'participation' ? 'CERTIFICATE OF PARTICIPATION' : 'CERTIFICATE OF MERIT';
    doc.setFont("times", "bold");
    doc.setFontSize(28);
    doc.setTextColor(themeColor);
    doc.text(certTitle, centerX, currentY, { align: 'center' });


    // --- JUSTIFIED BODY CONTENT ---
    currentY += 28;
    const CONTENT_WIDTH = 220;
    const START_X = (pageWidth - CONTENT_WIDTH) / 2;
    const FONT_SIZE = 18;
    const LINE_HEIGHT = 12;

    const formattedDept = departmentName.toLowerCase().startsWith('department of')
        ? departmentName
        : `Department of ${departmentName}`;

    const formattedGender = gender.toLowerCase() === 'male' ? 'Men' : 'Women';
    const prefix = gender.toLowerCase() === 'male' ? 'Mr.' : 'Ms.';
    const placeText = type === '1st' ? "First" : type === '2nd' ? "Second" : type === '3rd' ? "Third" : null;

    const semesterStr = String(semester);
    const semesterMatch = semesterStr.match(/(\d+)(?:\D*)$/);
    let semesterNum = semesterMatch ? parseInt(semesterMatch[1]) : parseInt(semesterStr);

    // Map odd semesters to even (e.g., 1 -> 2 Semester, 3 -> 4 Semester)
    if (!isNaN(semesterNum) && semesterNum % 2 !== 0) {
        semesterNum += 1;
    }

    // Add ordinal suffix (st, nd, rd, th)
    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const semesterDisplay = !isNaN(semesterNum) ? `${getOrdinal(semesterNum)} Semester` : semesterStr;

    const tokens: TextToken[] = [
        { text: "This is to certify that", font: 'normal' },
        { text: `${prefix} ${participantName.toUpperCase()}`, font: 'bolditalic', color: COLORS.BLACK },
        { text: `(KTU Reg. No. ${registerNumber.toUpperCase()}),`, font: 'bolditalic', color: COLORS.BLACK },
        { text: "of", font: 'normal' },
        { text: `${semesterDisplay},`, font: 'bolditalic', color: COLORS.BLACK },
        { text: `${formattedDept},`, font: 'bolditalic', color: COLORS.BLACK },
    ];

    if (type === 'participation') {
        tokens.push({ text: "has successfully participated in the", font: 'normal' });
    } else {
        tokens.push({ text: "has secured the", font: 'normal' });
        tokens.push({ text: `${placeText} Position`, font: 'bolditalic', color: themeColor });
        tokens.push({ text: "in the", font: 'normal' });
    }

    tokens.push({ text: eventName, font: 'bolditalic', color: COLORS.BLACK });
    tokens.push({ text: `(${formattedGender})`, font: 'bolditalic', color: COLORS.BLACK });
    tokens.push({ text: "event held as part of the Annual Sports Meet 2025–26 on 10th & 11th February 2026.", font: 'normal' });

    drawJustifiedParagraph(doc, tokens, START_X, currentY, CONTENT_WIDTH, LINE_HEIGHT, FONT_SIZE);


    // --- FOOTER ---
    const footerY = pageHeight - 40;
    const commonBaseY = footerY - 20; // Shared base Y for alignment

    // 3 Columns: HOD (Left), Company Logo (Center), Principal (Right)
    const col1X = pageWidth * 0.20; // HOD
    const col2X = pageWidth * 0.50; // Logo
    const col3X = pageWidth * 0.80; // Principal

    // 1. HOD (Left)
    doc.setDrawColor(COLORS.DARK_GRAY);
    // doc.line(col1X - 25, commonBaseY, col1X + 25, commonBaseY); // Signature Line Removed

    // HOD Signature
    const hodSigWidth = 40;
    const hodSigHeight = hodSigWidth * (hodSigImg.height / hodSigImg.width);
    if (hodSigImg.width > 0) {
        doc.addImage(hodSigImg, 'PNG', col1X - (hodSigWidth / 2), commonBaseY - hodSigHeight - 4, hodSigWidth, hodSigHeight, undefined, 'FAST');
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(COLORS.DARK_GRAY);
    doc.text(hodName, col1X, commonBaseY + 5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("HOD, Dept. of Physical Education", col1X, commonBaseY + 9, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Govt. Engineering College", col1X, commonBaseY + 13, { align: 'center' });
    doc.text("Wayanad", col1X, commonBaseY + 17, { align: 'center' });


    // 2. Company Logo (Center) - Larger (PRESERVED USER EDIT: 55mm and footerY + 5)
    // Logo remains at original footerY to stay centered or maybe slightly adjusted? Keeping as is for now unless asked.
    const largeCompanyLogoWidth = 55; // Updated to 55 as per user edit
    const largeCompanyLogoHeight = largeCompanyLogoWidth * (companyImg.height / companyImg.width);

    // Draw centered on col2X, aligned with footerY + 5
    if (companyImg.width > 0) {
        doc.addImage(companyImg, 'PNG', col2X - (largeCompanyLogoWidth / 2), footerY + 5, largeCompanyLogoWidth, largeCompanyLogoHeight, undefined, 'FAST');
    }


    // 3. Principal (Right)
    doc.setDrawColor(COLORS.DARK_GRAY);
    // doc.line(col3X - 25, commonBaseY, col3X + 25, commonBaseY); // Signature Line Removed

    // Principal Signature
    const sigWidth = 40;
    const sigHeight = sigWidth * (principalSigImg.height / principalSigImg.width);
    if (principalSigImg.width > 0) {
        doc.addImage(principalSigImg, 'PNG', col3X - (sigWidth / 2), commonBaseY - sigHeight - 4, sigWidth, sigHeight, undefined, 'FAST');
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(COLORS.DARK_GRAY);
    doc.text(principalName, col3X, commonBaseY + 5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PRINCIPAL", col3X, commonBaseY + 9, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Govt. Engineering College", col3X, commonBaseY + 13, { align: 'center' });
    doc.text("Wayanad", col3X, commonBaseY + 17, { align: 'center' });

    if (returnDataUrl) {
        return doc.output('bloburl').toString();
    } else {
        const rankLabel = type === 'participation' ? 'Participation' : `${type}_Place`;
        const cleanName = participantName.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `Certificate_${rankLabel}_${cleanName}.pdf`;
        doc.save(fileName);
    }
}
