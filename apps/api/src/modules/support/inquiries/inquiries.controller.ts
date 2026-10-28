import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { InquiryCreatedDto } from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { CreateInquiryDto } from './dto/inquiry.dto';
import { InquiriesService } from './inquiries.service';

@ApiTags('Inquiries')
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  /** Website Contact page: repair request, quote or question. Signed-in customers are linked. */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post()
  create(
    @Body() dto: CreateInquiryDto,
    @CurrentUser('sub') userId: string | undefined,
  ): Promise<InquiryCreatedDto> {
    return this.inquiries.create(dto, userId ?? null);
  }
}
