# Lumen to Atlas - Stage 9C

This stage implements the TypeScript single-note transfer core, not an import UI,
a complete-backup importer, synchronization, or a real-data import. The Python
contract in Lumen is unchanged. The user approved the `yaml` dependency and
local recovery while keeping existing backup formats unchanged.

## Entry points and responsibilities

- `decodeLumenPackage(Uint8Array)` strictly decodes the original file bytes.
  A private byte copy prevents caller mutation during asynchronous verification.
  JSON is strict UTF-8, without a JSON BOM, at most 2,097,152 bytes.
- Duplicate keys are rejected, including escaped-key equivalents and nested
  origin keys, before object construction. Unknown fields, unsupported versions,
  invalid types, malformed UTF-8, non-scalar Unicode, wrong hashes and incoherent
  Markdown metadata block the package.
- Numeric protocol fields require integer JSON spelling, matching Python's
  distinction between `1` and `1.0`. Supported packages need only integers.
- The separate YAML reader accepts flat scalar/string-list frontmatter, rejects
  aliases, anchors, explicit tags, merge keys, directives, multiple documents,
  duplicate/non-string keys and nested containers. It preserves date strings
  and uses PyYAML-compatible implicit scalar resolution. The full Markdown is
  retained rather than passed to the legacy Markdown reader.
- Source and comparison hashes use Web Crypto SHA-256 and the exact version-1
  binary framing. Length prefixes count UTF-8 bytes, are uint32 big-endian, and
  tags retain their original order. Limits explicitly count UTF-16 units using
  JavaScript `.length`; installed Zod length checks alone are insufficient here.
- `planLumenImport` is a read-only planner. Parsed packages and plans are
  immutable and registered in private WeakSets; unvalidated fabricated objects
  cannot authorize an operation.
- `LumenAtlasRepository` requires an explicitly injected Dexie database. It
  never creates a default production database, seeds examples, reads
  localStorage, or clears drafts. It reuses existing snapshot/model validation
  for consistency, while rejecting stored note fields that would require trim.
- `plan(bytes)` and `execute(plan, { confirmed: true })` are separate.
  `planRestore(operationId)` and `restore(plan, { confirmed: true })` are
  separate as well. These are core gates for a future confirmed interface.

No component, button, route or service connection was added. Existing
`saveNote`, repository interfaces, schema and backup operations were preserved.

## Outcomes and exact transaction scope

| Outcome   | Rule                                                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create    | ID absent, no retained identity/missing update, no candidate, checked draft state, recovery available                                                                   |
| Identical | Known same ID and exact title/ordered tags/full Markdown; no writes or timestamp changes                                                                                |
| Update    | Known ID, current comparison hash equals explicit baseline, title unchanged, no draft/conflict                                                                          |
| Conflict  | Local version/baseline mismatch, changed title, alternate-ID candidate, missing update target, uncertain identity/recovery/draft state, capacity or global-ID collision |

Title keys from Atlas are used only to conservatively block duplicate candidates;
they do not become identity, normalize transferred fields, adopt notes, or repair
links. Exact duplicate content under another ID also blocks creation/update.

Plans contain operation, identity, expected timestamp, a hash of the complete
local record, proposed validated data, changed fields, warnings and conflicts.
Execution replans against fresh state inside the transaction and compares the
complete expected record and operation. Any observed change invalidates the plan.
Two same-target operations serialize; a stale loser cannot overwrite the winner.

Only the selected note and `meta.lumenTransferHistory.v1` are written.
Updates replace transferred tags/content and advance the local revision timestamp.
Title, ID, createdAt, archivedAt, links, isExample and remaining local fields stay
unchanged. Creation uses a local creation timestamp, empty explicit links and
isExample false. The original source date/origin remain unchanged in full YAML.

No task completion, goals, study/focus time, XP, activity, placeholders, automatic
relations, other-note link renaming, external-resource fetch or code execution.
`atlas_action` and empty Markdown Atlas IDs stay passive. Hashes and lifecycle
flags provide neither authentication nor proof of human review.

## Approved local recovery strategy

Storage: one versioned record in the existing Dexie `meta` store, keyed
`lumenTransferHistory.v1`. No table/version migration or Note/Snapshot schema
change. The user explicitly approved this local-only strategy.

