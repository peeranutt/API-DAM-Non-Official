export class UpdateUserDto {
  username: string;
  password: string;
  email: string;
  fullname: string;
  role?: 'admin' | 'edit' | 'viewer';
}