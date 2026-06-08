/**
 * Seed a throwaway Fish Notes profile with realistic demo data for screenshots.
 *
 * Run with Electron's node (matching better-sqlite3's ABI), NOT system node:
 *   SEED_DB=/tmp/fish-notes-demo/fish-notes.db npx electron scripts/seed-demo.cjs
 *
 * Safe by design: only writes to the path in $SEED_DB. Never touches your real DB.
 */
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const dbPath = process.env.SEED_DB;
if (!dbPath) {
  console.error('SEED_DB env var is required (absolute path to the demo fish-notes.db)');
  process.exit(1);
}
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Full final schema (mirrors src/main/database/index.ts after all migrations),
// so the app's initDatabase() finds everything present and skips migrations.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    content_text TEXT NOT NULL DEFAULT '',
    content_format TEXT NOT NULL DEFAULT 'markdown',
    content_html_legacy TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_trashed INTEGER NOT NULL DEFAULT 0,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_locked INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    parent_id TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
  );
  CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title, content, content=notes, content_rowid=rowid
  );
  DROP TRIGGER IF EXISTS notes_ai;
  DROP TRIGGER IF EXISTS notes_ad;
  DROP TRIGGER IF EXISTS notes_au;
  CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content_text);
  END;
  CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content_text);
  END;
  CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content_text);
    INSERT INTO notes_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content_text);
  END;
`);

// Start clean so re-running the seed is idempotent.
sqlite.exec('DELETE FROM note_tags; DELETE FROM notes; DELETE FROM tags;');
sqlite.exec("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')");

// Lightweight Markdown -> plain text for content_text (FTS + list preview).
function strip(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+\[[ x]\]\s+/gim, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^-{3,}$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Tags: full-path names; parents must exist for the sidebar tree to nest. ---
const tagDefs = [
  { name: 'Work', pinned: false },
  { name: 'Work/Meetings', pinned: false },
  { name: 'Work/Projects', pinned: false },
  { name: 'Personal', pinned: false },
  { name: 'Personal/Travel', pinned: false },
  { name: 'Reading', pinned: false },
  { name: 'Ideas', pinned: true },
];
const tagId = {};
const insTag = sqlite.prepare('INSERT INTO tags (id, name, parent_id, is_pinned) VALUES (?, ?, ?, ?)');
for (const t of tagDefs) {
  const id = crypto.randomUUID();
  tagId[t.name] = id;
  const parent = t.name.includes('/') ? tagId[t.name.split('/').slice(0, -1).join('/')] ?? null : null;
  insTag.run(id, t.name, parent, t.pinned ? 1 : 0);
}

// --- Notes ---  (created/updated as "YYYY-MM-DD HH:MM:SS", recent-looking)
const notes = [
  {
    title: 'Weekend Hike · Eighteen Peaks Loop 🏔️',
    pinned: true,
    tags: ['Personal/Travel'],
    date: '2026-06-07 21:14:00',
    content: `# Weekend Hike · Eighteen Peaks Loop 🏔️

> Packing the night before. **Bring a headlamp** — no signal at the summit, download the route offline.

About *16 km* total with 1,200 m of elevation gain. Afternoon showers possible, so aim to be heading down before 3 PM.

## Itinerary

| Time  | Place         | Notes              |
| :---- | :------------ | :----------------- |
| 06:30 | North Gate    | Gear check, depart |
| 08:00 | Trailhead     | Stretch, hydrate   |
| 11:30 | Summit Saddle | Lunch, photos      |
| 15:00 | Loop End      | Descend, drive back|

## Packing List

- [x] Hiking boots + wool socks
- [x] Shell jacket (windproof)
- [ ] Headlamp + spare batteries
- [ ] 2L water + trail snacks

## Pace Estimate

