import { expect, test } from 'vitest';
import { variables } from '../src/env';

test('public deployment settings preserve configured values and allow an unconfigured preview', async () => {
	for (const definition of Object.values(variables)) {
		const schema = definition.schema['~standard'];
		expect(await schema.validate('https://configured.example.com')).toEqual({
			value: 'https://configured.example.com'
		});
		expect(await schema.validate(undefined)).toEqual({ value: '' });
	}
});
