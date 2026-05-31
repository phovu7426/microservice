export { KafkaClientModule } from './kafka-client.module';
export { KafkaProducerService } from './kafka-producer.service';
export { createKafkaInstance } from './kafka-factory';
export type { KafkaInstanceOptions } from './kafka-factory';
export type { Consumer, Producer, EachMessagePayload } from 'kafkajs';
