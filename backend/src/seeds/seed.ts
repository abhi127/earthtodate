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
    console.log('✓ Admin user created: admin / admin123');
  } catch (err: any) {
    console.log('Admin user may already exist:', err.message);
  }

  try {
    await usersService.create({
      email: 'editor@geosyze.com',
      username: 'editor',
      password: 'editor123',
      name: 'Editor',
      role: UserRole.EDITOR,
    });
    console.log('✓ Editor user created: editor / editor123');
  } catch (err: any) {
    console.log('Editor user may already exist:', err.message);
  }

  try {
    await usersService.create({
      email: 'viewer@geosyze.com',
      username: 'viewer',
      password: 'viewer123',
      name: 'Viewer',
      role: UserRole.VIEWER,
    });
    console.log('✓ Viewer user created: viewer / viewer123');
  } catch (err: any) {
    console.log('Viewer user may already exist:', err.message);
  }

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
