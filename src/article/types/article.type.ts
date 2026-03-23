import { ArticleEntity } from '../article.entity';

export type ArticleAuthorType = {
  username: string;
  bio: string;
  image: string;
  following: boolean;
};

export type ArticleType = Omit<ArticleEntity, 'updateTimestamp' | 'author'> & {
  author: ArticleAuthorType;
  favorited: boolean;
};
