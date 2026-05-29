import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RabbitmqProducerService } from '../src/rabbitmq-producer.service';

function makeService() {
  const amqp = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as AmqpConnection;
  const service = new RabbitmqProducerService(amqp);
  return { service, amqp: amqp as unknown as { publish: jest.Mock } };
}

describe('RabbitmqProducerService', () => {
  it('publishes to events exchange with routing key = topic', async () => {
    const { service, amqp } = makeService();
    await service.send({
      topic: 'comic.chapter.published',
      messages: [{ value: JSON.stringify({ comic_id: '1' }) }],
    });
    expect(amqp.publish).toHaveBeenCalledWith(
      'events',
      'comic.chapter.published',
      { comic_id: '1' },
      expect.objectContaining({ persistent: true }),
    );
  });

  it('publishes each message in a batch separately', async () => {
    const { service, amqp } = makeService();
    await service.send({
      topic: 'user.registered',
      messages: [
        { value: JSON.stringify({ user_id: '1' }) },
        { value: JSON.stringify({ user_id: '2' }) },
      ],
    });
    expect(amqp.publish).toHaveBeenCalledTimes(2);
    expect(amqp.publish).toHaveBeenNthCalledWith(1, 'events', 'user.registered', { user_id: '1' }, expect.any(Object));
    expect(amqp.publish).toHaveBeenNthCalledWith(2, 'events', 'user.registered', { user_id: '2' }, expect.any(Object));
  });

  it('throws if value is not valid JSON', async () => {
    const { service, amqp } = makeService();
    await expect(
      service.send({ topic: 'foo', messages: [{ value: 'not-json' }] }),
    ).rejects.toThrow();
    expect(amqp.publish).not.toHaveBeenCalled();
  });

  it('isEnabled returns true', () => {
    const { service } = makeService();
    expect(service.isEnabled()).toBe(true);
  });

  it('passes headers to amqp.publish', async () => {
    const { service, amqp } = makeService();
    await service.send({
      topic: 'mail.send',
      messages: [{ value: JSON.stringify({ to: 'a@b.com' }), headers: { 'event-id': '99' } }],
    });
    expect(amqp.publish).toHaveBeenCalledWith(
      'events', 'mail.send', { to: 'a@b.com' },
      expect.objectContaining({ headers: { 'event-id': '99' } }),
    );
  });
});
