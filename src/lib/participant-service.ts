import { db } from "./firebase";
import {
    collection,
    runTransaction,
    doc,
    getDocs,
    query,
    where,
    serverTimestamp,
} from "firebase/firestore";
import type { Participant } from "../types";

// Minimum chest number to start from if no participants exist
const MIN_CHEST_NUMBER = 101;

export interface RegistrationData {
    name: string;
    registerNumber: string;
    departmentId: string;
    batchId: string;
    gender: "male" | "female";
    semester: number;
}

/**
 * Registers a new participant with an auto-generated, unique chest number.
 * Uses a Firestore transaction to ensure concurrency safety.
 */
export async function registerParticipant(data: RegistrationData): Promise<Participant> {

    // 1. Validate input
    if (!data.name || !data.registerNumber || !data.departmentId) {
        throw new Error("Missing required fields: Name, Register Number, or Department.");
    }

    const regNum = data.registerNumber.toUpperCase().trim();

    try {
        const newParticipant = await runTransaction(db, async (transaction) => {

            // 2. Check for existing participant with same Register Number
            // Note: Queries inside transactions must be done carefully. 
            // Ideally, we should use a deterministic ID like regNum for the doc ID to ensure uniqueness,
            // but the current system seems to use auto-IDs.
            // We will perform a query first. While technically there's a tiny window for race condition on *creation* if we don't lock,
            // the main issue to solve is duplicate chest numbers.
            // We'll trust the caller/UI to handle basic duplicates, but we do a check here.
            const participantsRef = collection(db, "participants");
            const q = query(participantsRef, where("registerNumber", "==", regNum));
            const existingDocs = await getDocs(q); // Read outside? Better inside for consistency if possible, but Firestore client doesn't support query inside txn easily for all SDKs.

            // Actually, we can just run the query. Transactional consistency for queries is tricky.
            // Let's assume the uniqueconstraint is on ChestNumber for this task.
            if (!existingDocs.empty) {
                const existing = existingDocs.docs[0].data();
                throw new Error(`Participant with Register Number ${regNum} already exists (Chest #${existing.chestNumber}).`);
            }

            // 3. Get the next Chest Number from a counter document
            const counterRef = doc(db, "counters", "participants");
            const counterSnap = await transaction.get(counterRef);

            let nextChestNumber = MIN_CHEST_NUMBER;

            if (!counterSnap.exists()) {
                // First time setup: Scan existing participants to find max chest number
                // This is a one-time migration step that happens automatically
                // We'll read the collection (expensive but one-time) or just start safe.
                // For safety in this specific codebase, let's query the max chest number if we can, 
                // OR since we are "fixing" it, we might want to just set it to a safe high number manually?
                // Better approach: Let's query relevant participants.
                // Since we can't easily query "max" in Firestore without an index, 
                // we'll assume the client logic was finding max. 
                // We will throw an error if this is the FIRST run and tell them to initialize, 
                // OR we can just try to find it.

                // Let's try to initialize it safely by reading all (assuming < 1000 participants for a college meet).
                // If this is too heavy, we might need a manual script. 
                // But for this task, I'll implement a safe initialization.

                // We cannot perform valid queries inside the transaction that depend on the transaction lock easily for this.
                // So we will initialize with a safe default or 101.
                // However, to be safe, let's assume valid data exists and we need to respect it.

                // STRATEGY: Create the counter doc if missing.
                // We can't await a query inside the transaction passed function easily in all envs without cost.
                // But we can just set it to 101.
                // wait... if we set to 101 and people exist at 150, we get duplicates.

                // Let's do a read BEFORE transaction to initialize if needed.
                throw new Error("System Error: Chest Number counter not initialized. Please contact admin to initialize 'counters/participants'.");
            } else {
                const currentCount = counterSnap.data().count || MIN_CHEST_NUMBER - 1;
                nextChestNumber = currentCount + 1;
            }

            // 4. Update the counter
            transaction.update(counterRef, { count: nextChestNumber });

            // 5. Create the participant
            const newParticipantRef = doc(collection(db, "participants"));
            const newParticipantData: Participant = {
                id: newParticipantRef.id,
                ...data,
                registerNumber: regNum,
                chestNumber: String(nextChestNumber),
                totalPoints: 0,
                individualWins: 0,
                // @ts-ignore - handling potential missing fields in type vs firestore
                createdAt: serverTimestamp()
            };

            transaction.set(newParticipantRef, newParticipantData);

            return newParticipantData;
        });

        return newParticipant;

    } catch (e: any) {
        // Handle the specific initialization error by trying to auto-initialize ONCE
        if (e.message && e.message.includes("counter not initialized")) {
            await initializeCounter();
            return registerParticipant(data); // Retry once
        }
        throw e;
    }
}

/**
 * One-time initialization of the counter based on existing data.
 */
async function initializeCounter() {
    // 1. Calculate max chest number from existing participants (outside transaction)
    const participantsRef = collection(db, "participants");
    const snapshot = await getDocs(participantsRef);

    let maxChest = 100;
    snapshot.docs.forEach(doc => {
        const cn = parseInt(doc.data().chestNumber);
        if (!isNaN(cn) && cn > maxChest) {
            maxChest = cn;
        }
    });

    const counterRef = doc(db, "counters", "participants");

    // 2. Safely initialize counter ONLY if it doesn't exist
    await runTransaction(db, async (t) => {
        const docSnap = await t.get(counterRef);
        if (!docSnap.exists()) {
            t.set(counterRef, { count: maxChest });
        }
        // If it exists, we do nothing (someone else beat us to it), which is safe.
    });
}
