import { loadProductEditorData } from '$lib/api/admin-api';
import type { PageLoad } from './$types';

export const prerender = false;
export const load: PageLoad = async ({ params }) => loadProductEditorData(params.productId);
