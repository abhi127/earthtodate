import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.repo.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });
    if (existing) {
      const field = existing.email === dto.email ? 'email' : 'username';
      throw new ConflictException(`User with this ${field} already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.repo.create({ ...dto, passwordHash });
    return this.repo.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.repo.find({
      select: ['id', 'email', 'username', 'name', 'role', 'isActive', 'createdAt', 'updatedAt'],
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'username', 'name', 'role', 'isActive', 'createdAt', 'updatedAt'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  // ponytail: returns full entity including passwordHash for auth
  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 12);
    }
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.repo.remove(user);
  }
}
