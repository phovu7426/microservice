export interface KafkaHandler {
  handle(payload: any): Promise<void>;
}