Every create/update has a UUID operation ID, integration ID, operation kind,
complete before/after Note records, hashes of those complete records, source,
comparison and package hashes, selected baseline and application timestamp.
Recovery status stores a restoration timestamp and resulting-record hash.
A create has no previous note and cannot be undone through deletion by this core.

The note write and complete recovery entry share one read/write transaction.
Failure storing recovery aborts the note write. Records and hashes are validated
before reuse. The ordinary archive/delete `meta.noteHistory` remains untouched.

Restore requires a separately prepared/confirmed plan and verifies that the
current complete note still equals the recorded after-version. It restores the
previous fields only in that note, retains createdAt/relationships/archive state,
and assigns a fresh updatedAt strictly after the current revision. This deliberate
timestamp change preserves existing stale-editor protection. It marks the entry
restored without deleting before/after history. Missing/tampered history, another
edit or a draft blocks restore. Reapplying a completed restore is rejected.

Retention: at most 100 operations and 20 MiB of encoded recovery JSON, with
reserved space for restoration bookkeeping. Reaching capacity blocks new writes;
there is no automatic pruning or cleanup. Storage quota can be lower: an actual
quota failure aborts the transaction. No physical crash/durability guarantee was
tested. The retained before-version remains local recoverable data, not a log.

## Backup compatibility and loss

Existing JSON/Markdown full backups remain unchanged. They preserve current
note IDs/content but **exclude this recovery record**, just as existing
`meta.noteHistory` is excluded. A backup restored into a fresh database therefore
does not recover old transfer operations, previous versions, or identity evidence;
subsequent updates are blocked as uncertain rather than silently adopted.
Importing a backup into an existing database follows the existing merge behavior.

No portable recovery backup or history migration was implemented. Lost/deleted
browser data or a missing recovery record cannot be automatically reconstructed.
A future history export/restore format needs separate approval and validation.
Different browser origins/profiles have different databases and recovery records.

## Draft and browser boundaries

A synchronous injected guard supplies `checked` and draft IDs. Unknown/failed
checks or a selected-note draft block writes/restoration; guard state is rechecked
during execution. The default guard is unknown, deliberately disabling writes
until a future adapter supplies a checked state.

No real draft store was accessed. Current Atlas drafts live in localStorage,
outside the IndexedDB transaction. The guard can block observed drafts, but cannot
make another tab's localStorage write atomic with the note transaction. A draft
created after the final check remains retained; this core never deletes it.
A future interface must re-read draft state and handle this timing explicitly.

Web Crypto/TextEncoder/TextDecoder support is required. Hash tests ran in
TypeScript with Node Web Crypto; no browser import/two-tab test occurred.
Obsidian path/alias wikilinks remain literal and may not resolve in Atlas's
title-based link resolver. No target is fetched or created.

## Fictional fixtures and tests

The Python example and five hash vectors were copied byte for byte into
`src/lib/lumen-atlas/fixtures`. Additional package cases were generated using
the existing Lumen validator in read-only Python execution with bytecode writes
disabled. No real note or Lumen file was modified.

The 43 Python-reference cases cover accepted/rejected YAML scalar forms,
booleans, dates, quotes, block strings/lists, flow mappings, omitted values,
duplicate keys, forbidden features, BOM/CRLF/Unicode and token boundaries.
These executed cases are interoperability evidence, not proof of all possible
YAML grammar equivalence.

Repository tests use unique fake-indexeddb databases and fictional records.
They exercise creation, identical zero-write reimport, update, all major
conflicts, changed-plan guards, injected drafts, two database connections,
rollback, reopen/recovery, recovery conflicts, retention, unchanged other
entities/undo history, backup limits and absence of input content in diagnostics.

The test runner uses jsdom plus fake-indexeddb. Connections simulate concurrent
repository users; they are not two real browser tabs or manual browser testing.
Injected failures simulate write/rollback failures, not power loss.

## Verification

