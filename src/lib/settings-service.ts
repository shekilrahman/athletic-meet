import { supabase } from "./supabase";

export interface SiteSettings {
    enable_downloads: boolean;
    enable_requests: boolean;
}

const DEFAULT_SETTINGS: SiteSettings = {
    enable_downloads: true,
    enable_requests: true,
};

export const getSiteSettings = async (): Promise<SiteSettings> => {
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('*');

        if (error) throw error;

        const settings = { ...DEFAULT_SETTINGS };
        data?.forEach((row: { key: string; value: any }) => {
            if (row.key in settings) {
                (settings as any)[row.key] = row.value;
            }
        });

        return settings;
    } catch (error) {
        console.error("Error fetching site settings:", error);
        return DEFAULT_SETTINGS;
    }
};

export const updateSiteSetting = async (key: keyof SiteSettings, value: boolean) => {
    const { error } = await supabase
        .from('site_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) throw error;
};
