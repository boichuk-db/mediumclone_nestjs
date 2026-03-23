import { ArticleEntity } from './article.entity';
import { CommentEntity } from './comment.entity';
import { CreateArticleDto } from './dto/createArticle.dto';
import {
  Injectable,
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
import { BackendException } from '@app/shared/exceptions/backend.exception';
import { CreateCommentDto } from './dto/createComment.dto';
import type { CommentType } from './types/comment.type';
import type { CommentResponseInterface } from './types/comment.response';
import type { CommentsResponseInterface } from './types/comments.response';

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articleRepository: Repository<ArticleEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentRepository: Repository<CommentEntity>,
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

  async getCommentsByArticleSlug(
    slug: string,
    currentUserId?: number,
  ): Promise<CommentsResponseInterface> {
    const article = await this.findBySlug(slug);
    const comments = await this.commentRepository.find({
      where: { articleId: article.id },
      order: { createdAt: 'DESC' },
      relations: ['author'],
    });
    const commentsWithAuthor = await this.mapCommentsWithAuthorFollowing(
      comments,
      currentUserId,
    );
    return { comments: commentsWithAuthor };
  }

  async addCommentToArticle(
    slug: string,
    createCommentDto: CreateCommentDto,
    currentUser: UserEntity,
  ): Promise<CommentResponseInterface> {
    const article = await this.findBySlug(slug);
    const comment = new CommentEntity();
    comment.body = createCommentDto.body;
    comment.articleId = article.id;
    comment.authorId = currentUser.id;

    const savedComment = await this.commentRepository.save(comment);
    const commentWithAuthor = await this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: ['author'],
    });
    if (!commentWithAuthor) {
      throw BackendException.notFound('Comment not found');
    }

    const [mappedComment] = await this.mapCommentsWithAuthorFollowing(
      [commentWithAuthor],
      currentUser.id,
    );
    return { comment: mappedComment };
  }

  async deleteCommentFromArticle(
    slug: string,
    commentId: number,
    currentUserId: number,
  ): Promise<void> {
    const article = await this.findBySlug(slug);
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, articleId: article.id },
    });
    if (!comment) {
      throw BackendException.notFound('Comment not found');
    }
    if (comment.authorId !== currentUserId) {
      throw BackendException.forbidden('You are not the author of this comment');
    }
    await this.commentRepository.delete({ id: commentId });
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
      throw BackendException.notFound('Article not found');
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

  private async mapCommentsWithAuthorFollowing(
    comments: CommentEntity[],
    currentUserId?: number,
  ): Promise<CommentType[]> {
    const authorIds = [...new Set(comments.map((comment) => comment.authorId))];
    const followSet = new Set<number>();

    if (currentUserId && authorIds.length > 0) {
      const follows = await this.followRepository.find({
        where: {
          followerId: currentUserId,
          followingId: In(authorIds),
        },
      });
      follows.forEach((follow) => followSet.add(follow.followingId));
    }

    return comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: {
        username: comment.author.username,
        bio: comment.author.bio,
        image: comment.author.image,
        following: followSet.has(comment.authorId),
      },
    }));
  }

  async deleteArticle(
    slug: string,
    currentUserId: number,
  ): Promise<DeleteResult> {
    const article = await this.findBySlug(slug);
    if (!article) {
      throw BackendException.notFound('Article not found');
    }
    if (article.author.id !== currentUserId) {
      throw BackendException.forbidden('You are not the author of this article');
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
      throw BackendException.notFound('Article not found');
    }
    if (article.author.id !== currentUserId) {
      throw BackendException.forbidden('You are not the author of this article');
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
      throw BackendException.notFound('User not found');
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
      throw BackendException.notFound('User not found');
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