| Check                           | Executed result                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Baseline, before implementation | 132 tests passed in 6 relevant existing files; 60.08 s                                |
| Focused corrected core run      | 136 tests passed in 4 new files; 13.18 s, before the last boundary/preservation cases |
| Final full Atlas suite          | 1,019 tests passed in 77 files; 307.45 s; no failing/skipped files or tests reported  |
| `npm run lint`                  | Passed, no remaining warnings/errors                                                  |
| `npm run typecheck`             | Passed                                                                                |
| `npm run build`                 | Passed; local Vite build/PWA assets only                                              |
| `git diff --check`              | Passed                                                                                |
| Reference fixture bytes         | Both copied files still exactly match Lumen                                           |
| Existing README/decisions       | Original bytes preserved as a prefix; only Stage 9C text appended                     |
| Dependency scope                | Only `node_modules/yaml` added; no existing package version changed                   |

The final full run includes all five Python hash vectors, 43 executed
Python-reference package cases, and a complete isolated BOM/CRLF/Unicode import
whose reconstructed source SHA-256 matches. The last source change after the
build/typecheck was explanatory lint-comment placement only; validation behavior
did not change.

Development runs exposed a cross-realm byte-array guard, implicit Zod Unicode
length behavior, test-only Node typings, and nested Dexie wait boundaries.
These were corrected without dropping behavioral tests or changing Lumen's
contract. One focused run was explicitly stopped after detecting the nested
wait deadlock; it is not counted as a successful test run. Early fixture/type/lint
failures are not represented as passing checks. A fixture generator's first
attempt stopped before creating a file because its assumed quote style differed
from the actual fictional fixture; it was corrected using that exact fixture.

These results are automated Node/jsdom/fake-indexeddb tests, not browser,
two-tab, visual/manual, physical-storage or real-data verification.
No personal IndexedDB/localStorage, vault note, secret, or real research was read.

Git after this stage: Atlas remains on `main` at `5a113da`, with 4 modified
tracked files and 16 new untracked Stage 9C files; nothing staged/committed.
Lumen's existing unborn `master`/untracked work is retained; no Lumen file was
modified. No vault/skill write, publication, push or deploy.

## Files created and changed

Created:

- `src/lib/lumen-atlas/errors.ts`
- `src/lib/lumen-atlas/strict-json.ts`
- `src/lib/lumen-atlas/hashes.ts`
- `src/lib/lumen-atlas/frontmatter.ts`
- `src/lib/lumen-atlas/package.ts`
- `src/lib/lumen-atlas/plan.ts`
- `src/lib/lumen-atlas/test-fixtures.ts`
- `src/lib/lumen-atlas/package.test.ts`
- `src/lib/lumen-atlas/plan.test.ts`
- `src/lib/lumen-atlas/parity.test.ts`
- `src/lib/lumen-atlas/fixtures/example.lumen-atlas.json`
- `src/lib/lumen-atlas/fixtures/hash-vectors.json`
- `src/lib/lumen-atlas/fixtures/python-package-cases.json`
- `src/data/repositories/lumen-atlas-repository.ts`
- `src/data/repositories/lumen-atlas-repository.test.ts`
- `docs/LUMEN-ATLAS-STAGE9C.md`

Changed:

- `package.json`: approved exact `yaml` 2.9.1 runtime dependency.
- `package-lock.json`: that dependency plus npm's peer-flag metadata adjustments;
  no existing version changed.
- `README.md`: appended transfer-core scope and documentation link.
- `docs/DECISIONS.md`: appended approved protocol/recovery decisions.

Build, dependency and compiler caches are ignored artifacts rather than public
source changes. No existing behavioral test or production repository method was
removed or rewritten. Current database and backup schemas remain unchanged.

Commands from the Atlas project root:

```powershell
npm run test
npm run lint
npm run typecheck
npm run build
```

Focused new suite:

```powershell
npm run test -- src/lib/lumen-atlas src/data/repositories/lumen-atlas-repository.test.ts
```

## Pending authorization and integration work

- Import interface, exact file/version confirmation and draft-store adapter.
- Real-browser persistence, multiple tabs, Web Crypto support and quota tests.
- Portable recovery-history export/restore and lost-state recovery procedures.
- Any real-note/database import, Lumen export UI or delivery receipt.
- Conflict-resolution UI; conflicts currently authorize no mutation.
- No bidirectional synchronization, AI API, backend, automatic deletion or deploy.
