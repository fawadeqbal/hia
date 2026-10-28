import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import type { DidYouMean, SearchSuggestions } from '@ecommerce/types';
import { Public } from '../../common/decorators/public.decorator';
import { SearchService } from './search.service';

@ApiTags('Search')
@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('suggest')
  @ApiQuery({ name: 'q', required: true })
  suggest(@Query('q') q: string): Promise<SearchSuggestions> {
    return this.searchService.suggest(q ?? '');
  }

  /** Kept for older clients: same as suggest. */
  @Get('autocomplete')
  @ApiQuery({ name: 'q', required: true })
  autocomplete(@Query('q') q: string): Promise<SearchSuggestions> {
    return this.searchService.suggest(q ?? '');
  }

  @Get('did-you-mean')
  @ApiQuery({ name: 'q', required: true })
  didYouMean(@Query('q') q: string): Promise<DidYouMean> {
    return this.searchService.didYouMean(q ?? '');
  }
}
