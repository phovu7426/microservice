export class SlugHelper {
  static slugify(text: string): string {
    return text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static async uniqueSlug(
    text: string,
    repo: { findOne?(filter: any): Promise<any>; findFirst?(filter: any): Promise<any> },
    excludeId?: any,
  ): Promise<string> {
    const base = this.slugify(text);
    let slug = base;
    let counter = 1;

    const finder = repo.findOne?.bind(repo) ?? repo.findFirst?.bind(repo);
    if (!finder) return slug;

    while (true) {
      const existing = await finder({ slug } as any);
      if (!existing) return slug;
      if (excludeId && existing.id?.toString() === excludeId?.toString()) return slug;
      slug = `${base}-${counter}`;
      counter++;
      if (counter > 100) return `${base}-${Date.now()}`;
    }
  }
}
