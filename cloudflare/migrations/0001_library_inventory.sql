PRAGMA foreign_keys = ON;

CREATE TABLE library_members (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'volunteer' CHECK (role IN ('volunteer','coordinator','admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE library_locations (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE library_shelf_positions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  code TEXT NOT NULL UNIQUE,
  location_code TEXT NOT NULL REFERENCES library_locations(code),
  bookcase_code TEXT NOT NULL,
  shelf_number INTEGER NOT NULL CHECK (shelf_number BETWEEN 1 AND 20),
  sort_order INTEGER NOT NULL,
  assigned_to TEXT REFERENCES library_members(id),
  assigned_at TEXT,
  assigned_by_name TEXT,
  completed_by TEXT REFERENCES library_members(id),
  completed_at TEXT,
  completed_by_name TEXT,
  closing_count INTEGER CHECK (closing_count >= 0),
  closing_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (location_code, bookcase_code, shelf_number)
);

CREATE TABLE library_shelf_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shelf_position_id TEXT NOT NULL REFERENCES library_shelf_positions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'initial' CHECK (kind IN ('initial','control','correction','closing')),
  status TEXT NOT NULL DEFAULT 'counted' CHECK (status IN ('counted','could_not_count','approved','disputed')),
  layout TEXT NOT NULL DEFAULT 'single' CHECK (layout IN ('single','double')),
  front_count INTEGER,
  back_count INTEGER,
  back_unavailable INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER GENERATED ALWAYS AS (coalesce(front_count,0) + CASE WHEN back_unavailable THEN 0 ELSE coalesce(back_count,0) END) STORED,
  note TEXT,
  photo_path TEXT,
  photo_url TEXT,
  legacy_photo_url TEXT,
  counted_by TEXT REFERENCES library_members(id),
  counted_by_name TEXT,
  counted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT REFERENCES library_members(id),
  approved_by_name TEXT,
  approved_at TEXT,
  legacy_source_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE library_boxes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  code TEXT NOT NULL UNIQUE,
  destination TEXT NOT NULL CHECK (destination IN ('new_library','storage')),
  packed_by TEXT REFERENCES library_members(id),
  packed_by_name TEXT,
  packed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);

CREATE TABLE library_books (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  legacy_no INTEGER UNIQUE,
  client_id TEXT UNIQUE,
  shelf_position_id TEXT NOT NULL REFERENCES library_shelf_positions(id),
  position_number INTEGER NOT NULL CHECK (position_number > 0),
  place_code TEXT NOT NULL UNIQUE,
  author TEXT,
  title TEXT,
  publication_year INTEGER,
  copies INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good','worn','mold_or_pest')),
  note TEXT,
  recorded_by TEXT REFERENCES library_members(id),
  recorded_by_name TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  imprint_photo_path TEXT,
  cover_photo_path TEXT,
  legacy_imprint_url TEXT,
  legacy_cover_url TEXT,
  ocr_status TEXT,
  ocr_text TEXT,
  suggested_title TEXT,
  suggested_author TEXT,
  suggested_year INTEGER,
  suggested_publisher TEXT,
  bibliography_approved_by TEXT REFERENCES library_members(id),
  bibliography_approved_by_name TEXT,
  bibliography_approved_at TEXT,
  requested_reason TEXT,
  requested_by TEXT REFERENCES library_members(id),
  requested_by_name TEXT,
  requested_at TEXT,
  box_id TEXT REFERENCES library_boxes(id),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (shelf_position_id, position_number)
);

CREATE TABLE library_decision_opinions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  voter_id TEXT REFERENCES library_members(id),
  voter_name TEXT NOT NULL,
  voter_key TEXT GENERATED ALWAYS AS (lower(trim(voter_name))) STORED,
  choice TEXT NOT NULL CHECK (choice IN ('go','may_go','stay','uncertain')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (book_id, voter_key)
);

CREATE TABLE library_decision_resolutions (
  book_id TEXT PRIMARY KEY REFERENCES library_books(id) ON DELETE CASCADE,
  choice TEXT NOT NULL CHECK (choice IN ('go','may_go','stay','uncertain')),
  kind TEXT NOT NULL CHECK (kind IN ('consensus','single_after_30_days','legacy','manual')),
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_by_names TEXT NOT NULL DEFAULT '[]',
  legacy_rule TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE library_decision_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id TEXT REFERENCES library_members(id),
  actor_name TEXT,
  choice TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE library_contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page TEXT NOT NULL,
  message_type TEXT NOT NULL,
  sender_id TEXT REFERENCES library_members(id),
  sender_name TEXT NOT NULL,
  sender_contact TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '{}',
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','failed')),
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX library_books_shelf_position_idx ON library_books (shelf_position_id, position_number);
CREATE INDEX library_books_bibliography_queue_idx ON library_books (bibliography_approved_at, place_code);
CREATE INDEX library_shelf_counts_position_time_idx ON library_shelf_counts (shelf_position_id, counted_at DESC);
CREATE INDEX library_decision_opinions_book_idx ON library_decision_opinions (book_id, updated_at);
CREATE INDEX library_decision_resolutions_choice_idx ON library_decision_resolutions (choice, decided_at);
CREATE INDEX library_decision_events_book_time_idx ON library_decision_events (book_id, created_at DESC);
