import { readAppConfig } from './config/app-config.js';
import { startApiServer } from './server.js';

const config = readAppConfig();
startApiServer(config);
