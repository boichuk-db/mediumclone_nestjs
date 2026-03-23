import { ArticleEntity } from './article.entity';
import { UserEntity } from '@app/user/user.entity';
import {
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'comments' })
export class CommentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  body: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column()
  articleId: number;

  @Column()
  authorId: number;

  @ManyToOne(() => ArticleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'articleId' })
  article: ArticleEntity;

  @ManyToOne(() => UserEntity, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: UserEntity;

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }
}

