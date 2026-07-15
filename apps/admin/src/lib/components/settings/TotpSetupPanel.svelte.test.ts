import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';

import TotpSetupPanel from './TotpSetupPanel.svelte';
import '../../../routes/layout.css';

const setup = {
	secret: 'JBSWY3DPEHPK3PXP',
	otpauthUrl:
		'otpauth://totp/NRG%20Commerce:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=NRG%20Commerce',
	digits: 6,
	period: 30
};

describe('TOTP setup panel', () => {
	it('shows a QR code, keeps the manual secret collapsed, and enables code autofill', async () => {
		const screen = await render(TotpSetupPanel, {
			setup,
			busy: false,
			onconfirm: vi.fn(),
			showCancel: false
		});

		await expect.element(screen.getByRole('img', { name: '驗證器設定 QR Code' })).toBeVisible();
		const details = screen.container.querySelector('details');
		expect(details?.open).toBe(false);
		await expect.element(screen.getByText(setup.secret)).not.toBeVisible();
		await expect
			.element(screen.getByRole('textbox', { name: '驗證碼' }))
			.toHaveAttribute('autocomplete', 'one-time-code');
		expect(screen.container.textContent).not.toContain('取消');
	});

	it('requires explicit confirmation after a valid autofilled code', async () => {
		const onconfirm = vi.fn();
		const screen = await render(TotpSetupPanel, {
			setup,
			busy: false,
			onconfirm,
			showCancel: false
		});
		const input = screen.getByRole('textbox', { name: '驗證碼' });

		await input.fill('123456');
		expect(onconfirm).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: '完成設定' }).click();
		expect(onconfirm).toHaveBeenCalledOnce();
		expect(onconfirm).toHaveBeenCalledWith('123456');
	});
});
