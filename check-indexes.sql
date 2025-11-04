-- Kiểm tra tất cả indexes trong database
-- Chạy query này trong Supabase SQL Editor

-- 1. Kiểm tra indexes của tất cả các bảng
SELECT 
    tablename,
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND indexname NOT LIKE 'pg_%'
ORDER BY 
    tablename, indexname;

-- 2. Kiểm tra indexes cụ thể cho từng bảng quan trọng

-- Indexes của bảng posts
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'posts'
ORDER BY indexname;

-- Indexes của bảng follows
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'follows'
ORDER BY indexname;

-- Indexes của bảng user_blocks
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'user_blocks'
ORDER BY indexname;

-- Indexes của bảng comments
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'comments'
ORDER BY indexname;

-- Indexes của bảng likes
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'likes'
ORDER BY indexname;

-- Indexes của bảng bookmarks
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'bookmarks'
ORDER BY indexname;

-- Indexes của bảng notifications
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'notifications'
ORDER BY indexname;

-- 3. Kiểm tra indexes mới được tạo (các indexes performance)
SELECT 
    tablename,
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND (
        indexname LIKE '%userId%createdAt%' OR
        indexname LIKE '%privacy%createdAt%' OR
        indexname LIKE '%createdAt_idx%' OR
        indexname LIKE '%followerId_idx%' OR
        indexname LIKE '%followingId_idx%' OR
        indexname LIKE '%blockerId_idx%' OR
        indexname LIKE '%blockedId_idx%' OR
        indexname LIKE '%postId%createdAt%' OR
        indexname LIKE '%parentId_idx%' OR
        indexname LIKE '%postId_idx%' OR
        indexname LIKE '%userId_idx%' OR
        indexname LIKE '%userId%createdAt%' OR
        indexname LIKE '%recipientId%read%' OR
        indexname LIKE '%recipientId%createdAt%'
    )
ORDER BY tablename, indexname;

