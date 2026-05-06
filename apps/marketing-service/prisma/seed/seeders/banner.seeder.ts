import { PrismaClient, BannerLinkTarget } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const bannerData = JSON.parse(
  readFileSync(join(__dirname, '../data/banners.json'), 'utf-8'),
);

interface BannerEntry {
  title: string;
  subtitle?: string | null;
  image?: string | null;
  mobile_image?: string | null;
  link?: string | null;
  link_target?: string;
  description?: string | null;
  button_text?: string | null;
  button_color?: string | null;
  text_color?: string | null;
  location_code: string;
  sort_order: number;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
}

export async function seedBanners(
  prisma: PrismaClient,
  locationIdMap: Map<string, bigint>,
) {
  const banners = bannerData as BannerEntry[];

  for (const banner of banners) {
    const locationId = locationIdMap.get(banner.location_code);
    if (!locationId) {
      console.log(`  ⚠ BannerLocation not found for code: ${banner.location_code}, skipping`);
      continue;
    }

    const existing = await prisma.banner.findFirst({
      where: { title: banner.title, location_id: locationId },
    });

    if (existing) {
      console.log(`  ⏭ Banner: ${banner.title} already exists, skipping`);
      continue;
    }

    await prisma.banner.create({
      data: {
        title: banner.title,
        subtitle: banner.subtitle ?? null,
        image: banner.image ?? null,
        mobile_image: banner.mobile_image ?? null,
        link: banner.link ?? null,
        link_target: (banner.link_target as BannerLinkTarget) ?? BannerLinkTarget.SELF,
        description: banner.description ?? null,
        button_text: banner.button_text ?? null,
        button_color: banner.button_color ?? null,
        text_color: banner.text_color ?? null,
        location_id: locationId,
        sort_order: banner.sort_order,
        status: banner.status,
        start_date: banner.start_date ? new Date(banner.start_date) : null,
        end_date: banner.end_date ? new Date(banner.end_date) : null,
      },
    });

    console.log(`  ✔ Banner: ${banner.title}`);
  }

  console.log(`  ✔ Total banners seeded: ${banners.length}`);
}
