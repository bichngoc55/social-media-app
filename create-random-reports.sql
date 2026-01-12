-- Create 15 random user reports for posts
-- This script randomly selects users reporting posts from other users

WITH random_posts AS (
  SELECT 
    p.id as post_id,
    p."userId" as reported_user_id,
    u.id as reporter_user_id,
    ROW_NUMBER() OVER (ORDER BY random()) as rn
  FROM posts p
  CROSS JOIN users u
  WHERE p."userId" != u.id  -- Users can't report their own posts
  AND p."userId" NOT IN (
    SELECT "blockedId" FROM user_blocks WHERE "blockerId" = u.id
  )  -- Don't report posts from blocked users
  ORDER BY random()
  LIMIT 100  -- Get enough candidates
),
report_types AS (
  SELECT unnest(ARRAY['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'VIOLENCE', 'NUDITY', 'COPYRIGHT', 'IMPERSONATION', 'OTHER']) as type
),
random_reasons AS (
  VALUES 
    ('This post contains inappropriate content'),
    ('This violates community guidelines'),
    ('Spam or misleading content'),
    ('Harassment or bullying'),
    ('Hate speech or discrimination'),
    ('Violent or graphic content'),
    ('Nudity or sexual content'),
    ('Copyright infringement'),
    ('Impersonation or fake account'),
    ('Offensive or harmful content'),
    ('Misinformation or fake news'),
    ('Scam or fraud attempt'),
    ('Inappropriate language'),
    ('Privacy violation'),
    ('Other policy violation')
)
INSERT INTO reports (id, "reporterId", "reportedId", "postId", type, reason, status, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  rp.reporter_user_id,
  rp.reported_user_id,
  rp.post_id,
  (SELECT type FROM report_types ORDER BY random() LIMIT 1)::"ReportType",
  (SELECT column1 FROM random_reasons ORDER BY random() LIMIT 1),
  (ARRAY['PENDING', 'PENDING', 'PENDING', 'REVIEWED'])[floor(random() * 4 + 1)]::"ReportStatus",  -- Mostly PENDING
  NOW() - (random() * interval '30 days'),  -- Created within last 30 days
  NOW() - (random() * interval '15 days')   -- Updated within last 15 days
FROM random_posts rp
WHERE rp.rn <= 15;

-- Show the created reports
SELECT 
  r.id,
  reporter.username as reporter,
  reported.username as reported_user,
  r.type,
  r.reason,
  r.status,
  r."createdAt"
FROM reports r
JOIN users reporter ON r."reporterId" = reporter.id
JOIN users reported ON r."reportedId" = reported.id
ORDER BY r."createdAt" DESC
LIMIT 15;
