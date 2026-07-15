import { logKindValues, logLevelValues } from '@packages/schemas';

import { formatDateTime, loadLogsPageData } from '$lib/api/admin-api';
import { localizeAdminLabel } from '$lib/labels';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const result = await loadLogsPageData(url.searchParams);
	return {
		logs: result.data.map((log) => ({ ...log, time: formatDateTime(log.createdAt) })),
		pagination: result.pagination,
		levelOptions: logLevelValues.map((level) => ({
			label: localizeAdminLabel(level),
			value: level
		})),
		kindOptions: logKindValues.map((kind) => ({
			label: localizeAdminLabel(kind),
			value: kind
		}))
	};
};
