-- Demo users
INSERT INTO users (email, display_name, password_hash)
VALUES
 ('alice@example.com','Alice','x'),
 ('bob@example.com','Bob','x'),
 ('carol@example.com','Carol','x');

-- Demo tags
INSERT INTO tags (name, description)
VALUES
 ('general','General announcements'),
 ('it','IT updates'),
 ('events','Events & meetups'),
 ('study','Study tips & deadlines');

-- Grab some ids for convenience (works fine in seed scripts)
WITH u AS (SELECT id FROM users ORDER BY created_at LIMIT 3),
     t AS (SELECT id, name FROM tags)
INSERT INTO messages (author_id, title, body)
SELECT (SELECT id FROM u LIMIT 1),
       'Welcome to NewsCenter',
       'This is our first post 🎉'
UNION ALL
SELECT (SELECT id FROM u OFFSET 1 LIMIT 1),
       'Maintenance window',
       'Database maintenance Friday 22:00–23:00'
UNION ALL
SELECT (SELECT id FROM u OFFSET 2 LIMIT 1),
       'Study tips',
       'Remember to check deadlines and subscribe to relevant tags.';

-- Tag the messages (simple example)
INSERT INTO message_tags (message_id, tag_id)
SELECT m.id, t.id
FROM messages m
JOIN tags t ON t.name IN ('general')
WHERE m.title = 'Welcome to NewsCenter';

INSERT INTO message_tags (message_id, tag_id)
SELECT m.id, t.id
FROM messages m
JOIN tags t ON t.name IN ('it')
WHERE m.title = 'Maintenance window';

INSERT INTO message_tags (message_id, tag_id)
SELECT m.id, t.id
FROM messages m
JOIN tags t ON t.name IN ('study')
WHERE m.title = 'Study tips';

-- Subscriptions
INSERT INTO subscriptions (user_id, tag_id)
SELECT u.id, t.id
FROM users u
CROSS JOIN tags t
WHERE (u.email = 'alice@example.com' AND t.name IN ('general','events'))
   OR (u.email = 'bob@example.com'   AND t.name IN ('it'))
   OR (u.email = 'carol@example.com' AND t.name IN ('study'));

-- Example query (keep for docs/reference)
-- SELECT m.title, array_agg(t.name ORDER BY t.name) AS tags
-- FROM messages m
-- JOIN message_tags mt ON mt.message_id = m.id
-- JOIN tags t ON t.id = mt.tag_id
-- GROUP BY m.id, m.title
-- ORDER BY m.created_at DESC;
