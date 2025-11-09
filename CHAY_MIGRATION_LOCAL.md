# Hướng dẫn chạy Migration trên Database Local

## Bước 1: Khởi động PostgreSQL Local

### Option A: Dùng Docker Compose (Khuyến nghị)

```bash
# Start PostgreSQL container
docker-compose up -d

# Kiểm tra container đang chạy
docker ps
```

### Option B: Cài đặt PostgreSQL trực tiếp

Nếu không dùng Docker, cài PostgreSQL và tạo database.

## Bước 2: Cấu hình DATABASE_URL cho Local

Tạo file `.env.local` hoặc cập nhật `.env` với connection string cho local:

```env
# Database Local (Docker Compose)
DATABASE_URL="postgresql://loopy:loopy@localhost:5433/loopydb?schema=public"

# Hoặc nếu dùng PostgreSQL trực tiếp:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/social_media_db?schema=public"
```

## Bước 3: Chạy Migration trên Local

```bash
# Reset database và apply tất cả migrations (nếu cần)
npx prisma migrate reset

# Hoặc chỉ apply migrations mới
npx prisma migrate dev --name add_performance_indexes

# Generate Prisma Client
npx prisma generate
```

## Bước 4: Kiểm tra Indexes đã được tạo

```bash
# Kiểm tra migration status
npx prisma migrate status

# Hoặc mở Prisma Studio để xem database
npx prisma studio
```

## Lưu ý:

1. **Backup**: Nếu có data quan trọng, backup trước khi reset
2. **Environment**: Đảm bảo `.env.local` được load trước `.env`
3. **Port**: Docker Compose dùng port `5433` (không phải `5432`)
4. **Database**: Tên database mặc định là `loopydb`

## Troubleshooting:

### Nếu lỗi connection:

```bash
# Kiểm tra container đang chạy
docker ps | grep postgres

# Xem logs
docker-compose logs postgres

# Restart container
docker-compose restart postgres
```

### Nếu cần seed data:

```bash
npx prisma db seed
```
