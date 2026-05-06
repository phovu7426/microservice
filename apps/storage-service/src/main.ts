import 'dotenv/config';
import { initTracing } from '@package/tracing';

initTracing(process.env.SERVICE_NAME ?? 'storage-service');

import { StorageAppModule } from './app.module';
import { createApp } from '@package/bootstrap';

const SERVICE_NAME = process.env.SERVICE_NAME ?? 'Storage Service';

createApp({
  serviceName: SERVICE_NAME,
  defaultPort: parseInt(process.env.PORT ?? '3003', 10),
  module: StorageAppModule,
}).catch((err) => {
  console.error(`${SERVICE_NAME} failed to start`, err);
  process.exit(1);
});
