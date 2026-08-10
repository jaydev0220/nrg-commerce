import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { tick } from 'svelte';

import type { DashboardData } from '$lib/api/admin-api';
import SalesTrendChart from './SalesTrendChart.svelte';
import '../../../routes/layout.css';

const firstBucket = new Date('2026-07-19T16:00:00.000Z');
const secondBucket = new Date('2026-07-20T16:00:00.000Z');

function createTrend(
	options: {
		missingBusinessValue?: boolean;
		overlappingFirstBucket?: boolean;
	} = {}
): DashboardData['trend'] {
	const firstBusinessValue = options.overlappingFirstBucket ? 1200 : 800;
	const firstConsumerValue = options.overlappingFirstBucket ? 1200 : 400;
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
				points: options.missingBusinessValue
					? []
					: [
							{ startAt: firstBucket, label: '7/20', value: firstBusinessValue },
							{ startAt: secondBucket, label: '7/21', value: 1400 }
						]
			},
			{
				key: 'consumer',
				points: [
					{ startAt: firstBucket, label: '7/20', value: firstConsumerValue },
					{ startAt: secondBucket, label: '7/21', value: 1000 }
				]
			}
		]
	};
}

function bucketTargets(container: Element): SVGRectElement[] {
	return Array.from(container.querySelectorAll<SVGRectElement>('[data-bucket-index]'));
}

function dispatchPointerEvent(
	element: Element,
	type: 'pointerenter' | 'pointerdown' | 'pointerleave',
	pointerType = 'mouse'
): void {
	element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType }));
}

function selectedValues(container: Element): Array<string | undefined> {
	return Array.from(container.querySelectorAll('dd'), (value) => value.textContent?.trim());
}

