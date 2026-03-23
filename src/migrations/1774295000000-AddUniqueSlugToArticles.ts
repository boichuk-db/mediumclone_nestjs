import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueSlugToArticles1774295000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_articles_slug_unique" ON "articles" ("slug")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_articles_slug_unique"');
  }
}
