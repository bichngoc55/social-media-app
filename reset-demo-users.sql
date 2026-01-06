-- Reset Demo Users to Original Seeded State
-- This script resets the demo users to their state as defined in seed.ts

DO $$
DECLARE
    user_ban_3_id TEXT;
    user_warn_1_id TEXT;
    user_warn_2_id TEXT;
    admin_id TEXT;
BEGIN
    -- Get admin user ID for recreating warnings
    SELECT id INTO admin_id FROM users WHERE role = 'ADMIN' LIMIT 1;
    
    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'No admin user found. Please ensure an admin user exists.';
    END IF;
    
    -- Get demo user IDs
    SELECT id INTO user_ban_3_id FROM users WHERE username = 'demo-user-ban-3';
    SELECT id INTO user_warn_1_id FROM users WHERE username = 'demo-user-warn-1';
    SELECT id INTO user_warn_2_id FROM users WHERE username = 'demo-user-warn-2';

    -- 1. Delete all UserWarning records for demo users
    DELETE FROM user_warnings 
    WHERE "userId" IN (user_ban_3_id, user_warn_1_id, user_warn_2_id)
    AND "userId" IS NOT NULL;

    -- 2. Delete warning/ban notifications for demo users
    DELETE FROM notifications 
    WHERE "recipientId" IN (user_ban_3_id, user_warn_1_id, user_warn_2_id)
    AND "recipientId" IS NOT NULL
    AND type IN ('WARNING', 'BAN_NOTICE');

    -- 3. Reset demo-user-ban-3 (User A: 3 warnings, banned, last warning 4 days ago)
    IF user_ban_3_id IS NOT NULL THEN
        UPDATE users
        SET 
            "warningCount" = 3,
            "lastWarningAt" = NOW() - INTERVAL '4 days',
            status = false  -- Permanently banned
        WHERE id = user_ban_3_id;

        -- Recreate 3 warnings for User A
        INSERT INTO user_warnings (id, "userId", "issuedBy", message, deadline, "createdAt")
        VALUES 
            (gen_random_uuid()::text, user_ban_3_id, admin_id, 'Warning 1/3: High violation rate detected', NOW() + INTERVAL '68 days', NOW() - INTERVAL '10 days'),
            (gen_random_uuid()::text, user_ban_3_id, admin_id, 'Warning 2/3: Continued policy violations', NOW() + INTERVAL '65 days', NOW() - INTERVAL '7 days'),
            (gen_random_uuid()::text, user_ban_3_id, admin_id, 'Final Warning 3/3: Account permanently banned', NOW() + INTERVAL '68 days', NOW() - INTERVAL '4 days');

        -- Create ban notification for User A
        INSERT INTO notifications (id, "recipientId", "issuerId", type, "createdAt")
        VALUES (gen_random_uuid()::text, user_ban_3_id, admin_id, 'BAN_NOTICE', NOW() - INTERVAL '4 days');
        
        RAISE NOTICE '✅ Reset demo-user-ban-3: 3 warnings, banned';
    ELSE
        RAISE NOTICE '⚠ demo-user-ban-3 not found, skipping';
    END IF;

    -- 4. Reset demo-user-warn-1 (User B: 1 warning, not banned, last warning 5 days ago)
    IF user_warn_1_id IS NOT NULL THEN
        UPDATE users
        SET 
            "warningCount" = 1,
            "lastWarningAt" = NOW() - INTERVAL '5 days',
            status = true  -- Active
        WHERE id = user_warn_1_id;

        -- Recreate 1 warning for User B
        INSERT INTO user_warnings (id, "userId", "issuedBy", message, deadline, "createdAt")
        VALUES 
            (gen_random_uuid()::text, user_warn_1_id, admin_id, 'Warning 1/3: High violation rate detected', NOW() + INTERVAL '67 days', NOW() - INTERVAL '5 days');

        -- Create warning notification for User B
        INSERT INTO notifications (id, "recipientId", "issuerId", type, "createdAt")
        VALUES (gen_random_uuid()::text, user_warn_1_id, admin_id, 'WARNING', NOW() - INTERVAL '5 days');
        
        RAISE NOTICE '✅ Reset demo-user-warn-1: 1 warning, active';
    ELSE
        RAISE NOTICE '⚠ demo-user-warn-1 not found, skipping';
    END IF;

    -- 5. Reset demo-user-warn-2 (User C: 2 warnings, not banned, last warning 3 days ago)
    IF user_warn_2_id IS NOT NULL THEN
        UPDATE users
        SET 
            "warningCount" = 2,
            "lastWarningAt" = NOW() - INTERVAL '3 days',
            status = true  -- Active
        WHERE id = user_warn_2_id;

        -- Recreate 2 warnings for User C
        INSERT INTO user_warnings (id, "userId", "issuedBy", message, deadline, "createdAt")
        VALUES 
            (gen_random_uuid()::text, user_warn_2_id, admin_id, 'Warning 1/3: High violation rate detected', NOW() + INTERVAL '66 days', NOW() - INTERVAL '6 days'),
            (gen_random_uuid()::text, user_warn_2_id, admin_id, 'Warning 2/3: Continued policy violations', NOW() + INTERVAL '69 days', NOW() - INTERVAL '3 days');

        -- Create warning notification for User C
        INSERT INTO notifications (id, "recipientId", "issuerId", type, "createdAt")
        VALUES (gen_random_uuid()::text, user_warn_2_id, admin_id, 'WARNING', NOW() - INTERVAL '3 days');
        
        RAISE NOTICE '✅ Reset demo-user-warn-2: 2 warnings, active';
    ELSE
        RAISE NOTICE '⚠ demo-user-warn-2 not found, skipping';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Demo users reset complete!';
END $$;
