# Performance Optimizations - Tối ưu hóa hiệu suất

## Các tối ưu hóa đã thực hiện

### 1. ✅ Tối ưu Database Queries

- **Vấn đề**: Các API routes (`/api/posts/for-you`, `/api/posts/following`) thực hiện nhiều queries riêng biệt (blocked users, following users, posts)
- **Giải pháp**: Sử dụng `Promise.all()` để chạy các queries song song, giảm thời gian chờ đợi từ sequential sang parallel
- **File đã sửa**:
  - `src/app/api/posts/for-you/route.ts`
  - `src/app/api/posts/following/route.ts`

### 2. ✅ Tối ưu Image Loading

- **Vấn đề**: Images được load với `unoptimized` flag, không tận dụng Next.js Image Optimization
- **Giải pháp**:
  - Bỏ `unoptimized` flag
  - Thêm `loading="lazy"` để lazy load images
  - Thêm `sizes` attribute để responsive image loading
- **File đã sửa**: `src/components/posts/Post.tsx`

### 3. ✅ Thêm Database Indexes

- **Vấn đề**: Thiếu indexes cho các queries thường dùng, dẫn đến full table scans
- **Giải pháp**: Thêm indexes cho:
  - `Post`: `[userId, createdAt]`, `[privacy, createdAt]`, `[createdAt]`
  - `Follow`: `[followerId]`, `[followingId]`
  - `UserBlock`: `[blockerId]`, `[blockedId]`
  - `Comment`: `[postId, createdAt]`, `[parentId]`
  - `Like`: `[postId]`, `[userId]`
  - `Bookmark`: `[userId, createdAt]`
  - `Notification`: `[recipientId, read]`, `[recipientId, createdAt]`
- **File đã sửa**: `prisma/schema.prisma`

## Các bước tiếp theo

### 1. Chạy Database Migration

Sau khi thêm indexes vào schema, bạn cần chạy migration:

```bash
npx prisma migrate dev --name add_performance_indexes
```

Hoặc nếu đang ở production:

```bash
npx prisma migrate deploy
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Kiểm tra Performance

Sau khi apply migrations, bạn có thể:

- Kiểm tra query performance trong database
- Sử dụng Prisma Studio để xem indexes: `npx prisma studio`
- Monitor database queries trong production

## Các tối ưu hóa có thể thực hiện thêm (tùy chọn)

### 1. Database Query Optimization

- Xem xét sử dụng `select` thay vì `include` ở một số nơi để giảm data transfer
- Sử dụng aggregation queries cho counts thay vì `_count`

### 2. React Query Optimization

- Tăng `staleTime` cho các queries ít thay đổi
- Sử dụng `keepPreviousData` cho pagination
- Implement query prefetching

### 3. Image Optimization

- Sử dụng Next.js Image Optimization với custom domains
- Implement progressive image loading
- Consider using WebP format

### 4. Caching Strategy

- Implement Redis caching cho blocked/following users (nếu có Redis)
- Sử dụng Next.js caching cho static data
- Consider using React Query với longer staleTime

## Metrics để theo dõi

Sau khi apply các optimizations, bạn nên theo dõi:

- API response time (đặc biệt là `/api/posts/for-you` và `/api/posts/following`)
- Database query execution time
- Time to First Byte (TTFB)
- Largest Contentful Paint (LCP)
- First Input Delay (FID)

## Lưu ý

- Indexes sẽ tăng tốc độ read queries nhưng có thể làm chậm write operations một chút
- Cần monitor database size vì indexes chiếm thêm storage
- Trong môi trường production, nên test migrations trên staging trước
