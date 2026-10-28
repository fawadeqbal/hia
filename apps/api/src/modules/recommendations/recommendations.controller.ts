import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ProductRecommendations } from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { RecommendationsService } from './recommendations.service';

@ApiTags('Recommendations')
@Public()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get('products/:slug')
  forProduct(@Param('slug') slug: string): Promise<ProductRecommendations> {
    return this.recommendations.forProduct(slug);
  }
}
