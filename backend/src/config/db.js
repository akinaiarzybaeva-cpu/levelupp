import Database from 'better-sqlite3'
import { config } from './config.js'

export const db = new Database(config.databasePath)

db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  payment_url TEXT,
  status TEXT NOT NULL,
  is_activated INTEGER NOT NULL DEFAULT 0,
  provider_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_email ON payment_orders (user_email);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_order_id ON payment_orders (provider_order_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_email TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  purchased_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  order_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  lesson_label TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'published'
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_email TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'User',
  account_status TEXT NOT NULL DEFAULT 'active',
  is_blocked INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_email TEXT PRIMARY KEY,
  email_notifications INTEGER NOT NULL DEFAULT 1,
  new_courses INTEGER NOT NULL DEFAULT 1,
  new_lessons INTEGER NOT NULL DEFAULT 1,
  news_updates INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_email ON user_sessions (user_email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS course_progress (
  user_email TEXT NOT NULL,
  course_id TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  lessons_started INTEGER NOT NULL DEFAULT 0,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_email, course_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_email ON reviews (user_email);
CREATE INDEX IF NOT EXISTS idx_course_progress_user_email ON course_progress (user_email);
CREATE INDEX IF NOT EXISTS idx_course_progress_status ON course_progress (status);
`)

const userProfileColumns = new Set(db.prepare('PRAGMA table_info(user_profiles)').all().map((column) => column.name))
if (!userProfileColumns.has('account_status')) {
  db.exec("ALTER TABLE user_profiles ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'")
}
if (!userProfileColumns.has('is_blocked')) {
  db.exec('ALTER TABLE user_profiles ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0')
}
if (!userProfileColumns.has('role')) {
  db.exec("ALTER TABLE user_profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'User'")
}

const reviewColumns = new Set(db.prepare('PRAGMA table_info(reviews)').all().map((column) => column.name))
if (!reviewColumns.has('moderation_status')) {
  db.exec("ALTER TABLE reviews ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'published'")
}
