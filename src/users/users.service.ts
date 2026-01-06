import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    const users = await this.repo.find();
    console.log('findAll users result:', users);
    return users;
  }

  async findByUsername(username: string) {
    console.log('Finding user by username:', username);
    return this.repo.findOne({ where: { username } });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    if (!createUserDto.password) {
      throw new Error('Password is required');
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const newUser = this.repo.create({
      username: createUserDto.username,
      password: hashedPassword,
      email: createUserDto.email,
      fullname: createUserDto.fullname,
    });

    try {
      console.log('Creating user with data:', newUser);
      const savedUser = await this.repo.save(newUser);
      console.log('User created successfully:', savedUser);
      return savedUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updatePassword(id: number, newPassword: string): Promise<User | null> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) return null;
    user.password = newPassword;
    return this.repo.save(user);
  }

  async findOne(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