\`\`\`ts
// Rough time estimate (Naismith's rule)
function estimateHours(distanceKm, ascentM) {
  return Math.round((distanceKm / 5 + ascentM / 600) * 10) / 10;
}
estimateHours(16, 1200); // → 5.2 hours
\`\`\`

Route reference: [AllTrails · Eighteen Peaks Loop](https://www.alltrails.com)`,
  },
  {
    title: 'Product Weekly · Jun 5',
    pinned: false,
    tags: ['Work/Meetings'],
    date: '2026-06-05 15:40:00',
    content: `# Product Weekly · Jun 5

Attendees: Product, Design, Frontend, Backend

## Decisions

1. **Search revamp** scope freezes this week; development starts Monday.
2. Mobile layout pushed to next iteration — stabilize desktop first.
3. Design to deliver a first prototype of the new onboarding flow.

## Action Items

- [x] Sync the spec to the team space
- [ ] @Alex draft the search API design
- [ ] @Mia onboarding mockups by Thursday
- [ ] Benchmark \`FTS5\` performance on large datasets

> Next meeting: Thu Jun 12, 2:00 PM`,
  },
  {
    title: 'Fish Notes — Roadmap Ideas',
    pinned: false,
    tags: ['Work/Projects', 'Ideas'],
    date: '2026-06-04 10:22:00',
    content: `# Fish Notes — Roadmap Ideas

After migrating the editor from TinyMCE to **CodeMirror 6**, a few directions worth pursuing:

## Short term

- Slash commands (\`/\` opens an insert menu)
- Backlinks via \`[[Note Title]]\`
- Outline view (TOC generated from headings)

## Mid term

- Highlight matched snippets in full-text search
- Note version history (built on \`diff\`)

## Quick comparison

| Aspect         | TinyMCE  | CodeMirror 6 |
| -------------- | -------- | ------------ |
| Bundle size    | Large    | Small        |
| Customizability| Moderate | High         |
| Markdown       | Indirect | Native       |

> Source-as-you-see means cleaner exports — and friendlier input for AI.`,
  },
  {
    title: 'Reading Notes · Flow',
    pinned: false,
    tags: ['Reading'],
    date: '2026-06-02 22:05:00',
    content: `# Reading Notes · *Flow*

> "The best moments usually occur when a person's body or mind is stretched to its limits." — Mihaly Csikszentmihalyi

## Conditions for flow

1. Clear goals
2. Immediate feedback
3. Challenge and skill are **well matched**

Too hard breeds anxiety, too easy breeds boredom — flow lives in the narrow band between.

## Applying it to work

- Break big tasks into chunks with a clear output
- Reduce interruptions (notifications off, time blocks)
- Pick a difficulty that's just out of reach`,
  },
  {
    title: 'Kyoto · 5-Day Draft',
    pinned: false,
    tags: ['Personal/Travel'],
    date: '2026-05-30 19:30:00',
    content: `# Kyoto · 5-Day Draft 🍁

## Day 1 · Higashiyama

- Kiyomizu-dera → Ninenzaka/Sannenzaka → Yasaka Shrine
- Evening: stroll through Gion

## Day 2 · Arashiyama

- [x] Book the Sagano scenic railway
- Bamboo Grove, Togetsukyo Bridge
- Tenryu-ji Temple

## Day 3 · Fushimi & Uji

- Fushimi Inari Shrine (go early, fewer crowds)
- Uji matcha 🍵

## Budget

| Item      | Est. (¥) |
| --------- | -------: |
| Lodging   |   60,000 |
| Transport |   15,000 |
| Food      |   40,000 |`,
  },
  {
    title: 'Scratchpad · Random Thoughts',
    pinned: false,
    tags: ['Ideas'],
    date: '2026-06-06 08:12:00',
    content: `# Scratchpad · Random Thoughts

- A notes app isn't about having the most features — it's the **open-and-write** smoothness.
- Maybe add a "Today" view that gathers everything created/edited today.
- Would color-coded tags help, or just add clutter?
- Make the lock icon on encrypted notes more obvious.

> Capture first, judge later.`,
  },
  {
    title: 'Weekly Review',
    pinned: false,
    tags: ['Work'],
    date: '2026-06-06 18:00:00',
    content: `# Weekly Review

## Shipped

- Finished all CodeMirror toolbar buttons + shortcuts
- One-click table formatting (CJK-aware column widths)

## Carried over

- Synced scrolling jitters on very long docs — investigate next week

## Next week

1. Cut the first Release and add download links
2. Add screenshots to the README`,
  },
];

const insNote = sqlite.prepare(`
  INSERT INTO notes (id, title, content, content_text, content_format, content_html_legacy,
                     created_at, updated_at, is_trashed, is_pinned, is_locked)
  VALUES (@id, @title, @content, @content_text, 'markdown', '', @date, @date, 0, @pinned, 0)
`);
const insNoteTag = sqlite.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)');

for (const n of notes) {
  const id = crypto.randomUUID();
  insNote.run({
    id,
    title: n.title,
    content: n.content,
    content_text: strip(n.content),
    date: n.date,
    pinned: n.pinned ? 1 : 0,
  });
  for (const tn of n.tags) {
    insNoteTag.run(id, tagId[tn]);
  }
}

const noteCount = sqlite.prepare('SELECT COUNT(*) c FROM notes').get().c;
const tagCount = sqlite.prepare('SELECT COUNT(*) c FROM tags').get().c;
console.log(`Seeded ${noteCount} notes and ${tagCount} tags into ${dbPath}`);
sqlite.close();
process.exit(0);
