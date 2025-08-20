import { Resolver, Query, Arg, Float, Int } from 'type-graphql';
import { Service } from 'typedi';
import { 
  SearchResult, 
  SearchFilter, 
  PaginatedSearchResults, 
  PaginationInput 
} from '../schema/types';
import { SearchService } from '../services/search.service';
import { createLogger } from '@kpc/shared';

const logger = createLogger('SearchResolver');

@Service()
@Resolver(() => SearchResult)
export class SearchResolver {
  constructor(private searchService: SearchService) {}

  @Query(() => [SearchResult], { description: 'Search components and documentation' })
  async search(
    @Arg('query') query: string,
    @Arg('filter', () => SearchFilter, { nullable: true }) filter?: SearchFilter,
    @Arg('limit', () => Int, { defaultValue: 20 }) limit?: number
  ): Promise<SearchResult[]> {
    logger.debug(`Searching for: ${query}`);
    
    try {
      return await this.searchService.search(query, filter, limit);
    } catch (error) {
      logger.error(`Search failed for query "${query}":`, error);
      throw error;
    }
  }

  @Query(() => PaginatedSearchResults, { description: 'Paginated search results' })
  async paginatedSearch(
    @Arg('query') query: string,
    @Arg('filter', () => SearchFilter, { nullable: true }) filter?: SearchFilter,
    @Arg('pagination', () => PaginationInput, { nullable: true }) pagination?: PaginationInput
  ): Promise<PaginatedSearchResults> {
    logger.debug(`Paginated search for: ${query}`);
    
    try {
      return await this.searchService.paginatedSearch(query, filter, pagination);
    } catch (error) {
      logger.error(`Paginated search failed for query "${query}":`, error);
      throw error;
    }
  }

  @Query(() => [SearchResult], { description: 'Semantic search using vector similarity' })
  async semanticSearch(
    @Arg('query') query: string,
    @Arg('threshold', () => Float, { defaultValue: 0.7 }) threshold: number,
    @Arg('limit', () => Int, { defaultValue: 10 }) limit: number,
    @Arg('filter', () => SearchFilter, { nullable: true }) filter?: SearchFilter
  ): Promise<SearchResult[]> {
    logger.debug(`Semantic search for: ${query}`);
    
    try {
      return await this.searchService.semanticSearch(query, threshold, limit, filter);
    } catch (error) {
      logger.error(`Semantic search failed for query "${query}":`, error);
      throw error;
    }
  }

  @Query(() => [SearchResult], { description: 'Search by component properties' })
  async searchByProps(
    @Arg('propName') propName: string,
    @Arg('propType', { nullable: true }) propType?: string,
    @Arg('framework', { nullable: true }) framework?: string,
    @Arg('limit', () => Int, { defaultValue: 20 }) limit?: number
  ): Promise<SearchResult[]> {
    logger.debug(`Searching by prop: ${propName}, type: ${propType}`);
    
    try {
      return await this.searchService.searchByProps(propName, propType, framework, limit);
    } catch (error) {
      logger.error(`Property search failed for prop "${propName}":`, error);
      throw error;
    }
  }

  @Query(() => [SearchResult], { description: 'Search by component events' })
  async searchByEvents(
    @Arg('eventName') eventName: string,
    @Arg('framework', { nullable: true }) framework?: string,
    @Arg('limit', () => Int, { defaultValue: 20 }) limit?: number
  ): Promise<SearchResult[]> {
    logger.debug(`Searching by event: ${eventName}`);
    
    try {
      return await this.searchService.searchByEvents(eventName, framework, limit);
    } catch (error) {
      logger.error(`Event search failed for event "${eventName}":`, error);
      throw error;
    }
  }

  @Query(() => [SearchResult], { description: 'Search code examples' })
  async searchExamples(
    @Arg('query') query: string,
    @Arg('framework', { nullable: true }) framework?: string,
    @Arg('category', { nullable: true }) category?: string,
    @Arg('limit', () => Int, { defaultValue: 10 }) limit?: number
  ): Promise<SearchResult[]> {
    logger.debug(`Searching examples for: ${query}`);
    
    try {
      return await this.searchService.searchExamples(query, framework, category, limit);
    } catch (error) {
      logger.error(`Example search failed for query "${query}":`, error);
      throw error;
    }
  }

  @Query(() => [String], { description: 'Get search suggestions' })
  async searchSuggestions(
    @Arg('query') query: string,
    @Arg('limit', () => Int, { defaultValue: 5 }) limit?: number
  ): Promise<string[]> {
    logger.debug(`Getting search suggestions for: ${query}`);
    
    try {
      return await this.searchService.getSuggestions(query, limit);
    } catch (error) {
      logger.error(`Failed to get suggestions for query "${query}":`, error);
      throw error;
    }
  }

  @Query(() => [String], { description: 'Get popular search terms' })
  async popularSearchTerms(
    @Arg('limit', () => Int, { defaultValue: 10 }) limit?: number
  ): Promise<string[]> {
    logger.debug('Getting popular search terms');
    
    try {
      return await this.searchService.getPopularTerms(limit);
    } catch (error) {
      logger.error('Failed to get popular search terms:', error);
      throw error;
    }
  }

  @Query(() => [SearchResult], { description: 'Advanced search with multiple criteria' })
  async advancedSearch(
    @Arg('query', { nullable: true }) query?: string,
    @Arg('componentName', { nullable: true }) componentName?: string,
    @Arg('propName', { nullable: true }) propName?: string,
    @Arg('eventName', { nullable: true }) eventName?: string,
    @Arg('category', { nullable: true }) category?: string,
    @Arg('framework', { nullable: true }) framework?: string,
    @Arg('deprecated', { nullable: true }) deprecated?: boolean,
    @Arg('minScore', () => Float, { nullable: true }) minScore?: number,
    @Arg('limit', () => Int, { defaultValue: 20 }) limit?: number
  ): Promise<SearchResult[]> {
    logger.debug('Performing advanced search');
    
    try {
      const criteria = {
        query,
        componentName,
        propName,
        eventName,
        category,
        framework,
        deprecated,
        minScore,
      };
      
      return await this.searchService.advancedSearch(criteria, limit);
    } catch (error) {
      logger.error('Advanced search failed:', error);
      throw error;
    }
  }

  @Query(() => Int, { description: 'Get search result count' })
  async searchCount(
    @Arg('query') query: string,
    @Arg('filter', () => SearchFilter, { nullable: true }) filter?: SearchFilter
  ): Promise<number> {
    logger.debug(`Getting search count for: ${query}`);
    
    try {
      return await this.searchService.getSearchCount(query, filter);
    } catch (error) {
      logger.error(`Failed to get search count for query "${query}":`, error);
      throw error;
    }
  }
}