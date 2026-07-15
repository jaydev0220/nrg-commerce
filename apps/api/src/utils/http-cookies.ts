import { parse } from 'cookie';
import type { Request } from 'express';

export function readCookie(request: Request, name: string): string | null {
	const value = parse(request.get('cookie') ?? '')[name];
	return value?.trim() || null;
}
