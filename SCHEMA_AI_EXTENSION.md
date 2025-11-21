# 🗄️ Schema Extension cho AI Recommendations

## 📋 Tổng quan

Đã mở rộng Prisma schema với 2 models mới để hỗ trợ AI recommendations:

1. **UserAIMetrics** - Cache metrics cho performance
2. **UserRecommendation** - Store recommendations đã tính toán

---

## 🆕 Models mới

### 1. UserAIMetrics

**Mục đích:** Cache các metrics của user để tránh tính toán lại mỗi lần.

**Fields:**

- `totalPosts`, `totalLikes`, `totalComments` - Engagement metrics
- `totalFollowers`, `totalFollowing` - Social metrics
- `postsLast30Days`, `postsLast7Days` - Activity metrics
- `isActiveLast7Days`, `lastPostDate` - Recency metrics
- `topHashtags` - Top 10 hashtags user sử dụng
- `hashtagCounts` - JSON map của hashtag -> count
- `engagementRate`, `avgLikesPerPost`, `avgCommentsPerPost` - Quality scores

**Indexes:**

- `userId` (unique)
- `updatedAt` (để query users cần update)

### 2. UserRecommendation

**Mục đích:** Store recommendations đã tính toán để cache và reuse.

**Fields:**

- `recommendedToId` - User sẽ thấy recommendation này
- `recommendedUserId` - User được recommend
- `score` - AI recommendation score (0-100)
- `reason` - Lý do recommend (optional)
- `metadata` - JSON với thông tin bổ sung (hashtags, mutual connections, etc.)
- `expiresAt` - Khi recommendation này hết hạn

**Indexes:**

- `(recommendedToId, score)` - Sort by score
- `(recommendedToId, expiresAt)` - Filter expired
- `expiresAt` - Cleanup expired recommendations

---

## 🔄 Migration

Để apply schema changes:

```bash
npx prisma migrate dev --name add_ai_recommendations
```

Hoặc tạo migration manually:

```bash
npx prisma migrate dev --create-only --name add_ai_recommendations
# Review migration file
npx prisma migrate dev
```

---

## 📊 Usage Examples

### 1. Update UserAIMetrics

```typescript
// Calculate và update metrics
const metrics = await calculateUserMetrics(userId);
await prisma.userAIMetrics.upsert({
  where: { userId },
  create: {
    userId,
    ...metrics,
  },
  update: metrics,
});
```

### 2. Store Recommendations

```typescript
// Store recommendations sau khi tính toán
await prisma.userRecommendation.createMany({
  data: recommendations.map((rec) => ({
    recommendedToId: userId,
    recommendedUserId: rec.userId,
    score: rec.score,
    reason: rec.reason,
    metadata: rec.metadata,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  })),
});
```

### 3. Get Cached Recommendations

```typescript
// Lấy recommendations đã cache
const recommendations = await prisma.userRecommendation.findMany({
  where: {
    recommendedToId: userId,
    expiresAt: { gt: new Date() },
  },
  orderBy: { score: "desc" },
  take: 5,
  include: {
    recommendedUser: {
      select: getUserDataSelect(userId, true),
    },
  },
});
```

### 4. Cleanup Expired Recommendations

```typescript
// Xóa recommendations đã hết hạn
await prisma.userRecommendation.deleteMany({
  where: {
    expiresAt: { lt: new Date() },
  },
});
```

---

## 🎯 Benefits

1. **Performance:** Cache metrics và recommendations để tránh tính toán lại
2. **Scalability:** Có thể batch update metrics và recommendations
3. **Flexibility:** JSON fields cho metadata linh hoạt
4. **Maintainability:** Tách biệt AI logic khỏi core models

---

## 🔧 Next Steps

1. ✅ Schema đã được mở rộng
2. ⏳ Tạo migration
3. ⏳ Implement service để update metrics
4. ⏳ Implement service để generate và cache recommendations
5. ⏳ Update API routes để sử dụng cached data

---

## 📝 Notes

- `UserAIMetrics` nên được update định kỳ (cron job hoặc background worker)
- `UserRecommendation` có thể expire sau 24h để đảm bảo freshness
- Có thể thêm background job để cleanup expired recommendations
