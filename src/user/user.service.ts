import { CreateUserDto } from '@app/dto/createUser.dto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserEntity } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserResponseInterface } from './types/userResponse.interface';
import { LoginUserDto } from '@app/dto/loginUser.dto';
import { compare, hash } from 'bcrypt';
import { UpdateUserDto } from '@app/dto/updateUser.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}
  async createUser(createUserDto: CreateUserDto): Promise<UserEntity> {
    const userByEmail = await this.userRepository.findOne({
      where: {
        email: createUserDto.email,
      },
    });
    if (userByEmail) {
      throw new HttpException(
        'Email is already in use',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const userByUsername = await this.userRepository.findOne({
      where: {
        username: createUserDto.username,
      },
    });
    if (userByUsername) {
      throw new HttpException(
        'Username is already in use',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const newUser = new UserEntity();
    Object.assign(newUser, createUserDto);
    return await this.userRepository.save(newUser);
  }

  async login(loginUserDto: LoginUserDto): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { email: loginUserDto.email },
      select: ['id', 'email', 'username', 'bio', 'image', 'password'],
    });
    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    const isPasswordCorrect = await compare(
      loginUserDto.password,
      user.password,
    );
    if (!isPasswordCorrect) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword as UserEntity;
  }

  async findById(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  generateJwt(user: UserEntity): string {
    return this.jwtService.sign({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  }

  buildUserResponse(user: UserEntity): UserResponseInterface {
    return {
      user: {
        ...user,
        token: this.generateJwt(user),
      },
    };
  }

  async updateUser(
    currentUserId: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserEntity> {
    const user = await this.findById(currentUserId);
    if (updateUserDto.email) {
      const userByEmail = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (userByEmail && userByEmail.id !== currentUserId) {
        throw new HttpException(
          'Email is already in use',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }
    if (updateUserDto.username) {
      const userByUsername = await this.userRepository.findOne({
        where: { username: updateUserDto.username },
      });
      if (userByUsername && userByUsername.id !== currentUserId) {
        throw new HttpException(
          'Username is already in use',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }
    Object.assign(user, updateUserDto);

    if (updateUserDto.password) {
      user.password = await hash(updateUserDto.password, 10);
    }

    return await this.userRepository.save(user);
  }
}
