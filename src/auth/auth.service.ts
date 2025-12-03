import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string) {
    if (!password) {
      console.warn('validateUser: no password provided');
      return null;
    }
    
    const user = await this.usersService.findByUsername(username);
    console.log("User found:", user);
    if (!user) return null;
    
    // const ok = password === user.password;

    // Compare hashed passwords
    const ok = await bcrypt.compare(password, user.password);
    console.log("Password check:", ok);
    if (!ok) return null;
    const { password: _pw, ...safe } = user;
    console.log('Validated user:', safe);
    return safe;
  }

  async login(dto: { username: string; password: string }) {
    console.log('Login DTO received:', dto);
    console.log('Login attempt for user:', dto.username, dto.password);
    const user = await this.validateUser(dto.username, dto.password);
    console.log('Login result for user:', user);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user,
      success: true,
    };
  }

  async register(dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}