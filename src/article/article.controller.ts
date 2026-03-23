import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';

import { ArticleService } from './article.service';
import { AuthGuard } from '@app/user/guards/auth.guard';
import { UserEntity } from '@app/user/user.entity';
import { User } from '@app/user/decorators/user.decorator';
import { CreateArticleDto } from './dto/createArticle.dto';
import { CreateCommentDto } from './dto/createComment.dto';
import { ArticleResponseInterface } from './types/article.response';
import { DeleteResult } from 'typeorm';
import { UpdateArticleDto } from './dto/updateArticle.dto';
import { ArticlesResponseInterface } from './types/articles.response';
import { CommentsResponseInterface } from './types/comments.response';
import { CommentResponseInterface } from './types/comment.response';
import type { ArticlesQueryInterface } from './types/articlesQuery.interface';
import type { ExpressRequestInterface } from '@app/types/expressRequest.interface';
import { BackendValidationPipe } from '@app/shared/pipes/backendValidation.pipe';

@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  async getArticles(
    @Query() query: ArticlesQueryInterface,
    @Req() request: ExpressRequestInterface,
  ): Promise<ArticlesResponseInterface> {
    return await this.articleService.getArticles(query, request.user?.id);
  }

  @Get('feed')
  @UseGuards(AuthGuard)
  async getFeed(
    @Query() query: ArticlesQueryInterface,
    @User('id') currentUserId: number,
  ): Promise<ArticlesResponseInterface> {
    return await this.articleService.getFeed(query, currentUserId);
  }

  @Post()
  @UseGuards(AuthGuard)
  @UsePipes(new BackendValidationPipe())
  async createArticle(
    @User() currentUser: UserEntity,
    @Body('article') createArticleDto: CreateArticleDto,
  ): Promise<ArticleResponseInterface> {
    const article = await this.articleService.createArticle(
      currentUser,
      createArticleDto,
    );
    return await this.articleService.buildArticleResponse(
      article,
      false,
      currentUser.id,
    );
  }

  @Get(':slug/comments')
  async getCommentsByArticleSlug(
    @Param('slug') slug: string,
    @Req() request: ExpressRequestInterface,
  ): Promise<CommentsResponseInterface> {
    return await this.articleService.getCommentsByArticleSlug(
      slug,
      request.user?.id,
    );
  }

  @Post(':slug/comments')
  @UseGuards(AuthGuard)
  @UsePipes(new BackendValidationPipe())
  async addCommentToArticle(
    @Param('slug') slug: string,
    @Body('comment') createCommentDto: CreateCommentDto,
    @User() currentUser: UserEntity,
  ): Promise<CommentResponseInterface> {
    return await this.articleService.addCommentToArticle(
      slug,
      createCommentDto,
      currentUser,
    );
  }

  @Delete(':slug/comments/:id')
  @UseGuards(AuthGuard)
  async deleteCommentFromArticle(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @User('id') currentUserId: number,
  ): Promise<void> {
    return await this.articleService.deleteCommentFromArticle(
      slug,
      Number(id),
      currentUserId,
    );
  }

  @Get(':slug')
  async getSingleArticle(
    @Param('slug') slug: string,
    @Req() request: ExpressRequestInterface,
  ): Promise<ArticleResponseInterface> {
    return await this.articleService.getArticleBySlug(slug, request.user?.id);
  }

  @Delete(':slug')
  @UseGuards(AuthGuard)
  async deleteArticle(
    @Param('slug') slug: string,
    @User('id') currentUserId: number,
  ): Promise<DeleteResult> {
    return await this.articleService.deleteArticle(slug, currentUserId);
  }

  @Put(':slug')
  @UseGuards(AuthGuard)
  @UsePipes(new BackendValidationPipe())
  async updateArticle(
    @Param('slug') slug: string,
    @Body('article') updateArticleDto: UpdateArticleDto,
    @User('id') currentUserId: number,
  ): Promise<ArticleResponseInterface> {
    const article = await this.articleService.updateArticle(
      slug,
      updateArticleDto,
      currentUserId,
    );
    return await this.articleService.buildArticleResponse(
      article,
      false,
      currentUserId,
    );
  }

  @Post(':slug/favorite')
  @UseGuards(AuthGuard)
  async addArticleToFavorites(
    @Param('slug') slug: string,
    @User('id') currentUserId: number,
  ): Promise<ArticleResponseInterface> {
    const article = await this.articleService.addArticleToFavorites(
      slug,
      currentUserId,
    );
    return await this.articleService.buildArticleResponse(
      article,
      true,
      currentUserId,
    );
  }

  @Delete(':slug/favorite')
  @UseGuards(AuthGuard)
  async removeArticleFromFavorites(
    @Param('slug') slug: string,
    @User('id') currentUserId: number,
  ): Promise<ArticleResponseInterface> {
    const article = await this.articleService.removeArticleFromFavorites(
      slug,
      currentUserId,
    );
    return await this.articleService.buildArticleResponse(
      article,
      false,
      currentUserId,
    );
  }
}
