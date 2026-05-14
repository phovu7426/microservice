jest.mock('../../src/session/session-context.storage', () => ({
  session: jest.fn(),
}));

import { session } from '../../src/session/session-context.storage';
import { getSessionGroupId } from '../../src/session/group-filter.helper';

const mockSession = session as jest.MockedFunction<typeof session>;

describe('getSessionGroupId', () => {
  afterEach(() => jest.clearAllMocks());

  it('retorna null quando não há sessão ativa', () => {
    mockSession.mockReturnValue(undefined);
    expect(getSessionGroupId()).toBeNull();
  });

  it('retorna null quando isSystemContext = true (sem header)', () => {
    mockSession.mockReturnValue({ isSystemContext: true, groupId: null } as any);
    expect(getSessionGroupId()).toBeNull();
  });

  it('retorna groupId quando há group context', () => {
    mockSession.mockReturnValue({ isSystemContext: false, groupId: 5n } as any);
    expect(getSessionGroupId()).toBe(5n);
  });
});
