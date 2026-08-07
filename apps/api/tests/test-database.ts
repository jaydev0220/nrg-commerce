const databaseUrl = process.env['TEST_DATABASE_URL'];

if (process.env['CI'] === 'true' && !databaseUrl) {
	throw new Error('TEST_DATABASE_URL must be configured when CI=true.');
}

export { databaseUrl };

export const databaseTestOptions = {
	skip: databaseUrl ? false : 'TEST_DATABASE_URL is not configured.'
};
