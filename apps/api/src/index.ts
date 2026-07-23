import { readAppConfig } from './config/app-config.js';
import { startObservability } from './observability.js';

const config = readAppConfig();
const observability = startObservability(config);
const { startApiServer } = await import('./server.js');

startApiServer(config, {
	shutdownObservability: () => observability.shutdown()
});
