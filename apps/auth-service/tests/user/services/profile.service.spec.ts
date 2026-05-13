// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));

jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });

jest.mock('../../../src/modules/user/repositories/user-admin.repository', () => ({
  UserAdminRepository: jest.fn(),
}));

jest.mock('../../../src/modules/user/user/dtos/update-profile.dto', () => ({
  UpdateProfileDto: jest.fn(),
}));

jest.mock('../../../src/modules/user/user/dtos/change-password.dto', () => ({
  ChangePasswordDto: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProfileService } from '../../../src/modules/user/user/services/profile.service';
import * as bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockUserRepo = {
  findById: jest.fn(),
  findByIdWithPassword: jest.fn(),
  updateWithProfile: jest.fn(),
  update: jest.fn(),
};

const mockConfig = {
  get: jest.fn(),
};

function createService(): ProfileService {
  return new ProfileService(mockUserRepo as any, mockConfig as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createService();
  });

  // -----------------------------------------------------------------------
  // getProfile
  // -----------------------------------------------------------------------
  describe('getProfile', () => {
    it('should return the user when found', async () => {
      const user = { id: 1n, name: 'Alice' };
      mockUserRepo.findById.mockResolvedValue(user);

      const result = await service.getProfile(1n);

      expect(mockUserRepo.findById).toHaveBeenCalledWith(1n);
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(service.getProfile(1n)).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // updateProfile
  // -----------------------------------------------------------------------
  describe('updateProfile', () => {
    it('should update user data and profile data', async () => {
      const existingUser = { id: 1n, name: 'Alice' };
      const updatedUser = { id: 1n, name: 'Bob', image: 'img.png' };

      // First call: getProfile check; second call: return updated user
      mockUserRepo.findById
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(updatedUser);
      mockUserRepo.updateWithProfile.mockResolvedValue(undefined);

      const dto = {
        name: 'Bob',
        image: 'img.png',
        birthday: '2000-01-01',
        gender: 'male',
        address: '123 Street',
        countryId: 1,
        provinceId: 2,
        wardId: 3,
        about: 'Hello',
      };

      const result = await service.updateProfile(1n, dto as any);

      expect(mockUserRepo.updateWithProfile).toHaveBeenCalledWith(
        1n,
        { name: 'Bob', image: 'img.png' },
        {
          birthday: '2000-01-01',
          gender: 'male',
          address: '123 Street',
          countryId: 1,
          provinceId: 2,
          wardId: 3,
          about: 'Hello',
        },
      );
      expect(result).toEqual(updatedUser);
    });

    it('should only update provided fields', async () => {
      const user = { id: 1n, name: 'Alice' };
      const updatedUser = { id: 1n, name: 'Bob' };

      mockUserRepo.findById
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(updatedUser);
      mockUserRepo.updateWithProfile.mockResolvedValue(undefined);

      const dto = { name: 'Bob' };

      const result = await service.updateProfile(1n, dto as any);

      expect(mockUserRepo.updateWithProfile).toHaveBeenCalledWith(
        1n,
        { name: 'Bob' },
        {},
      );
      expect(result).toEqual(updatedUser);
    });
  });

  // -----------------------------------------------------------------------
  // changePassword
  // -----------------------------------------------------------------------
  describe('changePassword', () => {
    it('should succeed with correct old password', async () => {
      const user = { id: 1n, password: 'hashed_old' };
      mockUserRepo.findByIdWithPassword.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_new');
      mockConfig.get.mockReturnValue('10');
      mockUserRepo.update.mockResolvedValue(undefined);

      const dto = { old_password: 'old123', password: 'new456' };

      const result = await service.changePassword(1n, dto as any);

      expect(bcrypt.compare).toHaveBeenCalledWith('old123', 'hashed_old');
      expect(bcrypt.hash).toHaveBeenCalledWith('new456', 10);
      expect(mockUserRepo.update).toHaveBeenCalledWith(1n, { password: 'hashed_new' });
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.findByIdWithPassword.mockResolvedValue(null);

      const dto = { old_password: 'old123', password: 'new456' };

      await expect(service.changePassword(1n, dto as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for social login accounts (no password)', async () => {
      const user = { id: 1n, password: null };
      mockUserRepo.findByIdWithPassword.mockResolvedValue(user);

      const dto = { old_password: 'old123', password: 'new456' };

      await expect(service.changePassword(1n, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when old password is wrong', async () => {
      const user = { id: 1n, password: 'hashed_old' };
      mockUserRepo.findByIdWithPassword.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const dto = { old_password: 'wrong', password: 'new456' };

      await expect(service.changePassword(1n, dto as any)).rejects.toThrow(BadRequestException);
    });
  });
});
