# Database Guidelines (SQLAlchemy models, migrations, queries)

Scope: `backend/app/models/`, `backend/migrations/`, and how services read and write data. HTTP handling, validation and authorization are in [`backend.md`](backend.md). Frontend rules are in [`frontend.md`](frontend.md).

Every guideline has an ID (`DB-xx`) so reviews and the violation report can cite it. Each one has three parts: **Rule**, **Rationale**, **Example**.

---

## DB-01 — Every table has a UUID primary key

**Rule.** Every model declares `id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)`. No auto-increment integer keys. Foreign keys use the same UUID type.

**Rationale.** Sequential integer IDs let anyone guess neighboring records (`/api/boards/41`, `/api/boards/42`). UUIDs can also be generated before insert, which keeps tests and seed data simple.

**Example.**

```python
# backend/app/models/card.py
class Card(db.Model):
    __tablename__ = "cards"
    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
```

```python
id = db.Column(db.Integer, primary_key=True)   # Wrong
```

---

## DB-02 — Every table has timezone-aware `created_at` and `updated_at`

**Rule.** Every model has `created_at` and `updated_at` declared as `db.DateTime(timezone=True)` with `default=lambda: datetime.now(timezone.utc)`; `updated_at` also sets `onupdate`. Every other timestamp column (`completed_at`, `deleted_at`) is also `timezone=True`. `datetime.utcnow()` and naive datetimes are never used.

**Rationale.** A naive timestamp carries no offset, so the browser shows it as local time and "completed this week" is computed against the wrong boundary. `utcnow()` is deprecated since Python 3.12.

**Example.**

```python
def utc_now():
    return datetime.now(timezone.utc)

created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)
updated_at = db.Column(db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
```

```python
created_at = db.Column(db.DateTime, default=datetime.utcnow)   # Wrong: naive and deprecated
```

---

## DB-03 — Positions are stored as a FLOAT `order`, changed one row at a time

**Rule.** Cards in a column and columns in a board are ordered by `order = db.Column(db.Float, nullable=False)`. Moving an item writes one row:

- first item in an empty list: `1024`
- append to the end: `last.order + 1024`
- insert between two items: `(prev.order + next.order) / 2`
- insert at the top: `first.order / 2`

Only when the gap between two neighbors drops below `1e-6` is the whole list renumbered to `1024, 2048, 3072, …`. Never store an integer position, and never renumber every row on each move.

**Rationale.** Integer positions force an `UPDATE` on every following row for each drag, which is slow and causes write conflicts when two users move cards at once.

**Example.**

```python
# Card dropped between two cards with order 1024 and 2048
card.order = (1024 + 2048) / 2      # 1536.0, one UPDATE
```

```python
# Wrong: shifts every card below the drop point
for c in cards_below:
    c.position += 1
```

---

## DB-04 — Cards are soft-deleted, and every card query excludes deleted rows

**Rule.** Deleting a card sets `deleted_at`; the row is never removed. Every query that reads cards filters `Card.deleted_at.is_(None)`, including relationship loads, counts and joins in analytics. Use the shared helper `active_cards()` as the starting point of card queries instead of `Card.query`.

**Rationale.** One query that forgets the filter makes a deleted card reappear, on the board, in My Tasks, in search or in an analytics count. Starting from a helper makes the filter the default instead of something to remember.

**Example.**

```python
# backend/app/models/card.py
def active_cards():
    return db.select(Card).where(Card.deleted_at.is_(None))

# My Tasks
stmt = active_cards().where(Card.assignee_id == user_id)
```

```python
Card.query.filter_by(assignee_id=user_id).all()   # Wrong: includes soft-deleted cards
db.session.delete(card)                           # Wrong: hard delete
```

---

## DB-05 — Every foreign key is indexed and declares its delete behavior

**Rule.** A foreign key column that is filtered or joined on has `index=True`. Every nullable foreign key that points at a row which can be hard-deleted declares `ondelete` explicitly. Parent-to-child ownership uses ORM `cascade="all, delete-orphan"` on the parent's relationship.

**Rationale.** PostgreSQL does not index foreign keys automatically, so "cards assigned to me" becomes a full table scan. A foreign key without `ondelete` turns `DELETE /api/boards/<id>` into an IntegrityError as soon as a notification references the board.

**Example.**

```python
# backend/app/models/notification.py
user_id  = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
board_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("boards.id", ondelete="SET NULL"), nullable=True)
```

```python
board_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("boards.id"))   # Wrong: no ondelete, no index
```

---

## DB-06 — The schema changes only through committed Flask-Migrate migrations

