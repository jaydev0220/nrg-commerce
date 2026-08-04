import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { getScenario } from './scenarios/index.js';

const config = loadConfig();
const scenario = getScenario(config.scenario);
const state = scenario.createState();
const app = createApp(state, config);
const server = createServer(app);

server.listen(config.port, config.host, () => {
	console.log(`NRG mock API (${scenario.name}) listening at ${config.publicOrigin}`);
});

function shutdown(): void {
	server.close((error) => {
		if (error) {
			console.error(error);
			process.exitCode = 1;
		}
	});
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
