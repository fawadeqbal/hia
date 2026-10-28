import { Injectable, NotFoundException } from '@nestjs/common';
import type { Menu } from '@ecommerce/database';
import { MENU_HANDLES, MENU_LABELS, type MenuDto, type MenuHandle } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildMenuTree } from './cms-rules';
import type { SaveMenuDto } from './dto/menu.dto';

export function assertHandle(handle: string): MenuHandle {
  if (!(MENU_HANDLES as readonly string[]).includes(handle))
    throw new NotFoundException('Menu not found');
  return handle as MenuHandle;
}

/** Header and footer menus. Saving replaces all items in one transaction. */
@Injectable()
export class MenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<MenuDto[]> {
    return Promise.all(MENU_HANDLES.map((h) => this.get(h)));
  }

  async get(handleParam: string): Promise<MenuDto> {
    const handle = assertHandle(handleParam);
    const menu = await this.ensure(handle);
    const rows = await this.prisma.menuItem.findMany({ where: { menuId: menu.id } });
    return { id: menu.id, name: menu.name, handle, items: buildMenuTree(rows) };
  }

  async save(handleParam: string, dto: SaveMenuDto, actorId?: string): Promise<MenuDto> {
    const handle = assertHandle(handleParam);
    const menu = await this.ensure(handle);
    const before = await this.get(handle);

    await this.prisma.$transaction(async (tx) => {
      await tx.menuItem.deleteMany({ where: { menuId: menu.id, parentId: { not: null } } });
      await tx.menuItem.deleteMany({ where: { menuId: menu.id } });
      for (const [i, item] of dto.items.entries()) {
        const parent = await tx.menuItem.create({
          data: { menuId: menu.id, label: item.label, url: item.url, position: i },
        });
        for (const [j, child] of (item.children ?? []).entries()) {
          await tx.menuItem.create({
            data: {
              menuId: menu.id,
              parentId: parent.id,
              label: child.label,
              url: child.url,
              position: j,
            },
          });
        }
      }
    });

    const after = await this.get(handle);
    await this.audit.log({
      actorId,
      action: 'cms.menu.save',
      entityType: 'Menu',
      entityId: menu.id,
      before,
      after,
    });
    return after;
  }

  private async ensure(handle: MenuHandle): Promise<Menu> {
    return this.prisma.menu.upsert({
      where: { handle },
      update: {},
      create: { handle, name: MENU_LABELS[handle].name },
    });
  }
}
