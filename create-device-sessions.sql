-- Create Device Sessions for all users
INSERT INTO device_sessions (id, "userId", "deviceId", "deviceName", "userAgent", "ipAddress", "isTrusted", "lastUsedAt", "createdAt")
SELECT 
  gen_random_uuid()::text,
  id,
  'seed-device-trusted',
  'Seed Device',
  'Seed Script/1.0',
  '127.0.0.1',
  true,
  NOW(),
  NOW()
FROM users;
