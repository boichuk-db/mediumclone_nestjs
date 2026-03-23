import { UserType } from '@app/user/types/user.type';

export type ProfileType = UserType & {
  following: boolean;
};

export type PublicProfileType = Omit<ProfileType, 'email'>;
