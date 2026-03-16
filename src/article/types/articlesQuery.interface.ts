export interface ArticlesQueryInterface {
  limit?: string | number;
  offset?: string | number;
  author?: string;
  tag?: string;
  favorited?: string;
}

