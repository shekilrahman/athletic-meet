import { supabase } from "./supabase";
import type { Participant } from "../types";

export interface RegistrationData {
    name: string;
    registerNumber: string;
    departmentId: string;
    batchId: string;
    gender: "male" | "female";
    semester: number;
}

/**
 * Registers a new participant.
 * Relies on Database constraints for uniqueness and sequences for chest number.
 */
export async function registerParticipant(data: RegistrationData): Promise<Participant> {

    // 1. Validate input
    if (!data.name || !data.registerNumber || !data.departmentId) {
        throw new Error("Missing required fields: Name, Register Number, or Department.");
    }

    const regNum = data.registerNumber.toUpperCase().trim();

    let attempts = 0;
    while (attempts < 3) {
        attempts++;
        try {
            // Auto-generate chest number
            const { data: allParts, error: fetchError } = await supabase
                .from('participants')
                .select('chest_number');

            if (fetchError) throw fetchError;

            let maxChest = 100;
            allParts?.forEach((p: any) => {
                const cn = parseInt(p.chest_number);
                if (!isNaN(cn) && cn > maxChest) maxChest = cn;
            });
            const nextChest = String(maxChest + 1);

            // Double check availability (optimistic lock)
            const { data: existing, error: checkError } = await supabase
                .from('participants')
                .select('id')
                .eq('chest_number', nextChest)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existing) {
                // Collision detected during check, retry immediately
                continue;
            }

            const { data: participantData, error } = await supabase
                .from('participants')
                .insert([
                    {
                        id: crypto.randomUUID(),
                        name: data.name,
                        register_number: regNum,
                        department_id: data.departmentId,
                        batch_id: data.batchId || null,
                        gender: data.gender,
                        semester: data.semester,
                        chest_number: nextChest,
                        total_points: 0,
                        individual_wins: 0
                    }
                ])
                .select()
                .single();

            if (error) {
                // Check for register number uniqueness
                if (error.code === '23505' && error.message?.includes('register_number')) {
                    throw new Error(`Participant with Register Number ${regNum} already exists.`);
                }

                // If error is related to chest_number uniqueness (if constraint exists) or other transient issue, retry
                if (attempts < 3) continue;
                throw error;
            }

            // Map snake_case DB response to camelCase TS interface
            return {
                id: participantData.id,
                registerNumber: participantData.register_number,
                name: participantData.name,
                departmentId: participantData.department_id,
                batchId: participantData.batch_id,
                semester: participantData.semester,
                gender: participantData.gender,
                chestNumber: participantData.chest_number,
                totalPoints: participantData.total_points,
                individualWins: participantData.individual_wins,
            };

        } catch (e: any) {
            if (attempts >= 3) {
                console.error("Error registering participant after retries:", e);
                throw e;
            }
            // If it's the specific reg number error, don't retry, throw immediately
            if (e.message?.includes('already exists')) throw e;
        }
    }
    throw new Error("Failed to register participant due to high traffic. Please try again.");
}
