import { Controller, DynamicModule, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { Public } from '../decorators/permission.decorator';
import { commonMsg } from '../i18n/common-messages';

export interface EnumItem {
  id: string;
  name: string;
}

/**
 * EnumModule.register({
 *   path: 'admin/menus/enums',
 *   enums: {
 *     types:    [{ id: 'route', name: 'Route' }, ...],
 *     statuses: [{ id: 'active', name: 'Hoạt động' }, ...],
 *   },
 * })
 *
 * Tự sinh ra:
 *   GET /<path>/:key  →  @Public()  trả [{ id, name }]
 */
export class EnumModule {
  static register(options: {
    path: string;
    enums: Record<string, EnumItem[]>;
  }): DynamicModule {
    const map = options.enums;

    @Public()
    @Controller(options.path)
    class GeneratedEnumController {
      @Get(':key')
      get(@Param('key') key: string) {
        const data = map[key];
        if (!data) {
          const lang = I18nContext.current()?.lang ?? 'vi';
          throw new NotFoundException(commonMsg(lang, 'ENUM_NOT_FOUND', { key }));
        }
        return data;
      }
    }

    @Module({ controllers: [GeneratedEnumController] })
    class GeneratedEnumModule {}

    return {
      module: GeneratedEnumModule,
    };
  }
}
