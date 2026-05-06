import 'dotenv/config';
import { initTracing } from '@package/tracing';

initTracing(process.env.SERVICE_NAME ?? 'notification-service');

import { NotificationAppModule } from './app.module';
import { createApp } from '@package/bootstrap';

const SERVICE_NAME = process.env.SERVICE_NAME ?? 'Notification Service';

createApp({
  serviceName: SERVICE_NAME,
  defaultPort: parseInt(process.env.PORT ?? '3004', 10),
  module: NotificationAppModule,
}).catch((err) => {
  console.error(`${SERVICE_NAME} failed to start`, err);
  process.exit(1);
});
