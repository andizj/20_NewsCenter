-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,            -- placeholder for later auth
  role VARCHAR(50) NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'EMPLOYEE')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TAGS
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MESSAGES (publisher posts message with tags)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role VARCHAR(50) NOT NULL DEFAULT 'ALL',
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MESSAGE_TAGS (many-to-many)
CREATE TABLE message_tags (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, tag_id)
);

-- SUBSCRIPTIONS: users subscribe to tags
CREATE TABLE subscriptions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tag_id)
);

-- Helpful indexes
CREATE INDEX idx_messages_author   ON messages(author_id);
CREATE INDEX idx_message_tags_tag  ON message_tags(tag_id);
CREATE INDEX idx_subscriptions_tag ON subscriptions(tag_id);
