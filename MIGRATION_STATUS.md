# Migration Status - Trạng thái Migration

## Tại sao migration mất thời gian?

Migration hiện tại đang tạo **14 indexes** trên các bảng:

- Post: 3 indexes
- Follow: 2 indexes
- UserBlock: 2 indexes
- Comment: 2 indexes
- Like: 2 indexes
- Bookmark: 1 index
- Notification: 2 indexes

### Thời gian ước tính:

- Database nhỏ (< 10k records): 30 giây - 2 phút
- Database vừa (10k - 100k records): 2-5 phút
- Database lớn (> 100k records): 5-15 phút hoặc hơn

## Các lý do migration có thể chậm:

1. **Database có nhiều dữ liệu**: Indexes cần scan toàn bộ bảng để tạo
2. **Kết nối Supabase từ xa**: Network latency
3. **Database đang xử lý queries khác**: Lock conflicts
4. **PostgreSQL tạo indexes một cách an toàn**: Không block table nhưng vẫn mất thời gian

## Giải pháp nếu quá lâu:

### Option 1: Chờ đợi (Khuyến nghị)

Nếu migration đang chạy, hãy đợi thêm. Indexes trên bảng lớn có thể mất 5-10 phút.

### Option 2: Kiểm tra trong Database

Nếu có quyền truy cập Supabase dashboard:

1. Vào Supabase Dashboard
2. Kiểm tra tab "Database" > "Indexes"
3. Xem indexes nào đã được tạo

### Option 3: Tạo indexes từng phần (Nếu cần)

Nếu migration bị lỗi hoặc timeout, có thể tạo indexes thủ công bằng SQL:

```sql
-- Tạo indexes cho Post
CREATE INDEX IF NOT EXISTS "posts_userId_createdAt_idx" ON "posts"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "posts_privacy_createdAt_idx" ON "posts"("privacy", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "posts_createdAt_idx" ON "posts"("createdAt" DESC);

-- Tạo indexes cho Follow
CREATE INDEX IF NOT EXISTS "follows_followerId_idx" ON "follows"("followerId");
CREATE INDEX IF NOT EXISTS "follows_followingId_idx" ON "follows"("followingId");

-- Tạo indexes cho UserBlock
CREATE INDEX IF NOT EXISTS "user_blocks_blockerId_idx" ON "user_blocks"("blockerId");
CREATE INDEX IF NOT EXISTS "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");

-- Tạo indexes cho Comment
CREATE INDEX IF NOT EXISTS "comments_postId_createdAt_idx" ON "comments"("postId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "comments_parentId_idx" ON "comments"("parentId");

-- Tạo indexes cho Like
CREATE INDEX IF NOT EXISTS "likes_postId_idx" ON "likes"("postId");
CREATE INDEX IF NOT EXISTS "likes_userId_idx" ON "likes"("userId");

-- Tạo indexes cho Bookmark
CREATE INDEX IF NOT EXISTS "bookmarks_userId_createdAt_idx" ON "bookmarks"("userId", "createdAt" DESC);

-- Tạo indexes cho Notification
CREATE INDEX IF NOT EXISTS "notifications_recipientId_read_idx" ON "notifications"("recipientId", "read");
CREATE INDEX IF NOT EXISTS "notifications_recipientId_createdAt_idx" ON "notifications"("recipientId", "createdAt" DESC);
```

Sau đó đánh dấu migration là đã hoàn thành:

```bash
npx prisma migrate resolve --applied add_performance_indexes
npx prisma generate
```

## Kiểm tra sau khi migration hoàn thành:

```bash
# Kiểm tra migration status
npx prisma migrate status

# Generate Prisma client
npx prisma generate
```

## Lưu ý:

- **KHÔNG** cancel migration nếu đang chạy - có thể làm database ở trạng thái inconsistent
- Nếu migration bị timeout, có thể tạo indexes thủ công bằng SQL
- Sau khi tạo indexes, queries sẽ nhanh hơn đáng kể
