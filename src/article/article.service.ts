import { ArticleEntity } from './article.entity';
import { CreateArticleDto } from './dto/createArticle.dto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserEntity } from '@app/user/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, In, Repository } from 'typeorm';
import { ArticleResponseInterface } from './types/article.response';
import slugify from 'slugify';
import { UpdateArticleDto } from './dto/updateArticle.dto';
import { ArticlesResponseInterface } from './types/articles.response';
import type { ArticlesQueryInterface } from './types/articlesQuery.interface';
import type { ArticleType } from './types/article.type';
import { FollowEntity } from '@app/profile/follow.entity';

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articleRepository: Repository<ArticleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(FollowEntity)
    private readonly followRepository: Repository<FollowEntity>,
  ) {}

  async getArticles(
    query: ArticlesQueryInterface,
    currentUserId?: number,
  ): Promise<ArticlesResponseInterface> {
    const queryBuilder = await this.articleRepository
      .createQueryBuilder('articles')
      .leftJoinAndSelect('articles.author', 'author');

    queryBuilder.orderBy('articles.createdAt', 'DESC');
    const articlesCount = await queryBuilder.getCount();

    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      if (Number.isFinite(limit)) {
        queryBuilder.limit(limit);
      }
    }

    if (query.offset !== undefined) {
      const offset = Number(query.offset);
      if (Number.isFinite(offset)) {
        queryBuilder.offset(offset);
      }
    }

    if (query.author) {
      const author = await this.userRepository.findOne({
        where: { username: query.author },
      });
      queryBuilder.andWhere('articles.authorId = :id', { id: author?.id });
    }

    if (query.favorited) {
      const user = await this.userRepository.findOne({
        where: { username: query.favorited },
        relations: ['favorites'],
      });
      const favoriteIds = user?.favorites?.map((favorite) => favorite.id) ?? [];
      if (favoriteIds.length === 0) {
        queryBuilder.andWhere('1 = 0');
      } else {
        queryBuilder.andWhere('articles.id IN (:...favorites)', {
          favorites: favoriteIds,
        });
      }
    }

    if (query.tag) {
      queryBuilder.andWhere('articles.tagList LIKE :tag', {
        tag: `%${query.tag}%`,
      });
    }

    const articles = await queryBuilder.getMany();
    const favoriteIds = await this.getFavoriteArticleIdsForUser(currentUserId);

    const articlesWithFavorited: ArticleType[] = articles.map((article) => {
      const favorited = favoriteIds.includes(article.id);
      return {
        ...article,
        favorited,
      };
    });

    return { articles: articlesWithFavorited, articlesCount };
  }

  async getFeed(
    query: ArticlesQueryInterface,
    currentUserId: number,
  ): Promise<ArticlesResponseInterface> {
    const followings = await this.followRepository.find({
      where: { followerId: currentUserId },
    });
    if (followings.length === 0) {
      return { articles: [], articlesCount: 0 };
    }
    const followingIds = followings.map((following) => following.followingId);
    const queryBuilder = await this.articleRepository
      .createQueryBuilder('articles')
      .leftJoinAndSelect('articles.author', 'author')
      .where('articles.authorId IN (:...followingIds)', { followingIds });

    queryBuilder.orderBy('articles.createdAt', 'DESC');
    const articlesCount = await queryBuilder.getCount();

    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      if (Number.isFinite(limit)) {
        queryBuilder.limit(limit);
      }
    }
    if (query.offset !== undefined) {
      const offset = Number(query.offset);
      if (Number.isFinite(offset)) {
        queryBuilder.offset(offset);
      }
    }
    const articles = await queryBuilder.getMany();
    const favoriteIds = await this.getFavoriteArticleIdsForUser(currentUserId);
    const articlesWithFavorited: ArticleType[] = articles.map((article) => {
      const favorited = favoriteIds.includes(article.id);
      return {
        ...article,
        favorited,
      };
    });
    return { articles: articlesWithFavorited, articlesCount };
  }
  async getArticleBySlug(
    slug: string,
    currentUserId?: number,
  ): Promise<ArticleResponseInterface> {
    const article = await this.findBySlug(slug);
    const favoriteIds = await this.getFavoriteArticleIdsForUser(currentUserId);
    const favorited = favoriteIds.includes(article.id);
    return this.buildArticleResponse(article, favorited);
  }

  async createArticle(
    currentUser: UserEntity,
    createArticleDto: CreateArticleDto,
  ): Promise<ArticleEntity> {
    const article = new ArticleEntity();
    Object.assign(article, createArticleDto);

    if (!article.tagList) {
      article.tagList = [];
    }

    article.slug = this.generateSlug(createArticleDto.title);

    article.author = currentUser;
    return await this.articleRepository.save(article);
  }

  buildArticleResponse(
    article: ArticleEntity,
    favorited = false,
  ): ArticleResponseInterface {
    return {
      article: {
        ...article,
        favorited,
      },
    };
  }

  private generateSlug(title: string): string {
    return (
      slugify(title, { lower: true }) +
      '-' +
      ((Math.random() * Math.pow(36, 6)) | 0).toString(36)
    );
  }

  async findBySlug(slug: string): Promise<ArticleEntity> {
    const article = await this.articleRepository.findOne({
      where: { slug },
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  private async getFavoriteArticleIdsForUser(
    currentUserId?: number,
  ): Promise<number[]> {
    if (!currentUserId) {
      return [];
    }

    const user = await this.userRepository.findOne({
      where: { id: currentUserId },
      relations: ['favorites'],
    });

    return user?.favorites?.map((favorite) => favorite.id) ?? [];
  }

  async deleteArticle(
    slug: string,
    currentUserId: number,
  ): Promise<DeleteResult> {
    const article = await this.findBySlug(slug);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    if (article.author.id !== currentUserId) {
      throw new ForbiddenException('You are not the author of this article');
    }
    return await this.articleRepository.delete({ slug });
  }

  async updateArticle(
    slug: string,
    updateArticleDto: UpdateArticleDto,
    currentUserId: number,
  ): Promise<ArticleEntity> {
    const article = await this.findBySlug(slug);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    if (article.author.id !== currentUserId) {
      throw new ForbiddenException('You are not the author of this article');
    }
    Object.assign(article, updateArticleDto);
    return await this.articleRepository.save(article);
  }

  async addArticleToFavorites(
    slug: string,
    currentUserId: number,
  ): Promise<ArticleEntity> {
    const article = await this.findBySlug(slug);

    const user = await this.userRepository.findOne({
      where: { id: currentUserId },
      relations: ['favorites'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.favorites) {
      user.favorites = [];
    }

    const isNotFavorite =
      user.favorites.findIndex(
        (articleInFavorites) => articleInFavorites.id === article.id,
      ) === -1;

    if (isNotFavorite) {
      user.favorites.push(article);
      article.favoritesCount++;

      await this.userRepository.save(user);
      await this.articleRepository.save(article);
    }

    return article;
  }

  async removeArticleFromFavorites(
    slug: string,
    currentUserId: number,
  ): Promise<ArticleEntity> {
    const article = await this.findBySlug(slug);
    const user = await this.userRepository.findOne({
      where: { id: currentUserId },
      relations: ['favorites'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.favorites) {
      user.favorites = [];
    }

    const isFavorite =
      user.favorites.findIndex(
        (articleInFavorites) => articleInFavorites.id === article.id,
      ) !== -1;

    if (isFavorite) {
      user.favorites = user.favorites.filter(
        (articleInFavorites) => articleInFavorites.id !== article.id,
      );
      article.favoritesCount--;
      await this.userRepository.save(user);
      await this.articleRepository.save(article);
    }

    return article;
  }
}
