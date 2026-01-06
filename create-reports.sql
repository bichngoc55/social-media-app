-- Create Post Reports (15 reports targeting harmful posts)
WITH harmful_posts AS (
  SELECT mc."postId", mc."userId"
  FROM moderation_cases mc
  WHERE mc."postId" IS NOT NULL 
    AND mc.status IN ('QUEUED', 'IN_REVIEW')
  LIMIT 25
),
report_data AS (
  SELECT 
    hp."postId",
    hp."userId" as "reportedId",
    (SELECT id FROM users ORDER BY random() LIMIT 1) as "reporterId",
    (ARRAY['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'VIOLENCE', 'NUDITY', 'OTHER'])[floor(random() * 6 + 1)] as reason,
    (ARRAY['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'])[floor(random() * 4 + 1)] as status,
    NOW() - (floor(random() * 30) || ' days')::interval as "createdAt",
    row_number() OVER () as rn
  FROM harmful_posts hp
  LIMIT 15
)
INSERT INTO reports (id, "reporterId", "reportedId", "postId", type, reason, status, "adminNotes", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  "reporterId",
  "reportedId",
  "postId",
  reason::"ReportType",
  reason,
  status::"ReportStatus",
  CASE WHEN rn % 3 = 0 THEN 'Reviewed and found to violate guidelines' ELSE NULL END,
  "createdAt",
  "createdAt"
FROM report_data;

-- Create User Reports (8 reports)
WITH user_pairs AS (
  SELECT 
    u1.id as "reporterId",
    u2.id as "reportedId",
    (ARRAY['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'VIOLENCE', 'NUDITY', 'OTHER'])[floor(random() * 6 + 1)] as reason,
    (ARRAY['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'])[floor(random() * 4 + 1)] as status,
    NOW() - (floor(random() * 30) || ' days')::interval as "createdAt",
    row_number() OVER () as rn
  FROM users u1
  CROSS JOIN LATERAL (
    SELECT id 
    FROM users u2 
    WHERE u2.id != u1.id 
    ORDER BY random() 
    LIMIT 1
  ) u2
  LIMIT 8
)
INSERT INTO reports (id, "reporterId", "reportedId", type, reason, status, "adminNotes", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  "reporterId",
  "reportedId",
  reason::"ReportType",
  reason,
  status::"ReportStatus",
  CASE WHEN rn % 2 = 0 THEN 'User behavior reviewed' ELSE NULL END,
  "createdAt",
  "createdAt"
FROM user_pairs;
