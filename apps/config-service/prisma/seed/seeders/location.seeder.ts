import { PrismaClient } from '../../../src/generated/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

const countriesData = JSON.parse(
  readFileSync(join(__dirname, '../data/address/countries.json'), 'utf-8'),
);
const provincesData = JSON.parse(
  readFileSync(join(__dirname, '../data/address/provinces.json'), 'utf-8'),
);
const wardsData = JSON.parse(
  readFileSync(join(__dirname, '../data/address/wards.json'), 'utf-8'),
);

interface CountryEntry {
  code: string;
  code_alpha3?: string;
  name: string;
  official_name?: string;
  phone_code?: string;
  currency_code?: string;
  flag_emoji?: string;
  status?: string;
}

interface ProvinceEntry {
  id: number;
  code: string;
  name: string;
  type: string;
  phone_code?: string;
  country_id: number;
  status?: string;
  note?: string;
  code_bnv?: string | number;
  code_tms?: string | number;
}

interface WardEntry {
  id: number;
  province_id: number;
  name: string;
  type: string;
  code: string;
}

export async function seedCountries(prisma: PrismaClient): Promise<Map<string, bigint>> {
  const codeToId = new Map<string, bigint>();
  const countries = countriesData as CountryEntry[];

  for (const c of countries) {
    const existing = await prisma.country.findUnique({ where: { code: c.code } });
    if (existing) {
      codeToId.set(c.code, existing.id);
      continue;
    }

    const created = await prisma.country.create({
      data: {
        code: c.code,
        codeAlpha3: c.code_alpha3 ?? null,
        name: c.name,
        officialName: c.official_name ?? null,
        phoneCode: c.phone_code ?? null,
        currencyCode: c.currency_code ?? null,
        flagEmoji: c.flag_emoji ?? null,
        status: c.status ?? 'active',
      },
    });
    codeToId.set(c.code, created.id);
    console.log(`  ✔ Country: ${c.name} (${c.code})`);
  }

  return codeToId;
}

export async function seedProvinces(prisma: PrismaClient, countryMap: Map<string, bigint>): Promise<Map<number, bigint>> {
  const idMap = new Map<number, bigint>();
  const provinces = provincesData as ProvinceEntry[];
  const vnId = countryMap.get('VN');
  if (!vnId) return idMap;

  for (const p of provinces) {
    const existing = await prisma.province.findUnique({ where: { code: p.code } });
    if (existing) {
      idMap.set(p.id, existing.id);
      continue;
    }

    const created = await prisma.province.create({
      data: {
        code: p.code,
        name: p.name,
        type: p.type,
        phoneCode: p.phone_code ?? null,
        countryId: vnId,
        status: p.status ?? 'active',
        note: p.note ?? null,
        codeBnv: p.code_bnv?.toString() ?? null,
        codeTms: p.code_tms?.toString() ?? null,
      },
    });
    idMap.set(p.id, created.id);
    console.log(`  ✔ Province: ${p.name} (${p.code})`);
  }

  return idMap;
}

export async function seedWards(prisma: PrismaClient, provinceMap: Map<number, bigint>) {
  const wards = wardsData as WardEntry[];
  let count = 0;

  for (const w of wards) {
    const provinceId = provinceMap.get(w.province_id);
    if (!provinceId) continue;

    const existing = await prisma.ward.findFirst({
      where: { code: w.code, provinceId: provinceId },
    });
    if (existing) continue;

    await prisma.ward.create({
      data: {
        code: w.code,
        name: w.name,
        type: w.type,
        provinceId: provinceId,
        status: 'active',
      },
    });
    count++;
  }

  console.log(`  ✔ Wards seeded: ${count}`);
}

export async function seedLocation(prisma: PrismaClient) {
  console.log('  Seeding countries...');
  const countryMap = await seedCountries(prisma);
  console.log(`  Total: ${countryMap.size} countries`);

  console.log('  Seeding provinces...');
  const provinceMap = await seedProvinces(prisma, countryMap);
  console.log(`  Total: ${provinceMap.size} provinces`);

  console.log('  Seeding wards...');
  await seedWards(prisma, provinceMap);
}
