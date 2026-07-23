# GeoSyze Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build NestJS modular monolith backend with JWT auth, role-based access, and GIS file upload

**Architecture:** TypeORM with configurable SQLite/PostgreSQL dialect, Passport JWT with access+refresh tokens, 3-role RBAC (admin/editor/viewer), Multer-based GIS file upload with GeoJSON+Shapefile support

**Tech Stack:** NestJS 10, TypeORM 0.3, Passport JWT, bcrypt, class-validator, Multer, @turf/turf, shapefile

---

### Task 1: Scaffold NestJS Project

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/nest-cli.json`
- Create: `backend/.gitignore`
- Create: `backend/.env.example`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "geosyze-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "migration:generate": "typeorm-ts-node-commonjs migration:generate",
    "migration:run": "typeorm-ts-node-commonjs migration:run"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/mapped-types": "^2.0.5",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.0",
    "@nestjs/throttler": "^6.2.1",
    "@nestjs/typeorm": "^10.0.2",
    "@turf/turf": "^7.1.0",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "helmet": "^8.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "shapefile": "^0.6.6",
    "sqlite3": "^5.1.7",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.4.0",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^5.0.0",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.0.0",
    "@types/passport-jwt": "^4.0.1",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@/*": ["src/*"] }
  }
}
```

- [ ] **Step 3: Create tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

- [ ] **Step 4: Create nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
database.sqlite
uploads/
.env
*.log
```

- [ ] **Step 6: Create .env.example**

```
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

JWT_ACCESS_SECRET=change-me-access-secret-32chars
JWT_REFRESH_SECRET=change-me-refresh-secret-32chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

DATABASE_TYPE=sqlite
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=geosyze
SQLITE_PATH=./database.sqlite

UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=50
MAX_TOTAL_SIZE_MB=200
```

- [ ] **Step 7: Create src/main.ts**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`GeoSyze backend running on http://localhost:${port}`);
}
bootstrap();
```

- [ ] **Step 8: Create src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GisModule } from './gis/gis.module';

@Module({
  imports: [ConfigModule, AuthModule, UsersModule, GisModule],
})
export class AppModule {}
```

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: scaffold nestjs project structure"
```

---

### Task 2: Config Module (TypeORM + Env)

**Files:**
- Create: `backend/src/config/config.module.ts`
- Create: `backend/src/config/database.config.ts`
- Create: `backend/src/config/auth.config.ts`

- [ ] **Step 1: Create config/database.config.ts**

```typescript
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { join } from 'path';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  useFactory: () => {
    const dbType = process.env.DATABASE_TYPE || 'sqlite';

    if (dbType === 'sqlite') {
      return {
        type: 'sqlite',
        database: process.env.SQLITE_PATH || './database.sqlite',
        entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
        synchronize: process.env.NODE_ENV !== 'production',
        autoLoadEntities: true,
      };
    }

    return {
      type: dbType as 'postgres' | 'mysql',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'geosyze',
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      synchronize: process.env.NODE_ENV !== 'production',
      autoLoadEntities: true,
    };
  },
};
```

- [ ] **Step 2: Create config/auth.config.ts**

```typescript
export const authConfig = () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key',
  accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
});
```

- [ ] **Step 3: Create config/config.module.ts**

```typescript
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database.config';

