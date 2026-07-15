import { loadSecuritySettingsData } from '$lib/api/admin-api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => loadSecuritySettingsData();