**Rule.** Every model change is followed by `flask db migrate -m "<what changed>"`. The generated file is read, corrected if needed, and committed together with the model change. The database is updated only with `flask db upgrade`. `db.create_all()` and `db.drop_all()` never appear in application code; they are allowed only in test fixtures.

**Rationale.** `db.create_all()` silently skips tables that already exist, so production drifts from the models with no record of what changed. Autogenerate also misses some changes (for example renamed columns), which is why the file is reviewed before commit.

**Example.**

```bash
flask db migrate -m "add is_done to columns"
# review backend/migrations/versions/xxxx_add_is_done_to_columns.py
flask db upgrade
```

```python
# Wrong: in create_app()
with app.app_context():
    db.create_all()
```

---

## DB-07 — No N+1 queries: load related rows eagerly and aggregate in SQL

**Rule.** When a response includes related rows, load them in the same service call with `selectinload` or `joinedload`. Counts and sums are computed with `func.count`, `group_by` and joins in one statement, never by looping over Python objects and querying inside the loop.

**Rationale.** A board with 10 columns loaded lazily runs 11 queries; with comments' authors it grows with every row. This is the difference between meeting and missing the 500 ms target for a 200-card board.

**Example.**

```python
# GET /api/boards/<id>: 3 queries regardless of board size
stmt = (
    db.select(Board)
    .where(Board.id == board_id)
    .options(
        selectinload(Board.columns)
        .selectinload(BoardColumn.cards.and_(Card.deleted_at.is_(None)))
    )
)

# Analytics: cards per column in one query
db.select(BoardColumn.id, BoardColumn.name, func.count(Card.id)) \
  .outerjoin(Card, (Card.column_id == BoardColumn.id) & Card.deleted_at.is_(None)) \
  .where(BoardColumn.board_id == board_id) \
  .group_by(BoardColumn.id)
```

```python
# Wrong: one query per column
for column in board.columns:
    result.append({"name": column.name, "count": len(column.cards)})
```

---

## DB-08 — One service operation is one transaction with a single commit

**Rule.** A service function makes all of its changes on `db.session` and calls `db.session.commit()` once, at the end. Operations that change several rows (rebalancing a column, moving a card and creating its notification, creating a board and its first admin member) commit together or not at all. No `commit()` inside a loop, and no commit in a helper that another service function calls.

**Rationale.** If a rebalance commits row by row and fails halfway, the column is left with a mix of old and new `order` values, and the card order on screen is corrupted.

**Example.**

```python
def create_board(user_id, data):
    board = Board(name=data["name"], owner_id=user_id)
    db.session.add(board)
    db.session.flush()                                   # get board.id without committing
    db.session.add(BoardMember(board_id=board.id, user_id=user_id, role="admin"))
    db.session.commit()                                  # both rows or neither
    return board
```

```python
# Wrong
for i, card in enumerate(cards, start=1):
    card.order = i * 1024
    db.session.commit()
```

---

## DB-09 — Naming: plural snake_case tables, singular classes, named constraints

**Rule.** Table names are plural snake_case (`board_members`); model classes are singular PascalCase (`BoardMember`). The column model is `BoardColumn` with `__tablename__ = "columns"`, never a class called `Column`. Foreign key columns end in `_id`. Unique constraints are given explicit names.

**Rationale.** A class called `Column` shadows SQLAlchemy's own `Column` wherever both are imported. Unnamed constraints get database-generated names, which makes a later migration that drops them fail on a different database.

**Example.**

```python
class BoardMember(db.Model):
    __tablename__ = "board_members"
    __table_args__ = (db.UniqueConstraint("board_id", "user_id", name="uq_board_member"),)
```

```python
class Column(db.Model): ...                                   # Wrong: shadows sqlalchemy.Column
__table_args__ = (db.UniqueConstraint("board_id", "user_id"),)   # Wrong: unnamed
```

---

## DB-10 — Queries are built with the ORM and bound parameters, never string formatting

**Rule.** All queries use SQLAlchemy expressions. User input never goes into SQL through f-strings, `%` formatting or `text()` concatenation. For the title search, the term is passed as a bound parameter to `ilike`, with `%` and `_` in the user's input escaped.

**Rationale.** String-built SQL is an injection hole. An unescaped `%` in a search term matches every card, which looks like a broken search to the user.

**Example.**

```python
def escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

stmt = active_cards().where(Card.title.ilike(f"%{escape_like(q)}%", escape="\\"))
```

```python
# Wrong: SQL injection
db.session.execute(text(f"SELECT * FROM cards WHERE title ILIKE '%{q}%'"))
```
