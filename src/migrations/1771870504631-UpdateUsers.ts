import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUsers1771870504631 implements MigrationInterface {
    name = 'UpdateUsers1771870504631'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "age" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "age"`);
    }

}
