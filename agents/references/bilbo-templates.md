# Bilbo Authoring Templates

Load when writing or updating documentation artifacts. Each section below is a separate template — pull only what the task requires.

---

## Codebase Read Recipe (run before writing)

Never generate documentation from thin air. Read the code you're documenting.

```bash
# Project structure
find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" \
  | grep -v node_modules | grep -v .git | grep -v dist | grep -v .next \
  | head -40

# What public functions and interfaces exist?
grep -rn 'export\s\+\(function\|const\|class\|interface\|type\|async\)' \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git \
  . 2>/dev/null | grep -v test | grep -v spec | head -40

# What API routes exist?
grep -rn '\(router\.\|app\.\)\(get\|post\|put\|patch\|delete\)' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules \
  . 2>/dev/null | grep -v test | grep -v spec | head -30

# What documentation files exist?
find . -name "README*" -o -name "CHANGELOG*" -o -name "CONTRIBUTING*" -o -name "docs/" \
  | grep -v node_modules | grep -v .git

# How complete is the README?
wc -l README.md 2>/dev/null || echo "(no README found)"
```

---

## README Template

A good README takes a stranger from zero to running in five minutes.

```markdown
# Project Name

One sentence. What it is and what problem it solves.

## Tech Stack
- [key technology] — [why]

## Prerequisites
- Node.js 20+
- [any other requirements]

## Installation
\`\`\`bash
git clone ...
cd ...
npm install
cp .env.example .env.local
# Edit .env.local with your values
npm run dev
\`\`\`

## Quickstart
\`\`\`typescript
// Shortest path to doing the thing
\`\`\`

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Random string for session signing |
| `SENTRY_DSN` | No | Error tracking (production only) |

## Project Structure
\`\`\`
src/
  app/        # Next.js App Router pages
  lib/        # Shared utilities
  components/ # UI components
\`\`\`

## Contributing
[How to contribute — branch naming, PR process, what tests to run]

## License
MIT
```

**What makes a README fail:** no installation instructions; assumes knowledge of environment setup; outdated (describes features that don't exist or misses features that do); no example.

---

## Changelog Template

Use [Keep a Changelog](https://keepachangelog.com/) format. Pull from git history and merged PRs.

```bash
# Get recent git history
git log --oneline --no-merges -50 2>/dev/null

# Get commits since last tag
git log $(git describe --tags --abbrev=0 2>/dev/null)..HEAD --oneline 2>/dev/null || git log --oneline -30
```

```markdown
# Changelog

All notable changes are documented here.

## [Unreleased]

### Added
- [feature] — [what it does]

### Fixed
- [bug] — [what was wrong, what was changed]

### Changed
- [existing feature] — [how it changed]

## [1.2.0] - 2026-03-27

### Added
- User authentication via Clerk
- Password reset flow

### Fixed
- Session not invalidated on password change (#42)

### Changed
- API rate limiting increased to 100 requests/minute
```

**Categories:** Added, Changed, Deprecated, Removed, Fixed, Security (security fixes always get their own entry).

**Never write:** "various improvements", "bug fixes", "performance enhancements" without specifics.

---

## Inline Documentation Templates

Every public function, interface, and class deserves a docstring. Complex private functions too.

**TSDoc format:**

```typescript
/**
 * Retrieves a user by their ID.
 *
 * Returns null if the user is not found. Never throws for a missing user —
 * only throws if the database query itself fails.
 *
 * @param userId - The user's unique identifier (UUID format)
 * @returns The user object, or null if not found
 * @throws {DatabaseError} If the database query fails
 *
 * @example
 * const user = await getUser('usr_01HXYZ...');
 * if (!user) {
 *   return notFound();
 * }
 */
export async function getUser(userId: string): Promise<User | null> {
```

**What every docstring must include:** what the function does (one sentence); what makes it different from what you'd naively assume (edge cases, null returns, side effects); parameters with types and constraints; return value; what it throws and when; one usage example for non-trivial functions.

**Python docstring format (Google style):**

```python
def get_user(user_id: str) -> Optional[User]:
    """Retrieve a user by their ID.

    Returns None if the user is not found. Raises DatabaseError
    only if the query itself fails.

    Args:
        user_id: The user's unique identifier.

    Returns:
        The User object, or None if not found.

    Raises:
        DatabaseError: If the database query fails.
    """
```

---

## API Route Documentation Template

For HTTP APIs, a readable endpoints reference in Markdown — not OpenAPI enterprise spec.

```markdown
### POST /api/auth/login

Authenticate a user with email and password. Returns a session token.

**Request**
\`\`\`json
{
  "email": "user@example.com",
  "password": "string"
}
\`\`\`

**Response — 200 OK**
\`\`\`json
{
  "token": "eyJ...",
  "user": { "id": "usr_01HXYZ...", "email": "user@example.com" }
}
\`\`\`

**Errors**
- `400` — Missing email or password
- `401` — Invalid credentials
- `429` — Too many attempts (rate limited)
```

---

## Architecture Overview Template

Plain prose: how is this project organized, and why does it look the way it does? Not an ADR. Not a sequence diagram. A description a new developer could read in fifteen minutes.

```markdown
# Architecture Overview

## What This Is
[One paragraph: the problem and the solution at a high level]

## How It's Organized
[Describe the directory structure in prose. Not just what the folders are named — why they're organized that way]

## Key Flows

### [User authentication]
[Prose description of how auth works — login → session → middleware → protected routes]

### [Data flow]
[How data moves from request to response — validation, database, response shaping]

## Key Decisions
[2-3 decisions that make this codebase look the way it does, and the brief reason why. Not full ADRs — just the one-sentence rationale]

## What's Missing / Known Gaps
[Honest assessment of what isn't done yet]
```