@Global()
@Module({
  imports: [TypeOrmModule.forRootAsync(databaseConfig)],
  exports: [TypeOrmModule],
})
export class ConfigModule {}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/config/
git commit -m "feat: add config module with typeorm and auth config"
```

---

### Task 3: User Entity + Module

**Files:**
- Create: `backend/src/users/entities/user.entity.ts`
- Create: `backend/src/users/users.module.ts`
- Create: `backend/src/users/users.service.ts`
- Create: `backend/src/users/users.controller.ts`
- Create: `backend/src/users/dto/create-user.dto.ts`
- Create: `backend/src/users/dto/update-user.dto.ts`
- Create: `backend/src/users/dto/user-response.dto.ts`

- [ ] **Step 1: Create user entity**

```typescript
// backend/src/users/entities/user.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  email: string;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'simple-enum', enum: UserRole, default: UserRole.VIEWER })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => RefreshToken, (rt) => rt.user)
  refreshTokens: RefreshToken[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 2: Create DTOs**

```typescript
// backend/src/users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

// backend/src/users/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}

// backend/src/users/dto/user-response.dto.ts
import { Exclude } from 'class-transformer';

export class UserResponseDto {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  @Exclude()
  passwordHash: string;
}
```

- [ ] **Step 3: Create users.service.ts**

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
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
    return this.repo.find({ select: ['id', 'email', 'username', 'name', 'role', 'isActive', 'createdAt', 'updatedAt'] });
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
```

- [ ] **Step 4: Create users.controller.ts**

```typescript
import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
```

- [ ] **Step 5: Create users.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/users/
git commit -m "feat: add user module with crud"
```

---

### Task 4: Auth Module (JWT + Register/Login/Refresh)

**Files:**
- Create: `backend/src/auth/auth.module.ts`
- Create: `backend/src/auth/auth.controller.ts`
- Create: `backend/src/auth/auth.service.ts`
- Create: `backend/src/auth/entities/refresh-token.entity.ts`
- Create: `backend/src/auth/dto/login.dto.ts`
- Create: `backend/src/auth/dto/register.dto.ts`
- Create: `backend/src/auth/strategies/jwt.strategy.ts`
- Create: `backend/src/auth/strategies/jwt-refresh.strategy.ts`

- [ ] **Step 1: Create refresh token entity**

```typescript
// backend/src/auth/entities/refresh-token.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tokenHash: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 2: Create auth DTOs**

```typescript
// backend/src/auth/dto/login.dto.ts
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}

// backend/src/auth/dto/register.dto.ts -- same as CreateUserDto, just alias
export { CreateUserDto as RegisterDto } from '../../users/dto/create-user.dto';
```

- [ ] **Step 3: Create auth.service.ts**

```typescript
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    return this.generateTokens(user);
  }

  async register(dto: RegisterDto) {
    return this.usersService.create(dto);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshRepo.findOne({
      where: { tokenHash, revoked: false },
      relations: ['user'],
    });

    if (!stored) throw new UnauthorizedException('Invalid refresh token');
    if (stored.expiresAt < new Date()) {
      await this.refreshRepo.remove(stored);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: revoke old, issue new
    stored.revoked = true;
    await this.refreshRepo.save(stored);

    return this.generateTokens(stored.user);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshRepo.update({ tokenHash }, { revoked: true });
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, username: user.username, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    });

    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefresh);

    await this.refreshRepo.save({
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: { id: user.id, email: user.email, username: user.username, name: user.name, role: user.role },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
```

- [ ] **Step 4: Create JWT strategy**

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    return { id: user.id, email: user.email, username: user.username, name: user.name, role: user.role };
  }
}
```

- [ ] **Step 5: Create JWT refresh strategy**

```typescript
// backend/src/auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key',
    });
  }

  async validate(payload: { sub: string }) {
    return { id: payload.sub };
  }
}
```

- [ ] **Step 6: Create auth.controller.ts**

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @Roles(UserRole.ADMIN)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refreshToken') token: string) {
    return this.authService.refresh(token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body('refreshToken') token: string) {
    return this.authService.logout(token);
  }
}
```

- [ ] **Step 7: Create auth.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/auth/
git commit -m "feat: add auth module with jwt login, register, refresh"
```

---

### Task 5: Common Module (Guards, Decorators, Filters)

**Files:**
- Create: `backend/src/common/guards/jwt-auth.guard.ts`
- Create: `backend/src/common/guards/roles.guard.ts`
- Create: `backend/src/common/decorators/roles.decorator.ts`
- Create: `backend/src/common/decorators/current-user.decorator.ts`
- Create: `backend/src/common/filters/http-exception.filter.ts`

- [ ] **Step 1: Create jwt-auth.guard.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 2: Create roles.guard.ts**

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true; // no roles required = open to authenticated

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

- [ ] **Step 3: Create roles.decorator.ts**

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 4: Create current-user.decorator.ts**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

- [ ] **Step 5: Create http-exception.filter.ts**

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      message: typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse as any).message,
    };

    this.logger.error(`${ctx.getRequest().method} ${ctx.getRequest().url} -> ${status}: ${JSON.stringify(errorBody)}`);

    response.status(status).json(errorBody);
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/common/
git commit -m "feat: add common guards, decorators, and exception filter"
```

---

### Task 6: GIS Module (Upload + Layer Management)

**Files:**
- Create: `backend/src/gis/gis.module.ts`
- Create: `backend/src/gis/gis.controller.ts`
- Create: `backend/src/gis/gis.service.ts`
- Create: `backend/src/gis/entities/gis-layer.entity.ts`
- Create: `backend/src/gis/dto/upload.dto.ts`
- Create: `backend/src/gis/multer.config.ts`

- [ ] **Step 1: Create gis-layer entity**

```typescript
// backend/src/gis/entities/gis-layer.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('gis_layers')
export class GisLayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-json' })
  geojson: Record<string, any>;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ nullable: true })
  originalFilename: string;

  @Column({ nullable: true })
  fileType: string; // 'geojson' | 'shapefile'

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ nullable: true })
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 2: Create upload.dto.ts**

