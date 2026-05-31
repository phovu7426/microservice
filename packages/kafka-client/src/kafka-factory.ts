import { Kafka } from 'kafkajs';
import { KafkaSslOptions } from './kafka-client.module';

export interface KafkaInstanceOptions {
  clientId: string;
  brokers: string[];
  ssl?: KafkaSslOptions;
  retry?: { retries?: number; initialRetryTime?: number; maxRetryTime?: number };
}

export function createKafkaInstance(options: KafkaInstanceOptions): Kafka {
  const { clientId, brokers, ssl, retry } = options;
  return new Kafka({
    clientId,
    brokers,
    ...(retry ? { retry } : {}),
    ...(ssl ? {
      ssl: {
        rejectUnauthorized: ssl.rejectUnauthorized,
        ca: [ssl.ca],
        cert: ssl.cert,
        key: ssl.key,
      },
    } : {}),
  });
}
