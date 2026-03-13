import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(20)
  readonly username: string;
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  readonly email: string;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(32)
  readonly password: string;
  @IsOptional()
  @IsString()
  readonly bio: string;
  @IsOptional()
  @IsString()
  readonly image: string;
}
