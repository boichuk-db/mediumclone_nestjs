import { CreateUserDto } from '@app/user/dto/createUser.dto';
import { Injectable } from '@nestjs/common';
import { UserEntity } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserResponseInterface } from './types/userResponse.interface';
import { LoginUserDto } from '@app/user/dto/loginUser.dto';
import { compare, hash } from 'bcrypt';
import { UpdateUserDto } from '@app/user/dto/updateUser.dto';
import { BackendException } from '@app/shared/exceptions/backend.exception';

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
      throw BackendException.validation('email', 'is already in use');
    }
    const userByUsername = await this.userRepository.findOne({
      where: {
        username: createUserDto.username,
      },
    });
    if (userByUsername) {
      throw BackendException.validation('username', 'is already in use');
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
      throw BackendException.unauthorized('Invalid credentials');
    }
    const isPasswordCorrect = await compare(
      loginUserDto.password,
      user.password,
    );
    if (!isPasswordCorrect) {
      throw BackendException.unauthorized('Invalid credentials');
    }

    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword as UserEntity;
  }

  async findById(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw BackendException.notFound('User not found');
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
        throw BackendException.validation('email', 'is already in use');
      }
    }
    if (updateUserDto.username) {
      const userByUsername = await this.userRepository.findOne({
        where: { username: updateUserDto.username },
      });
      if (userByUsername && userByUsername.id !== currentUserId) {
        throw BackendException.validation('username', 'is already in use');
      }
    }
    Object.assign(user, updateUserDto);

    if (updateUserDto.password) {
      user.password = await hash(updateUserDto.password, 10);
    }

    return await this.userRepository.save(user);
  }
}
