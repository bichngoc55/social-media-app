# Hướng dẫn kiểm tra Indexes

## Cách 1: Kiểm tra qua Supabase Dashboard (Dễ nhất) ✅

1. **Vào Supabase Dashboard** → Database
2. **Click vào tab "Indexes"** (bên cạnh Tables, Functions, etc.)
3. Bạn sẽ thấy danh sách tất cả indexes với:
   - Tên index
   - Bảng (Table)
   - Các cột (Columns)
   - Loại index (B-tree, Hash, etc.)

## Cách 2: Kiểm tra bằng SQL Query

### Query đơn giản - Xem tất cả indexes:

```sql
SELECT
    tablename,
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    schemaname = 'public'
ORDER BY
    tablename, indexname;
```

### Query chi tiết - Kiểm tra indexes performance đã tạo:

```sql
-- Kiểm tra indexes của bảng posts
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'posts';

-- Kiểm tra indexes của bảng follows
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'follows';

-- Kiểm tra indexes của bảng user_blocks
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'user_blocks';

-- Kiểm tra indexes của bảng comments
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'comments';

-- Kiểm tra indexes của bảng likes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'likes';

-- Kiểm tra indexes của bảng bookmarks
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'bookmarks';

-- Kiểm tra indexes của bảng notifications
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'notifications';
```

## Cách 3: Kiểm tra bằng Prisma

### Kiểm tra migration status:

```bash
npx prisma migrate status
```

### Xem migration files đã tạo:

```bash
ls prisma/migrations/
```

## Danh sách indexes cần kiểm tra:

### ✅ Bảng `posts` - Cần có 3 indexes:

- `posts_userId_createdAt_idx` (userId, createdAt DESC)
- `posts_privacy_createdAt_idx` (privacy, createdAt DESC)
- `posts_createdAt_idx` (createdAt DESC)

### ✅ Bảng `follows` - Cần có 2 indexes:

- `follows_followerId_idx` (followerId)
- `follows_followingId_idx` (followingId)

### ✅ Bảng `user_blocks` - Cần có 2 indexes:

- `user_blocks_blockerId_idx` (blockerId)
- `user_blocks_blockedId_idx` (blockedId)

### ✅ Bảng `comments` - Cần có 2 indexes:

- `comments_postId_createdAt_idx` (postId, createdAt DESC)
- `comments_parentId_idx` (parentId)

### ✅ Bảng `likes` - Cần có 2 indexes:

- `likes_postId_idx` (postId)
- `likes_userId_idx` (userId)

### ✅ Bảng `bookmarks` - Cần có 1 index:

- `bookmarks_userId_createdAt_idx` (userId, createdAt DESC)

### ✅ Bảng `notifications` - Cần có 2 indexes:

- `notifications_recipientId_read_idx` (recipientId, read)
- `notifications_recipientId_createdAt_idx` (recipientId, createdAt DESC)

## Tổng cộng: 14 indexes cần được tạo

## Lưu ý:

- Indexes có thể có tên hơi khác tùy theo Prisma naming convention
- Một số indexes có thể đã tồn tại từ trước (unique constraints tự động tạo indexes)
- Schema Visualizer có thể không hiển thị tất cả indexes - cần check tab "Indexes" hoặc dùng SQL
