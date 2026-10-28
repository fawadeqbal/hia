import { Injectable, NotFoundException } from '@nestjs/common';
import type { Address } from '@ecommerce/database';
import type { AddressDto } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

/**
 * UsersService — profile and saved addresses.
 * TODO: update profile, change password, account deletion request, email preferences.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        passwordHash: true,
        googleId: true,
        roles: { select: { role: { select: { name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, googleId, ...rest } = user;
    return {
      ...rest,
      roles: user.roles.map((r) => r.role.name),
      hasPassword: passwordHash !== null,
      googleLinked: googleId !== null,
    };
  }

  // ---------------------------------------------------------------- addresses

  async addresses(userId: string): Promise<AddressDto[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toAddressDto);
  }

  async createAddress(userId: string, dto: CreateAddressDto): Promise<AddressDto> {
    const count = await this.prisma.address.count({ where: { userId } });
    const isDefault = dto.isDefault ?? count === 0; // first address becomes the default
    const created = await this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...dto, userId, isDefault, label: dto.label ?? null } });
    });
    return toAddressDto(created);
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto): Promise<AddressDto> {
    await this.ownAddress(userId, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault)
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: dto });
    });
    return toAddressDto(updated);
  }

  async deleteAddress(userId: string, id: string): Promise<void> {
    const address = await this.ownAddress(userId, id);
    await this.prisma.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (next)
        await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  async ownAddress(userId: string, id: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }
}

export function toAddressDto(a: Address): AddressDto {
  return {
    id: a.id,
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    countryCode: a.countryCode,
    isDefault: a.isDefault,
  };
}