describe('sales trend chart', () => {
	it('uses one timestamp region and shows grouped values on pointer interaction', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend() });
		const targets = bucketTargets(screen.container);

		expect(targets).toHaveLength(2);
		expect(screen.container.querySelector('[data-trend-card]')).toBeNull();

		dispatchPointerEvent(targets[0] as SVGRectElement, 'pointerenter');
		const details = screen.getByRole('region', { name: '所選銷售趨勢' });
		await expect.element(details).toHaveTextContent('全部銷售');
		await expect.element(details).toHaveTextContent('$1,200');
		await expect.element(details).toHaveTextContent('企業客戶');
		await expect.element(details).toHaveTextContent('$800');
		await expect.element(details).toHaveTextContent('一般消費者');
		await expect.element(details).toHaveTextContent('$400');
	});

	it('supports roving keyboard focus between timestamp regions', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend() });
		const targets = bucketTargets(screen.container);
		const latestTarget = targets[1];

		expect(latestTarget?.getAttribute('tabindex')).toBe('0');
		latestTarget?.focus();
		latestTarget?.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
		);

		await expect
			.element(screen.getByRole('region', { name: '所選銷售趨勢' }))
			.toHaveTextContent('$1,200');
		expect(document.activeElement).toBe(targets[0]);
		expect(targets[0]?.getAttribute('aria-describedby')).toBe('sales-trend-details');
	});

	it('keeps a touch selection until the next outside interaction', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend() });
		const firstTarget = bucketTargets(screen.container)[0];

		dispatchPointerEvent(firstTarget as SVGRectElement, 'pointerdown', 'touch');

		await expect
			.element(screen.getByRole('region', { name: '所選銷售趨勢' }))
			.toHaveTextContent('7/20');
		expect(firstTarget?.getAttribute('aria-pressed')).toBe('true');

		document.body.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })
		);
		await tick();
		expect(screen.container.querySelector('[data-trend-card]')).toBeNull();
	});

	it('hides pointer details when the cursor leaves the graph', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend() });
		const firstTarget = bucketTargets(screen.container)[0];
		dispatchPointerEvent(firstTarget as SVGRectElement, 'pointerenter');
		await tick();
		expect(screen.container.querySelector('[data-trend-card]')).not.toBeNull();

		const graph = screen.container.querySelector('.relative.min-w-240');
		dispatchPointerEvent(graph as Element, 'pointerleave');
		await tick();
		expect(screen.container.querySelector('[data-trend-card]')).toBeNull();
	});

	it('shows missing values without treating them as zero', async () => {
		const screen = await render(SalesTrendChart, {
			trend: createTrend({ missingBusinessValue: true })
		});
		const firstTarget = bucketTargets(screen.container)[0];

		expect(firstTarget?.getAttribute('aria-label')).toContain('企業客戶 無資料');
		dispatchPointerEvent(firstTarget as SVGRectElement, 'pointerenter');
		await tick();

		expect(selectedValues(screen.container)).toEqual(['$1,200', '—', '$400']);
	});

	it('groups fully overlapping series without competing hit targets', async () => {
		const screen = await render(SalesTrendChart, {
			trend: createTrend({ overlappingFirstBucket: true })
		});
		const firstTarget = bucketTargets(screen.container)[0];

		dispatchPointerEvent(firstTarget as SVGRectElement, 'pointerenter');
		await tick();

		expect(selectedValues(screen.container)).toEqual(['$1,200', '$1,200', '$1,200']);
		expect(screen.container.querySelectorAll('[data-active-coordinate]')).toHaveLength(1);
		expect(
			screen.container.querySelector('[data-active-coordinate]')?.getAttribute('data-series-count')
		).toBe('3');
	});

	it('keeps every rendered dot inside its timestamp region at wide chart sizes', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend() });
		screen.container.style.width = '1200px';
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

		const targets = bucketTargets(screen.container);
		for (const [index, target] of targets.entries()) {
			const targetBounds = target.getBoundingClientRect();
			for (const key of ['total', 'business', 'consumer']) {
				const dot = screen.container.querySelector<SVGCircleElement>(
					`[data-point-key="${key}-${index}"]`
				);
				const dotBounds = dot?.getBoundingClientRect();
				expect(dotBounds).toBeDefined();
				const centerX = (dotBounds?.left ?? 0) + (dotBounds?.width ?? 0) / 2;
				const centerY = (dotBounds?.top ?? 0) + (dotBounds?.height ?? 0) / 2;
				expect(centerX).toBeGreaterThanOrEqual(targetBounds.left);
				expect(centerX).toBeLessThanOrEqual(targetBounds.right);
				expect(centerY).toBeGreaterThanOrEqual(targetBounds.top);
				expect(centerY).toBeLessThanOrEqual(targetBounds.bottom);
			}
		}
	});

	it('clamps the compact details card inside both plot edges', async () => {
		const screen = await render(SalesTrendChart, { trend: createTrend() });
		const targets = bucketTargets(screen.container);

		dispatchPointerEvent(targets[0] as SVGRectElement, 'pointerenter');
		await tick();
		const firstCard = screen.container.querySelector('foreignObject[data-trend-card]');
		expect(firstCard?.getAttribute('x')).toBe('48');

		dispatchPointerEvent(targets[1] as SVGRectElement, 'pointerenter');
		await tick();
		const lastCard = screen.container.querySelector('foreignObject[data-trend-card]');
		expect(Number(lastCard?.getAttribute('x')) + Number(lastCard?.getAttribute('width'))).toBe(928);
	});

	it('covers the full plot for one point and renders no targets for empty data', async () => {
		const onePointTrend = createTrend();
		for (const series of onePointTrend.series) series.points = series.points.slice(0, 1);
		const onePointScreen = await render(SalesTrendChart, { trend: onePointTrend });
		const target = bucketTargets(onePointScreen.container)[0];

		expect(target?.getAttribute('x')).toBe('48');
		expect(target?.getAttribute('width')).toBe('880');

		const emptyTrend = createTrend();
		for (const series of emptyTrend.series) series.points = [];
		const emptyScreen = await render(SalesTrendChart, { trend: emptyTrend });
		expect(bucketTargets(emptyScreen.container)).toHaveLength(0);
		expect(emptyScreen.container.querySelector('[aria-label="所選銷售趨勢"]')).toBeNull();
	});
});
