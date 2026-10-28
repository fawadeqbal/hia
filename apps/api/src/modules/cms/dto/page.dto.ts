import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { SLUG_REGEX, type PageContent, type PageInput, type PublishState } from '@ecommerce/types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Mirrors pageFormSchema; `content` is validated in the service with pageContentSchema. */
export class CreatePageDto implements PageInput {
  @ApiProperty({ example: 'About us' })
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional({ example: 'about', description: 'Generated from the title when omitted' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(140)
  @Matches(SLUG_REGEX, { message: 'slug may contain lowercase letters, numbers and hyphens only' })
  slug?: string;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  locale?: string;

  @ApiProperty({ example: { blocks: [{ type: 'paragraph', text: 'Hello' }] } })
  @IsObject()
  content: PageContent;

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED'] })
  @IsIn(['DRAFT', 'PUBLISHED'])
  status: PublishState;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string | null;
}

export class UpdatePageDto extends PartialType(CreatePageDto) {}
