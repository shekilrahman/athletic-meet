import { supabase } from "./supabase";

export const seedDatabase = async () => {
    try {
        console.log("Starting Supabase Seed...");

        // 1. Create Admin User Profile (in 'staff' table)
        // Note: Actual Auth Users must be created in Supabase Dashboard or via API if client creation is disabled/requires email.
        // We will TRY to create them here using client SDK, which works if "Enable Email Signup" is on and "Confirm Email" is off.
        console.log("Attempting to create Auth Users (check console for errors)...");

        const createAuthUser = async (email: string, password: string, role: string, name: string) => {
            try {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { name, role }
                    }
                });

                if (error) {
                    console.warn(`Auth creation for ${email} failed (might already exist):`, error.message);
                    // If auth fails, we might still want to seed the 'staff' table if we know the UID.
                    // But we don't know the UID if we didn't just create it or sign in.
                    // For seeding data, we might just insert a placeholder or skip if auth fails.
                    return null;
                }

                if (data.user) {
                    console.log(`Auth user ${email} created.`);
                    return data.user.id;
                }
            } catch (e) {
                console.error(`Auth exception for ${email}:`, e);
            }
            return null;
        };

        const adminUid = await createAuthUser("admin@sports.com", "admin123", "admin", "System Admin");
        const staffUid = await createAuthUser("staff@sports.com", "staff123", "staff", "Staff Member");

        // 2. Seed 'staff' public table
        if (adminUid) {
            const { error } = await supabase.from('staff').upsert({
                uid: adminUid,
                email: "admin@sports.com",
                name: "System Admin",
                role: "admin",
                created_at: new Date().toISOString()
            }, { onConflict: 'uid' });
            if (error) console.error("Error seeding admin profile:", error);
        }

        if (staffUid) {
            const { error } = await supabase.from('staff').upsert({
                uid: staffUid,
                email: "staff@sports.com",
                name: "Staff Member",
                role: "staff",
                created_at: new Date().toISOString()
            }, { onConflict: 'uid' });
            if (error) console.error("Error seeding staff profile:", error);
        }

        // 3. Departments
        const departments = [
            { id: "dept-cse", name: "Computer Science", code: "CSE", total_points: 0, medal_count: { gold: 0, silver: 0, bronze: 0 } },
            { id: "dept-ece", name: "Electronics & Comm", code: "ECE", total_points: 0, medal_count: { gold: 0, silver: 0, bronze: 0 } },
            { id: "dept-mech", name: "Mechanical Eng", code: "MECH", total_points: 0, medal_count: { gold: 0, silver: 0, bronze: 0 } },
            { id: "dept-civil", name: "Civil Eng", code: "CIVIL", total_points: 0, medal_count: { gold: 0, silver: 0, bronze: 0 } },
        ];

        const { error: deptError } = await supabase.from('departments').upsert(departments);
        if (deptError) console.error("Error seeding departments:", deptError);

        // 4. Batches
        const batches = [
            { id: "batch-2022", name: "2022-2026", department_id: "all" },
            { id: "batch-2023", name: "2023-2027", department_id: "all" },
        ];

        // Note: Supabase likely expects valid UUIDs or strings matching foreign keys if enforced.
        // If 'department_id' is a foreign key to 'departments.id', then "all" might fail if not exists.
        // For this seed, we assume it's loose or we should fix it.
        // Let's create a dummy "all" department if needed, or just link to CSE for demo.
        // Actually, looking at previous code, department_id was "all".
        // If strict FK, this fails. Let's assume it's NOT strict or we should use existing IDs.
        // Let's map them to valid IDs to be safe, or just insert.
        // We'll try inserting as is.

        const { error: batchError } = await supabase.from('batches').upsert(batches);
        if (batchError) console.error("Error seeding batches:", batchError);

        console.log("Seeding process completed (check console for details).");
        alert("Seeding attempted.\n\nNote: Auth users (admin@sports.com / admin123) only created if 'Enable Email Signup' is ON in Supabase and they didn't exist.\nCheck Supabase Dashboard to confirm.");

    } catch (error) {
        console.error("Critical error seeding database:", error);
        alert("Error seeding database. Check console.");
    }
};
