import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { LINK_REGEX, MAX_MENU_ITEMS, type MenuInput, type MenuItemInput } from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class MenuLinkDto {
  @ApiProperty({ example: 'About' })
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  label: string;

  @ApiProperty({ example: '/pages/about' })
  @Transform(trim)
  @Matches(LINK_REGEX, { message: 'url must be a path like /pages/about or an http(s) URL' })
  url: string;
}

export class MenuItemDto extends MenuLinkDto implements MenuItemInput {
  @ApiPropertyOptional({ type: [MenuLinkDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MENU_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => MenuLinkDto)
  children?: MenuLinkDto[];
}

/** Mirrors menuFormSchema. The whole menu is replaced on save. */
export class SaveMenuDto implements MenuInput {
  @ApiProperty({ type: [MenuItemDto] })
  @IsArray()
  @ArrayMaxSize(MAX_MENU_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  items: MenuItemDto[];
}
