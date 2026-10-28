import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ATTRIBUTE_TYPES,
  HEX_COLOR_REGEX,
  SLUG_REGEX,
  type AttributeInput,
  type AttributeType,
  type AttributeValueInput,
} from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AttributeValueInputDto implements AttributeValueInput {
  @ApiPropertyOptional({ description: 'Existing value id (update); omit to create' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'space-gray' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @Matches(SLUG_REGEX, { message: 'value may contain lowercase letters, numbers and hyphens only' })
  value: string;

  @ApiPropertyOptional({ example: 'Space Gray', nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  label?: string | null;

  @ApiPropertyOptional({ example: '#4b5563', nullable: true })
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'swatch must be a #RRGGBB colour' })
  swatch?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

/** Mirrors attributeFormSchema in @ecommerce/types (used by the admin form). */
export class CreateAttributeDto implements AttributeInput {
  @ApiProperty({ example: 'Color' })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiPropertyOptional({ example: 'color', description: 'Generated from name when omitted' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(140)
  @Matches(SLUG_REGEX, { message: 'code may contain lowercase letters, numbers and hyphens only' })
  code?: string;

  @ApiPropertyOptional({ enum: ATTRIBUTE_TYPES, default: 'select' })
  @IsOptional()
  @IsIn(ATTRIBUTE_TYPES)
  type?: AttributeType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    type: [AttributeValueInputDto],
    description: 'On update: the full desired list',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AttributeValueInputDto)
  values?: AttributeValueInputDto[];
}

export class UpdateAttributeDto extends PartialType(CreateAttributeDto) {}
