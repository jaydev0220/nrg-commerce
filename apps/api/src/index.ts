import { createApp } from './app.js';
import { readAppConfig } from './config/app-config.js';

const config = readAppConfig();
const app = createApp({ config });

app.listen(config.port, () => {
	process.stdout.write(`@apps/api listening on port ${config.port}\n`);
});
