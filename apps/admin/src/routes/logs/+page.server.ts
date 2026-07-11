import { logKindValues, logLevelValues } from '@packages/schemas';

import { localizeAdminLabel } from '$lib/labels';
import { asPageError, formatDateTime, loadLogsPageData } from '$lib/server/admin-api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	try {
		const logs = await loadLogsPageData(event);

		return {
			kindOptions: logKindValues.map((kind) => ({ label: localizeAdminLabel(kind), value: kind })),
			levelOptions: logLevelValues.map((level) => ({
				label: localizeAdminLabel(level),
				value: level
			})),
			logs: logs.map((log) => ({
				id: log.id,
				time: formatDateTime(log.createdAt),
				level: log.level,
				kind: log.kind,
				message: log.message
			}))
		};
	} catch (caughtError) {
		return asPageError(caughtError);
	}
};
