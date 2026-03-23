import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDb1771863678007 implements MigrationInterface {
  name = 'SeedDb1771863678007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO tags (name) VALUES ('dragons'), ('coffee'), ('nestjs')`,
    );
    await queryRunner.query(
      /* password: 'Pass123!' */
      `INSERT INTO users (username,email, password) VALUES ('test', 'test@test.com', '$2b$10$pSRx4Ai.Q0uGhlVTb8Vit.R4fILuQj1.BeDnRtQRvti521r52vGn2')`,
    );
    await queryRunner.query(
      `INSERT INTO articles (slug, title, description, body, "tagList", "authorId") VALUES ('first-article', 'First Article', 'First Article Description', 'First Article Body', 'test,test2', 1)`,
    );
    await queryRunner.query(
      `INSERT INTO articles (slug, title, description, body, "tagList", "authorId") VALUES ('second-article', 'Second Article', 'Second Article Description', 'Second Article Body', 'test,test2', 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