```typescript
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateLayerDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
```

- [ ] **Step 3: Create multer.config.ts**

```typescript
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { BadRequestException } from '@nestjs/common';

const ALLOWED_MIME_TYPES = [
  'application/json',
  'application/geo+json',
  'application/octet-stream', // .shp, .shx, .dbf, .prj
  'application/x-shapefile',
];

export const multerOptions = {
  storage: diskStorage({
    destination: process.env.UPLOAD_DIR || './uploads/gis',
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${uuid()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const allowedExts = ['.geojson', '.json', '.shp', '.shx', '.dbf', '.prj'];
    if (!allowedExts.includes(ext)) {
      cb(new BadRequestException(`Unsupported file type: ${ext}`), false);
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024,
    files: 4, // shapefile upload = up to 4 files
  },
};
```

- [ ] **Step 4: Create gis.service.ts**

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GisLayer } from './entities/gis-layer.entity';
import { CreateLayerDto } from './dto/upload.dto';

@Injectable()
export class GisService {
  constructor(
    @InjectRepository(GisLayer)
    private readonly repo: Repository<GisLayer>,
  ) {}

  async uploadGeoJson(
    file: Express.Multer.File,
    dto: CreateLayerDto,
    userId: string,
  ): Promise<GisLayer> {
    const content = await fs.readFile(file.path, 'utf-8');
    let geojson: Record<string, any>;

    try {
      geojson = JSON.parse(content);
    } catch {
      // ponytail: delete on parse failure
      await fs.unlink(file.path).catch(() => {});
      throw new BadRequestException('Invalid JSON file');
    }

    // Basic GeoJSON validation
    if (!geojson.type || !geojson.features) {
      await fs.unlink(file.path).catch(() => {});
      throw new BadRequestException('File is not valid GeoJSON (missing type or features)');
    }

    const layer = this.repo.create({
      name: dto.name,
      description: dto.description,
      geojson,
      isPublic: dto.isPublic ?? false,
      originalFilename: file.originalname,
      fileType: 'geojson',
      ownerId: userId,
    });

    return this.repo.save(layer);
  }

