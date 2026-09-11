CREATE TRIGGER library_members_touch
AFTER UPDATE ON library_members
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE library_members SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER library_shelf_positions_touch
AFTER UPDATE ON library_shelf_positions
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE library_shelf_positions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER library_books_touch
AFTER UPDATE ON library_books
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE library_books SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER library_decision_opinions_touch
AFTER UPDATE ON library_decision_opinions
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE library_decision_opinions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER library_decision_resolutions_touch
AFTER UPDATE ON library_decision_resolutions
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE library_decision_resolutions SET updated_at = CURRENT_TIMESTAMP WHERE book_id = NEW.book_id;
END;
