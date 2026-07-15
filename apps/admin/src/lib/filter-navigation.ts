import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { Pathname } from '$app/types';

const pendingNavigations = new WeakMap<HTMLFormElement, ReturnType<typeof setTimeout>>();

function cancelPendingNavigation(form: HTMLFormElement): void {
	const pending = pendingNavigations.get(form);
	if (pending) clearTimeout(pending);
	pendingNavigations.delete(form);
}

export function buildFilterQuery(entries: Iterable<readonly [string, FormDataEntryValue]>): string {
	const params = new URLSearchParams();
	for (const [key, value] of entries) {
		if (typeof value !== 'string') continue;
		const normalized = value.trim();
		if (normalized) params.set(key, normalized);
	}
	return params.toString();
}

function navigate(pathname: string, form: HTMLFormElement): void {
	const query = buildFilterQuery(new FormData(form).entries());
	void goto(resolve(`${pathname}${query ? `?${query}` : ''}` as Pathname), { invalidateAll: true });
}

export function applyFilters(pathname: string, form: HTMLFormElement): void {
	cancelPendingNavigation(form);
	navigate(pathname, form);
}

export function scheduleFilters(pathname: string, form: HTMLFormElement): void {
	cancelPendingNavigation(form);
	const pending = setTimeout(() => {
		pendingNavigations.delete(form);
		if (!form.isConnected) return;
		navigate(pathname, form);
	}, 350);
	pendingNavigations.set(form, pending);
}
