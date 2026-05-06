import { PrismaClient } from '../../../src/generated/prisma';
import followersData from '../data/comic-followers.json';

interface FollowerEntry {
  user_id: number;
  comic_id: number;
}

export async function seedComicFollowers(prisma: PrismaClient) {
  const existing = await prisma.comicFollowersProjection.count();
  if (existing > 0) {
    console.log(`  ⏭ ${existing} comic followers already exist, skipping`);
    return;
  }

  const followers = followersData as FollowerEntry[];

  for (const f of followers) {
    await prisma.comicFollowersProjection.create({
      data: {
        user_id: BigInt(f.user_id),
        comic_id: BigInt(f.comic_id),
      },
    });
    console.log(`  ✔ Follow: user ${f.user_id} → comic ${f.comic_id}`);
  }
}
