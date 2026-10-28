import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  MAX_BLOG_TAGS,
  SLUG_REGEX,
  type BlogCategoryInput,
  type BlogPostInput,
  type BlogPostQuery,
  type PageContent,
  type PublishState,
} from '@ecommerce/types';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const slugRule = Matches(SLUG_REGEX, {
  message: 'slug may contain lowercase letters, numbers and hyphens only',
});

/** Mirrors blogPostFormSchema; content is validated with pageContentSchema in the service. */
export class CreateBlogPostDto implements BlogPostInput {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 200) title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(140)
  @slugRule
  slug?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(300) excerpt?:
    | string
    | null;

  @ApiProperty() @IsObject() content: PageContent;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() categoryId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BLOG_TAGS)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  coverImageUrl?: string | null;

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED'] }) @IsIn(['DRAFT', 'PUBLISHED']) status: PublishState;

  @ApiPropertyOptional({ nullable: true, description: 'Future date = scheduled' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(70) seoTitle?:
    | string
    | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string | null;
}

export class UpdateBlogPostDto extends PartialType(CreateBlogPostDto) {}

export class CreateBlogCategoryDto implements BlogCategoryInput {
  @ApiProperty({ example: 'Buying guides' })
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(140)
  @slugRule
  slug?: string;
}

export class UpdateBlogCategoryDto extends PartialType(CreateBlogCategoryDto) {}

export class BlogQueryDto extends PaginationQueryDto implements BlogPostQuery {
  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  category?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) tag?: string;
}
