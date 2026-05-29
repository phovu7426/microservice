import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { sanitize, Config } from 'isomorphic-dompurify';

const PURIFY_OPTIONS: Config = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

@Injectable()
export class SanitizeHtmlPipe implements PipeTransform {
  transform(value: any, _metadata: ArgumentMetadata) {
    if (typeof value === 'string') return this.clean(value);
    if (typeof value === 'object' && value !== null) return this.sanitizeObject(value);
    return value;
  }

  private clean(input: string): string {
    return sanitize(input, PURIFY_OPTIONS) as string;
  }

  private sanitizeObject(obj: any): any {
    const result: any = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string') result[key] = this.clean(val);
      else if (typeof val === 'object' && val !== null) result[key] = this.sanitizeObject(val);
      else result[key] = val;
    }
    return result;
  }
}
