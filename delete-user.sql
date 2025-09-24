-- Xóa user và tất cả dữ liệu liên quan
-- Thay đổi user_id ở đây

-- 1. Xóa likes
DELETE FROM "Like" WHERE "userId" = '3oadg4i2f5wldpsr';

-- 2. Xóa comments  
DELETE FROM "Comment" WHERE "userId" = '3oadg4i2f5wldpsr';

-- 3. Xóa bookmarks
DELETE FROM "Bookmark" WHERE "userId" = '3oadg4i2f5wldpsr';

-- 4. Xóa follows
DELETE FROM "Follow" WHERE "followerId" = '3oadg4i2f5wldpsr' OR "followingId" = '3oadg4i2f5wldpsr';

-- 5. Xóa posts
DELETE FROM "Post" WHERE "userId" = '3oadg4i2f5wldpsr';

-- 6. Xóa email verifications
DELETE FROM "EmailVerification" WHERE "userId" = '3oadg4i2f5wldpsr';

-- 7. Xóa device sessions
DELETE FROM "DeviceSession" WHERE "userId" = '3oadg4i2f5wldpsr';

-- 8. Xóa two factor auths
DELETE FROM "TwoFactorAuth" WHERE "userId" = '3oadg4i2f5wldpsr';

-- 9. Cuối cùng xóa user
DELETE FROM "User" WHERE "id" = '3oadg4i2f5wldpsr';
