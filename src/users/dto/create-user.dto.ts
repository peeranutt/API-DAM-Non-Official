import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsEmail()
  email: string;

  @IsString()
  fullname: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}