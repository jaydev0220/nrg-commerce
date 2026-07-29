import { AppError } from '../../../errors/app-error.js';

const maxMoneyMinorUnits = 9_999_999_999n;

function toMinorUnits(value: number): bigint {
	const minorUnits = Math.round(value * 100);
	if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
		throw new AppError(
			400,
			'ORDER_AMOUNT_OUT_OF_RANGE',
			'An order amount is outside the supported range.'
		);
	}
	return BigInt(minorUnits);
}

function fromMinorUnits(value: bigint): number {
	if (value < 0n || value > maxMoneyMinorUnits) {
		throw new AppError(
			400,
			'ORDER_AMOUNT_OUT_OF_RANGE',
			'An order amount is outside the supported range.'
		);
	}
	return Number(value) / 100;
}

export function roundDiscountRate(value: number): number {
	return Math.round(value * 100) / 100;
}

export function resolveDiscountRate(
	value: number | undefined,
	suggestedRate: number | null
): number {
	const rate = value ?? suggestedRate ?? 0;
	if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
		throw new AppError(
			400,
			'INVALID_DISCOUNT_RATE',
			'The discount rate must be between 0 and 100 percent.'
		);
	}
	return roundDiscountRate(rate);
}

export function calculateOrderFinancials<T extends { unitPrice: number; quantity: number }>(
	items: T[],
	discountRate: number
) {
	const itemCalculations = items.map((item) => {
		const lineTotalMinorUnits = toMinorUnits(item.unitPrice) * BigInt(item.quantity);
		return {
			item: {
				...item,
				lineTotal: fromMinorUnits(lineTotalMinorUnits)
			},
			lineTotalMinorUnits
		};
	});
	const calculatedItems = itemCalculations.map(({ item }) => item);
	const itemCount = calculatedItems.reduce((total, item) => total + item.quantity, 0);
	const subtotalMinorUnits = itemCalculations.reduce(
		(total, item) => total + item.lineTotalMinorUnits,
		0n
	);
	const subtotalAmount = fromMinorUnits(subtotalMinorUnits);
	const discountBasisPoints = BigInt(Math.round(discountRate * 100));
	const discountMinorUnits = (subtotalMinorUnits * discountBasisPoints + 5_000n) / 10_000n;
	const discountAmount = fromMinorUnits(discountMinorUnits);
	const totalAmount = fromMinorUnits(subtotalMinorUnits - discountMinorUnits);

	return {
		items: calculatedItems,
		itemCount,
		subtotalAmount,
		discountAmount,
		totalAmount
	};
}
