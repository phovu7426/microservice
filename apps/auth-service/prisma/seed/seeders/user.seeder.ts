import { PrismaClient } from '../../../src/generated/prisma';
import * as bcrypt from 'bcryptjs';
import usersData from '../data/users.json';

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Password@123';

interface UserEntry {
  username: string;
  email: string;
  phone: string;
  name: string;
  status: string;
  image: string;
  profile: {
    birthday: string;
    gender: string;
    address: string;
    about: string;
  };
}

export async function seedUsers(prisma: PrismaClient) {
  const users = usersData as UserEntry[];
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  const now = new Date();

  console.log(`  Seeding ${users.length} users with password: ${DEFAULT_PASSWORD}`);

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`  ⏭ ${u.username} (${u.email}) already exists, skipping`);
      continue;
    }

    await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        phone: u.phone,
        password: hashedPassword,
        name: u.name,
        status: u.status,
        image: u.image,
        email_verified_at: u.status === 'active' ? now : null,
        last_login_at: u.status === 'active' ? now : null,
        profile: {
          create: {
            birthday: new Date(u.profile.birthday),
            gender: u.profile.gender,
            address: u.profile.address,
            about: u.profile.about,
          },
        },
      },
    });

    console.log(`  ✔ ${u.username} (${u.email}) — ${u.status}`);
  }
}
