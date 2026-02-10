import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserProfile } from "../types";

export const seedDatabase = async () => {
    try {
        // 1. Create Admin User
        // Note: This will sign in the user. We'll sign out after creating the profile.
        console.log("Creating Admin User...");
        try {
            const adminCred = await createUserWithEmailAndPassword(auth, "admin@sports.com", "admin123");
            const adminProfile: UserProfile = {
                uid: adminCred.user.uid,
                email: "admin@sports.com",
                name: "System Admin",
                role: "admin",
            };
            // Storing in 'staff' collection as AuthProvider currently checks there
            await setDoc(doc(db, "staff", adminCred.user.uid), adminProfile);
            await signOut(auth);
        } catch (e: any) {
            if (e.code === 'auth/email-already-in-use') {
                console.log("Admin user already exists");
            } else {
                throw e;
            }
        }

        // 2. Create Staff User
        console.log("Creating Staff User...");
        try {
            const staffCred = await createUserWithEmailAndPassword(auth, "staff@sports.com", "staff123");
            const staffProfile: UserProfile = {
                uid: staffCred.user.uid,
                email: "staff@sports.com",
                name: "Staff Member",
                role: "staff",
            };
            await setDoc(doc(db, "staff", staffCred.user.uid), staffProfile);
            await signOut(auth);
        } catch (e: any) {
            if (e.code === 'auth/email-already-in-use') {
                console.log("Staff user already exists");
            } else {
                throw e;
            }
        }

        // 3. Create Departments (if they don't exist, we just overwrite for seeding)
        const departments = [
            { id: "dept-cse", name: "Computer Science", code: "CSE", totalPoints: 0, medalCount: { gold: 0, silver: 0, bronze: 0 } },
            { id: "dept-ece", name: "Electronics & Comm", code: "ECE", totalPoints: 0, medalCount: { gold: 0, silver: 0, bronze: 0 } },
            { id: "dept-mech", name: "Mechanical Eng", code: "MECH", totalPoints: 0, medalCount: { gold: 0, silver: 0, bronze: 0 } },
            { id: "dept-civil", name: "Civil Eng", code: "CIVIL", totalPoints: 0, medalCount: { gold: 0, silver: 0, bronze: 0 } },
        ];

        const batch = writeBatch(db);
        departments.forEach((dept) => {
            const deptRef = doc(db, "departments", dept.id);
            batch.set(deptRef, dept);
        });

        // 4. Create Batches
        const batches = [
            { id: "batch-2022", name: "2022-2026", departmentId: "all" }, // Simplified for now
            { id: "batch-2023", name: "2023-2027", departmentId: "all" },
        ];

        batches.forEach((b) => {
            // creating a unique ID if not provided, or using deterministic ID
            const batchRef = doc(db, "batches", b.id);
            batch.set(batchRef, b);
        });

        await batch.commit();

        console.log("Database seeded successfully!");
        alert("Database seeded! \nAdmin: admin@sports.com / admin123\nStaff: staff@sports.com / staff123");

    } catch (error) {
        console.error("Error seeding database:", error);
        alert("Error seeding database check console.");
    }
};
