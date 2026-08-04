import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { Pathname } from '$app/types';

const pendingNavigations = new WeakMap<HTMLFormElement, ReturnType<typeof setTimeout>>();

export type FilterHandlers = {
	oninput: (event: Event) => void;
	onchange: (event: Event) => void;
	oncompositionstart: (event: CompositionEvent) => void;
	oncompositionend: (event: CompositionEvent) => void;
};

function cancelPendingNavigation(form: HTMLFormElement): void {
	const pending = pendingNavigations.get(form);
	if (pending) clearTimeout(pending);
	pendingNavigations.delete(form);
}

function getForm(event: Event): HTMLFormElement | null {
	const form = event.currentTarget as HTMLFormElement | null;
	return form && typeof form === 'object' ? form : null;
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
	void goto(resolve(`${pathname}${query ? `?${query}` : ''}` as Pathname), {
		invalidateAll: true,
		keepFocus: true,
		replaceState: true
	});
}

function scheduleFilters(pathname: string, form: HTMLFormElement): void {
	cancelPendingNavigation(form);
	const pending = setTimeout(() => {
		pendingNavigations.delete(form);
		if (form.isConnected === false) return;
		navigate(pathname, form);
	}, 350);
	pendingNavigations.set(form, pending);
}

export function createFilterHandlers(pathname: string): FilterHandlers {
	const composingForms = new WeakSet<HTMLFormElement>();

	return {
		oninput: (event) => {
			const form = getForm(event);
			if (!form || composingForms.has(form)) return;
			scheduleFilters(pathname, form);
		},
		onchange: (event) => {
			const form = getForm(event);
			if (!form || composingForms.has(form)) return;
			cancelPendingNavigation(form);
			navigate(pathname, form);
		},
		oncompositionstart: (event) => {
			const form = getForm(event);
			if (!form) return;
			cancelPendingNavigation(form);
			composingForms.add(form);
		},
		oncompositionend: (event) => {
			const form = getForm(event);
			if (!form) return;
			composingForms.delete(form);
			scheduleFilters(pathname, form);
		}
	};
}
