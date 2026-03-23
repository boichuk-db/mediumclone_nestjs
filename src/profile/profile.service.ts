import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProfileResponseInterface } from './types/profileResponse.interface';
import { ProfileType } from './types/profile.type';
import { UserEntity } from '@app/user/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FollowEntity } from './follow.entity';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(FollowEntity)
    private readonly followRepository: Repository<FollowEntity>,
  ) {}
  async getProfile(
    currentUserId: number | undefined,
    profileUsername: string,
  ): Promise<ProfileType> {
    const profile = await this.userRepository.findOne({
      where: { username: profileUsername },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    if (!currentUserId) {
      return {
        ...profile,
        following: false,
      };
    }
    const follow = await this.followRepository.findOne({
      where: {
        followerId: currentUserId,
        followingId: profile.id,
      },
    });
    return {
      ...profile,
      following: !!follow,
    };
  }

  async followProfile(
    currentUserId: number,
    profileUsername: string,
  ): Promise<ProfileType> {
    const profile = await this.userRepository.findOne({
      where: { username: profileUsername },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    if (currentUserId === profile.id) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const follow = await this.followRepository.findOne({
      where: {
        followerId: currentUserId,
        followingId: profile.id,
      },
    });
    if (!follow) {
      const followToCreate = new FollowEntity();
      followToCreate.followerId = currentUserId;
      followToCreate.followingId = profile.id;
      await this.followRepository.save(followToCreate);
    }
    return {
      ...profile,
      following: true,
    };
  }

  async unfollowProfile(
    currentUserId: number,
    profileUsername: string,
  ): Promise<ProfileType> {
    const profile = await this.userRepository.findOne({
      where: { username: profileUsername },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    if (currentUserId === profile.id) {
      throw new BadRequestException('You cannot unfollow yourself');
    }
    await this.followRepository.delete({
      followerId: currentUserId,
      followingId: profile.id,
    });
    return {
      ...profile,
      following: false,
    };
  }

  buildProfileResponse(profile: ProfileType): ProfileResponseInterface {
    const { email: _email, ...publicProfile } = profile;
    return {
      profile: publicProfile,
    };
  }
}
