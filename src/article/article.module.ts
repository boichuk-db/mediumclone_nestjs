import { ArticleController } from './article.controller';
import { CommentEntity } from './comment.entity';
import { ArticleEntity } from './article.entity';
import { ArticleService } from './article.service';
import { FollowEntity } from '@app/profile/follow.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@app/user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArticleEntity, CommentEntity, UserEntity, FollowEntity]),
  ],
  controllers: [ArticleController],
  providers: [ArticleService],
})
export class ArticleModule {}