  async uploadShapefile(
    files: Express.Multer.File[],
    dto: CreateLayerDto,
    userId: string,
  ): Promise<GisLayer> {
    const required = ['.shp', '.shx', '.dbf', '.prj'];
    const extensions = files.map((f) => path.extname(f.originalname).toLowerCase());

    const missing = required.filter((ext) => !extensions.includes(ext));
    if (missing.length > 0) {
      // Cleanup uploaded files
      await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));
      throw new BadRequestException(
        `Missing required Shapefile components: ${missing.join(', ')}`,
      );
    }

    // ponytail: for now store as GeoJSON after parsing
    // Future: store raw shapefile + PostGIS geometry
    // Simple GeoJSON conversion via shapefile npm
    try {
      const { default: openShapefile } = await import('shapefile');
      const shpFile = files.find((f) => path.extname(f.originalname).toLowerCase() === '.shp')!;

      const source = await openShapefile(shpFile.path);
      const features: Record<string, any>[] = [];
      let result = await source.read();
      while (!result.done) {
        features.push(result.value);
        result = await source.read();
      }

      const geojson: Record<string, any> = {
        type: 'FeatureCollection',
        features,
      };

      const layer = this.repo.create({
        name: dto.name,
        description: dto.description,
        geojson,
        isPublic: dto.isPublic ?? false,
        originalFilename: files[0].originalname,
        fileType: 'shapefile',
        ownerId: userId,
      });

      return this.repo.save(layer);
    } catch (err) {
      await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));
      throw new BadRequestException(`Failed to parse Shapefile: ${err.message}`);
    }
  }

  async findAll(userId: string, role: string): Promise<GisLayer[]> {
    if (role === 'admin') {
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    return this.repo.find({
      where: [{ ownerId: userId }, { isPublic: true }],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, role: string): Promise<GisLayer> {
    const layer = await this.repo.findOne({ where: { id } });
    if (!layer) throw new NotFoundException('Layer not found');

    const isOwner = layer.ownerId === userId;
    if (!layer.isPublic && !isOwner && role !== 'admin') {
      throw new NotFoundException('Layer not found');
    }

    return layer;
  }

  async remove(id: string, userId: string, role: string): Promise<void> {
    const layer = await this.repo.findOne({ where: { id } });
    if (!layer) throw new NotFoundException('Layer not found');

    const isOwner = layer.ownerId === userId;
    if (!isOwner && role !== 'admin') {
      throw new NotFoundException('Layer not found');
    }

    await this.repo.remove(layer);
  }
}
```

- [ ] **Step 5: Create gis.controller.ts**

```typescript
import {
  Controller, Get, Post, Delete, Body, Param, UseGuards,
  UseInterceptors, UploadedFile, UploadedFiles, ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { GisService } from './gis.service';
import { CreateLayerDto } from './dto/upload.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { multerOptions } from './multer.config';

@Controller('gis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GisController {
  constructor(private readonly gisService: GisService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @UseInterceptors(FilesInterceptor('files', 4, multerOptions))
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateLayerDto,
    @CurrentUser('id') userId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const ext = files[0].originalname.toLowerCase().split('.').pop();
    if (ext === 'geojson' || ext === 'json') {
      if (files.length > 1) {
        // GeoJSON should be single file, but if only GeoJSON + its aux files, check
        const geoJsonFiles = files.filter((f) => {
          const e = f.originalname.toLowerCase().split('.').pop();
          return e === 'geojson' || e === 'json';
        });
        if (geoJsonFiles.length === 1) {
          return this.gisService.uploadGeoJson(geoJsonFiles[0], dto, userId);
        }
        throw new BadRequestException('Only one GeoJSON file allowed');
      }
      return this.gisService.uploadGeoJson(files[0], dto, userId);
    }

    return this.gisService.uploadShapefile(files, dto, userId);
  }

  @Get('layers')
  findAll(@CurrentUser() user: { id: string; role: string }) {
    return this.gisService.findAll(user.id, user.role);
  }

  @Get('layers/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.gisService.findOne(id, user.id, user.role);
  }

  @Delete('layers/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.gisService.remove(id, user.id, user.role);
  }
}
```

- [ ] **Step 6: Create gis.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { GisController } from './gis.controller';
import { GisService } from './gis.service';
import { GisLayer } from './entities/gis-layer.entity';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';

@Module({
  imports: [
    TypeOrmModule.forFeature([GisLayer]),
    MulterModule.register({
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads/gis',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${uuid()}${ext}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  ],
  controllers: [GisController],
  providers: [GisService],
})
export class GisModule {}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/gis/
git commit -m "feat: add gis module with geojson/shapefile upload"
```

---

### Task 7: Update AuthContext on Frontend

**Files:**
- Modify: `Geosyze-react/src/context/AuthContext.jsx`
- Modify: `Geosyze-react/src/components/login/LoginForm.jsx`

- [ ] **Step 1: Install axios in frontend**

```bash
cd Geosyze-react
npm install axios
```

- [ ] **Step 2: Update AuthContext.jsx**

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext(null);

const API = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const navigate = useNavigate();

  // Add auth interceptor
  useEffect(() => {
    const interceptor = API.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });
    return () => API.interceptors.request.eject(interceptor);
  }, [accessToken]);

  // Check saved session on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem('accessToken');
    const savedRefresh = sessionStorage.getItem('refreshToken');
    if (savedToken && savedRefresh) {
      setAccessToken(savedToken);
      // Decode basic user info from token
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        setUser({ id: payload.sub, username: payload.username, role: payload.role });
      } catch {
        // Token invalid, clear
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
      }
    }
    setLoading(false);
  }, []);

  function login(username, password) {
    return API.post('/auth/login', { username, password })
      .then((res) => {
        const { accessToken: at, refreshToken: rt, user: u } = res.data;
        sessionStorage.setItem('accessToken', at);
        sessionStorage.setItem('refreshToken', rt);
        setAccessToken(at);
        setUser(u);
        navigate('/', { replace: true });
      });
  }

  function logout() {
    const rt = sessionStorage.getItem('refreshToken');
    if (rt) API.post('/auth/logout', { refreshToken: rt }).catch(() => {});
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    setAccessToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, accessToken, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { API };
```

- [ ] **Step 3: Update LoginForm.jsx** (remove hardcoded hint)

```jsx
// Just remove lines 78: <p className={styles.hint}>Demo: <strong>admin</strong>...</p>
// and remove the loading state since it's handled by the promise
```

- [ ] **Step 4: Commit**

```bash
git add Geosyze-react/src/context/AuthContext.jsx Geosyze-react/src/components/login/LoginForm.jsx Geosyze-react/package.json
git commit -m "feat: update frontend auth to use backend api"
```

---

### Task 8: Bootstrap + Seed Data

- [ ] **Step 1: Install dependencies and build**

```bash
cd backend
npm install
npx ts-node src/main.ts  # quick smoke test, expect errors
```

- [ ] **Step 2: Create src/seeds/seed.ts for initial admin user**

```typescript
// backend/src/seeds/seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  try {
    await usersService.create({
      email: 'admin@geosyze.com',
      username: 'admin',
      password: 'admin123',
      name: 'Admin',
      role: UserRole.ADMIN,
    });
    console.log('Admin user created: admin / admin123');
  } catch (err) {
    console.log('Admin user may already exist:', err.message);
  }

  await app.close();
}

seed();
```

- [ ] **Step 3: Create npm script for seed**

Add to package.json scripts:
```json
"seed": "ts-node src/seeds/seed.ts"
```

- [ ] **Step 4: Run seed**

```bash
cd backend
npx ts-node src/seeds/seed.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/seeds/ backend/package.json
git commit -m "feat: add seed script for admin user"
```

---

### Task 9: Verify End-to-End

- [ ] **Step 1: Start backend**

```bash
cd backend
npm run start:dev
```

- [ ] **Step 2: Test login with curl**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Expect: { accessToken, refreshToken, user }
```

- [ ] **Step 3: Test protected route**

```bash
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer <accessToken>"
# Expect: [{ id, email, username, name, role }]
```

- [ ] **Step 4: Test GIS upload**

```bash
curl -X POST http://localhost:3000/api/gis/upload \
  -H "Authorization: Bearer <accessToken>" \
  -F "files=@sample.geojson" \
  -F "name=Test Layer"
# Expect: { id, name, geojson, ... }
```
