import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';

import type { DashboardData } from '$lib/api/admin-api';
import SalesTrendChart from './SalesTrendChart.svelte';
import '../../../routes/layout.css';

const firstBucket = new Date('2026-07-19T16:00:00.000Z');
const secondBucket = new Date('2026-07-20T16:00:00.000Z');

function createTrend(missingBusinessValue = false): DashboardData['trend'] {
	return {
		range: 'days',
		series: [
			{
				key: 'total',
				points: [
					{ startAt: firstBucket, label: '7/20', value: 1200 },
					{ startAt: secondBucket, label: '7/21', value: 2400 }
				]
			},
			{
				key: 'business',
				points: missingBusinessValue
					? []
					: [
							{ startAt: firstBucket, label: '7/20', value: 800 },
							{ startAt: secondBucket, label: '7/21', value: 1400 }
						]
			},
			{
				key: 'consumer',
				points: [
					{ startAt: firstBucket, label: '7/20', value: 400 },
					{ startAt: secondBucket, label: '7/21', value: 1000 }
				]
			}
		]
	};
}

function dispatchMouseEvent(element: Element, type: 'mouseenter' | 'mouseleave'): void {
	element.dispatchEvent(new MouseEvent(type));
}

describe('sales trend chart', () => {
	it('shows all three metrics when any series dot is hovered', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend() });
		const firstBucketTargets = Array.from(
			screen.container.querySelectorAll<HTMLButtonElement>('button[aria-label^="7/20"]')
		);

		expect(firstBucketTargets).toHaveLength(3);
		for (const target of firstBucketTargets) {
			dispatchMouseEvent(target, 'mouseenter');

			const tooltip = screen.getByRole('tooltip');
			await expect.element(tooltip).toHaveTextContent('全部銷售');
			await expect.element(tooltip).toHaveTextContent('$1,200');
			await expect.element(tooltip).toHaveTextContent('企業客戶');
			await expect.element(tooltip).toHaveTextContent('$800');
			await expect.element(tooltip).toHaveTextContent('一般消費者');
			await expect.element(tooltip).toHaveTextContent('$400');

			dispatchMouseEvent(target, 'mouseleave');
			await expect.element(tooltip).not.toBeInTheDocument();
		}
	});

	it('shows the grouped values for keyboard focus', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend() });
		const target = screen.container.querySelector<HTMLButtonElement>('button[aria-label^="7/20"]');

		expect(target).not.toBeNull();
		target?.focus();

		const tooltip = screen.getByRole('tooltip');
		await expect.element(tooltip).toHaveTextContent('$1,200');
		await expect.element(tooltip).toHaveTextContent('$800');
		await expect.element(tooltip).toHaveTextContent('$400');
		expect(target?.getAttribute('aria-describedby')).toBe('sales-trend-tooltip');

		target?.blur();
		await expect.element(tooltip).not.toBeInTheDocument();
	});

	it('shows missing values without treating them as zero', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend(true) });
		const target = screen.container.querySelector<HTMLButtonElement>('button[aria-label^="7/20"]');

		expect(target?.getAttribute('aria-label')).toContain('企業客戶 無資料');
		dispatchMouseEvent(target as HTMLButtonElement, 'mouseenter');
		await expect.element(screen.getByRole('tooltip')).toBeInTheDocument();

		const values = Array.from(screen.container.querySelectorAll('dd'), (value) =>
			value.textContent?.trim()
		);
		expect(values).toEqual(['$1,200', '—', '$400']);
	});

	it('keeps tooltip cards inside the first and last chart edges', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend() });
		const firstTarget = screen.container.querySelector<HTMLButtonElement>(
			'button[aria-label^="7/20"]'
		);
		const lastTarget = screen.container.querySelector<HTMLButtonElement>(
			'button[aria-label^="7/21"]'
		);

		dispatchMouseEvent(firstTarget as HTMLButtonElement, 'mouseenter');
		const tooltip = screen.getByRole('tooltip');
		await expect.element(tooltip).toHaveClass('translate-x-0');

		dispatchMouseEvent(lastTarget as HTMLButtonElement, 'mouseenter');
		await expect.element(tooltip).toHaveClass('-translate-x-full');
	});
});
