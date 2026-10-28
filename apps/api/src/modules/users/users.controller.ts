import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AddressDto } from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.usersService.me(userId);
  }

  @Get('me/addresses')
  addresses(@CurrentUser('sub') userId: string): Promise<AddressDto[]> {
    return this.usersService.addresses(userId);
  }

  @Post('me/addresses')
  createAddress(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressDto> {
    return this.usersService.createAddress(userId, dto);
  }

  @Patch('me/addresses/:id')
  updateAddress(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressDto> {
    return this.usersService.updateAddress(userId, id, dto);
  }

  @Delete('me/addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAddress(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    return this.usersService.deleteAddress(userId, id);
  }
}
