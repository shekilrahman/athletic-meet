export type UserRole = 'admin' | 'staff';

export interface UserProfile {
    uid: string;
    email: string;
    role: UserRole;
    assignedEventId?: string; // For staff
    name: string;
    staffType?: 'ontrack' | 'offtrack';
    phone?: string;
    password?: string;
}

export interface Department {
    id: string;
    name: string;
    code: string; // e.g., CSE, ECE
    totalPoints: number;
    medalCount: {
        gold: number;
        silver: number;
        bronze: number;
    };
}

export interface Batch {
    id: string;
    name: string; // e.g., 2022-2026
    departmentId: string;
}

export interface Event {
    id: string;
    name: string;
    type: 'individual' | 'group';
    gender: 'male' | 'female' | 'mixed';
    status: 'upcoming' | 'ongoing' | 'completed';
    rounds: Round[];
    currentRoundIndex: number;
    participants: string[]; // Array of participant IDs or team IDs
    assignedStaffId?: string;
    winnerIds?: string[]; // IDs of winners (1st, 2nd, 3rd)
    teamSize?: number; // Number of participants per team (for group events)
    points1st?: number; // Points for 1st place
    points2nd?: number; // Points for 2nd place
    points3rd?: number; // Points for 3rd place
}

export interface Team {
    id: string;
    name: string;
    eventId: string;
    departmentId?: string; // Leading department or N/A
    memberIds: string[]; // Array of Participant IDs
}

export interface Round {
    id: string;
    name: string; // e.g., Heats, Semi-Final, Final
    sequence: number;
    status: 'pending' | 'ongoing' | 'completed';
    participants: RoundParticipant[];
}

export interface RoundParticipant {
    participantId: string;
    score?: number | string; // Time, Distance, or Points
    qualified: boolean;
    rank?: number;
    set?: number; // Which set/heat within the round (1, 2, 3...)
}

export interface Participant {
    id: string;
    registerNumber: string;
    name: string;
    departmentId: string;
    batchId: string;
    semester: number;
    gender: 'male' | 'female';
    chestNumber: string;
    totalPoints: number;
    individualWins: number;
}

// Helper types for forms
export interface EventRegistration {
    participantId: string;
    eventId: string;
}
