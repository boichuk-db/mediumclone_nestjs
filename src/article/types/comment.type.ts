export type CommentAuthorType = {
  username: string;
  bio: string;
  image: string;
  following: boolean;
};

export type CommentType = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  body: string;
  author: CommentAuthorType;
};

