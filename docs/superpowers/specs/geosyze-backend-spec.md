# GeoSyze Backend Specification

## Overview
NestJS modular monolith backend for GeoSyze GIS application with JWT authentication, role-based access control, and GIS file upload capabilities. Database-agnostic via TypeORM (SQLite dev, PostgreSQL/MySQL prod).

---

## Architecture

### Module Structure
```
src/
├── auth/           # JWT auth, guards, strategies, login/refresh/register
├── users/          # User CRUD, roles (admin/editor/viewer), permissions
├── gis/            # GeoJSON/Shapefile upload, validation, layer management
├── common/         # Guards, decorators, pipes, exceptions, decorators
├── config/         # TypeORM DataSource (sqlite|postgres|mysql via env)
└── main.ts         # Bootstrap, validation pipe, Swagger, CORS
```

### Database Abstraction
- **TypeORM DataSource** configured via `DATABASE_TYPE` env (`sqlite` | `postgres` | `mysql`)
- SQLite for dev (`database.sqlite`), PostgreSQL/MySQL for prod via env vars
- TypeORM entities work across dialects; PostGIS extensions added later via migration

---

## Authentication & Authorization

### JWT Strategy
- **Access Token**: 15min expiry, JWT in Authorization header
- **Refresh Token**: 7d expiry, httpOnly cookie + rotation
- **Passport Strategies**: `jwt` (access), `jwt-refresh` (refresh)

### Roles & Permissions (3 Levels)
| Role    | Users | GIS Layers | Admin |
|---------|-------|------------|-------|
| Admin   | CRUD  | CRUD all   | Full  |
| Editor  | Read  | CRUD own   | Read  |
| Viewer  | Read  | Read all   | None  |

### Guards & Decorators
- `@UseGuards(JwtAuthGuard)` - validates access token
- `@Roles('admin', 'editor')` - role-based access
- `@CurrentUser()` - injects current user into controller

---

## API Endpoints

### Auth Module
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | Public | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | Refresh token | Rotate refresh, issue new access |
| POST | `/auth/register` | Admin | Create user (admin only) |

### Users Module
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/users` | Admin | List all users |
| GET | `/users/:id` | Admin, Self | Get user |
| PATCH | `/users/:id` | Admin, Self | Update user (admin: role, self: profile) |
| DELETE | `/users/:id` | Admin | Delete user |

### GIS Module
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/gis/upload` | Editor, Admin | Upload GeoJSON/Shapefile (multipart) |
| GET | `/gis/layers` | All | List layers (paginated, filter by owner) |
| GET | `/gis/layers/:id` | All (owner/admin) | Get layer with GeoJSON |
| DELETE | `/gis/layers/:id` | Editor (own), Admin | Delete layer |

---

## GIS File Handling (Backend)

### Upload Endpoint: `POST /gis/upload`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file` (GeoJSON `.geojson`, `.json`) OR
  - `files[]` (Shapefile: `.shp`, `.shx`, `.dbf`, `.prj` - all required)
  - `name` (string, required)
  - `description` (string, optional)
  - `isPublic` (boolean, default: false)

### Validation
- **GeoJSON**: Parse, validate RFC 7946, sanitize (strip non-geometry properties > 10KB)
- **Shapefile**: Require all 4 files, parse with `shapefile` npm, convert to GeoJSON
- **Size limits**: 50MB per file, 200MB total
- **Storage**: Save GeoJSON to `uploads/gis/` (dev) / S3-compatible (prod), store metadata in DB

### Layer Entity
```typescript
@Entity()
export class GisLayer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ nullable: true }) description: string;
  @Column({ type: 'jsonb' }) geojson: GeoJSON.FeatureCollection;
  @Column({ default: false }) isPublic: boolean;
  @ManyToOne(() => User) owner: User;
  @CreateDateColumn() createdAt: Date;
}
```

---

## Database Schema (TypeORM Entities)

### User Entity
```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column() passwordHash: string;
  @Column() name: string;
  @Column({ type: 'enum', enum: UserRole, default: UserRole.VIEWER }) role: UserRole;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

### RefreshToken Entity (for rotation/revocation)
```typescript
@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) tokenHash: string;
  @ManyToOne(() => User) user: User;
  @Column() expiresAt: Date;
  @Column({ default: false }) revoked: boolean;
  @CreateDateColumn() createdAt: Date;
}
```

---

## Configuration (Environment Variables)

```env
# App
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Database (switch via DATABASE_TYPE)
DATABASE_TYPE=sqlite
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=geosyze
SQLITE_PATH=./database.sqlite

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
MAX_TOTAL_SIZE=209715200

# Future: PostGIS
# POSTGIS_ENABLED=false
```

---

## Frontend Integration

### AuthContext Updates
- Replace hardcoded login with `POST /auth/login`
- Store access token in memory, refresh token in httpOnly cookie
- Auto-refresh on 401, redirect to login on refresh failure
- Add `Authorization: Bearer <token>` to API calls

### ProtectedRoute
- Check `user` from AuthContext
- Redirect to `/login` if not authenticated

### API Client
- Axios instance with baseURL, interceptors for auth header + 401 refresh

---

## Security

- **Passwords**: bcrypt (12 rounds)
- **JWT**: HS256, short expiry, rotation
- **CORS**: Restrict to `FRONTEND_URL`
- **Helmet**: Security headers
- **Rate limiting**: `@nestjs/throttler` (100 req/min auth, 1000 req/min general)
- **File upload**: Type validation, size limits, sanitization
- **SQL Injection**: TypeORM parameterized queries

---

## Future Extensibility

| Feature | Preparation |
|---------|-------------|
| PostGIS | TypeORM `geometry` column type, migration ready |
| S3/MinIO | Abstract storage provider in GisModule |
| WebSockets | Gateway module for real-time collaboration |
| Microservices | Module boundaries ready for extraction |
| RBAC expansion | Role enum + guard extensible |

---

## Development Setup

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

- SQLite DB auto-created at `./database.sqlite`
- Swagger UI at `http://localhost:3000/api`
- Uploads at `./uploads/gis/`

---

## Testing Strategy

- **Unit**: Services, guards, pipes (Jest)
- **Integration**: Auth flow, GIS upload (Testcontainers SQLite)
- **E2E**: Full auth + GIS flow (Supertest)
- **Coverage**: 80%+ target