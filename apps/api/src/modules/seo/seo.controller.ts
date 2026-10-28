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
import {
  Role,
  type PublicRedirect,
  type RedirectDto,
  type RedirectImportResult,
  type SitemapDataDto,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RedirectDtoBody, RedirectImportDto } from './dto/seo.dto';
import { SeoService } from './seo.service';

/** Storefront: redirect list for the middleware, sitemap data. */
@ApiTags('SEO')
@Public()
@Controller('seo')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('redirects')
  redirects(): Promise<PublicRedirect[]> {
    return this.seo.publicRedirects();
  }

  @Get('sitemap')
  sitemap(): Promise<SitemapDataDto> {
    return this.seo.sitemap();
  }
}

@ApiTags('Admin · SEO')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.MARKETING_MANAGER)
@Controller('admin/seo/redirects')
export class AdminSeoController {
  constructor(private readonly seo: SeoService) {}

  @Get()
  list(): Promise<RedirectDto[]> {
    return this.seo.list();
  }

  @Post()
  create(@Body() dto: RedirectDtoBody, @CurrentUser('sub') actorId: string): Promise<RedirectDto> {
    return this.seo.create(dto, actorId);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(
    @Body() dto: RedirectImportDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<RedirectImportResult> {
    return this.seo.import(dto.text, actorId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: RedirectDtoBody,
    @CurrentUser('sub') actorId: string,
  ): Promise<RedirectDto> {
    return this.seo.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.seo.remove(id, actorId);
  }
}
