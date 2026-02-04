# CLAUDE.md

## Project: Noiseless

An algorithmic RSS feed reader that feels like a social feed, powered by RSS/Atom. Ships with a curated catalog of feeds. Users pick interests, get a personalized ranked feed, and their reactions continuously adapt the ranking.

**Hosting target:** Vercel

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) + TypeScript |
| Database | Vercel Postgres |
| ORM | Prisma |
| Auth | Auth.js with Email magic link (Resend) |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Background jobs | Vercel Cron → `/api/cron/*` routes |

---

## North Star

A high-signal reading feed that:
- stays open (RSS/Atom sources)
- is personalized (explicit interests + implicit feedback)
- avoids rage/slop mechanics by design
- allows community expansion via suggestions + moderation

---

## MVP Scope

### Must-have
1. Auth + user profile
2. Onboarding: pick topics
3. Pre-installed feed catalog (seeded)
4. RSS/Atom ingestion with dedupe
5. Personalized ranked feed with embeddings
6. Feedback actions: Like / Dislike / Subscribe / Hide
7. Public Sources Directory (no login required)
8. Suggest a Source flow (moderation queue)
9. Impression + interaction logging
10. Minimal admin tooling

### Nice-to-have (post-MVP)
- Private feeds per user
- Full-text extraction / reader mode
- Mute keywords/topics
- Weekly digest email
- Upvotes on suggestions
- Learning-to-Rank model

### Non-goals
- Social graph
- Comments
- Ads
- Heavy ML pipelines

---

## Core Screens

| Route | Access | Purpose |
|-------|--------|---------|
| `/sources` | Public | Browse all sources, search, filter by topic. Logged-out: "Log in to subscribe". Logged-in: toggle subscriptions. |
| `/onboarding` | Authed | Pick interest topics |
| `/feed` | Authed | Ranked article feed with actions |
| `/subscriptions` | Authed | Manage subscribed sources |
| `/admin/suggestions` | Admin | Review pending suggestions |

Default home: `/sources` for logged-out, `/feed` for logged-in.

---

## Data Model

### Core Entities

```prisma
model User {
  id                   String   @id @default(cuid())
  email                String   @unique
  createdAt            DateTime @default(now())
  onboardingCompletedAt DateTime?
  lastActiveAt         DateTime?
}

model Topic {
  id        String   @id @default(cuid())
  slug      String   @unique  // e.g. "ai"
  label     String             // e.g. "AI"
  createdAt DateTime @default(now())
}

model FeedSource {
  id             String    @id @default(cuid())
  title          String
  url            String    @unique  // RSS/Atom URL
  siteUrl        String?
  description    String?
  language       String?
  isPreinstalled Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  lastFetchedAt  DateTime?
  lastFetchStatus String?
  etag           String?
  lastModified   String?
}

model FeedSourceTopic {
  feedSourceId String
  topicId      String
  confidence   Float?  @default(1.0)
  @@id([feedSourceId, topicId])
}

model Article {
  id           String    @id @default(cuid())
  feedSourceId String
  title        String
  url          String
  guid         String?
  author       String?
  publishedAt  DateTime
  fetchedAt    DateTime  @default(now())
  summary      String?
  createdAt    DateTime  @default(now())
  
  @@unique([feedSourceId, guid])
  @@unique([feedSourceId, url])
}
```

### User State

```prisma
model UserTopicWeight {
  userId    String
  topicId   String
  weight    Float     @default(0)
  updatedAt DateTime  @updatedAt
  @@id([userId, topicId])
}

model UserSourceSubscription {
  userId       String
  feedSourceId String
  createdAt    DateTime @default(now())
  @@id([userId, feedSourceId])
}

model UserSourceAffinity {
  userId       String
  feedSourceId String
  weight       Float     @default(0)
  updatedAt    DateTime  @updatedAt
  @@id([userId, feedSourceId])
}
```

### Embeddings (Best Practice)

```prisma
model ArticleText {
  articleId     String   @id
  extractedText String
  language      String?
  extractedAt   DateTime @default(now())
}

model ArticleEmbedding {
  articleId String   @id
  /// pgvector column. Prisma ORM does not yet have a first-class VECTOR type, so represent it as Unsupported.
  /// Use custom migrations to: (1) CREATE EXTENSION vector; (2) set column to vector(<DIM>); (3) add HNSW/IVFFlat index.
  embedding Unsupported("vector")?
  model     String   // embedding model identifier (also implies dimension)
  createdAt DateTime @default(now())
}

model UserEmbedding {
  userId    String   @id
  /// Store as Float[] for easy updates in Prisma; cast to vector in SQL when querying pgvector.
  /// (Alternatively store as Unsupported("vector") and update via raw SQL.)
  embedding Float[]
  model     String
  version   Int      @default(1)
  updatedAt DateTime @updatedAt
}
```

### Event Logging (Critical)

```prisma
model ImpressionEvent {
  id               String   @id @default(cuid())
  userId           String
  articleId        String
  feedRequestId    String   // UUID per feed request
  sessionId        String?
  position         Int
  algorithmVersion String
  candidateSources Json     // e.g. ["VECTOR","SUBSCRIBED","TRENDING"]
  shownAt          DateTime @default(now())
  
  @@index([userId, shownAt])
  @@index([articleId])
  @@unique([userId, feedRequestId, articleId]) // makes impression logging idempotent
}

model InteractionEvent {
  id        String   @id @default(cuid())
  userId    String
  articleId String
  type      InteractionType
  value     Int?     // e.g. dwell seconds
  createdAt DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([articleId])
}

enum InteractionType {
  OPEN
  DWELL
  LIKE
  DISLIKE
  HIDE
  SAVE
  SUBSCRIBE_SOURCE
  UNSUBSCRIBE_SOURCE
}
```

### Suggestions

```prisma
model FeedSuggestion {
  id               String           @id @default(cuid())
  url              String
  title            String?
  note             String?
  status           SuggestionStatus @default(PENDING)
  suggestedByUserId String?
  createdAt        DateTime         @default(now())
  reviewedByUserId String?
  reviewedAt       DateTime?
  reviewNote       String?
  parsedMeta       Json?
  
  @@unique([url, status])  // Prevent duplicate pending suggestions
}

enum SuggestionStatus {
  PENDING
  APPROVED
  REJECTED
}

model FeedSuggestionTopic {
  suggestionId String
  topicId      String
  @@id([suggestionId, topicId])
}
```

### Computed Stats (Optional)

```prisma
model ArticleStats {
  articleId    String   @id
  impressions  Int      @default(0)
  opens        Int      @default(0)
  likes        Int      @default(0)
  saves        Int      @default(0)
  ctr          Float?
  qualityScore Float?
  updatedAt    DateTime @updatedAt
}
```

---

## Recommender System

### Architecture Overview

```
1. Track events (impressions + interactions)
2. Represent content with embeddings
3. Generate candidates (vector + subscriptions + trending + explore)
4. Rank candidates (heuristic → LTR later)
5. Re-rank with constraints (diversity, freshness, source caps)
6. Explore (inject novelty so system keeps learning)
```

**Core principle:** Always log impressions. Without impressions you can't learn, debug, or train models.

### Content Embeddings

Compute embedding for each article from `title + summary` (minimum) or `title + extractedText` (best).

Benefits:
- Per-article relevance even when source posts off-topic content
- Semantic dedupe (near-duplicates via cosine similarity)
- Similarity-based diversity (MMR)

### User Taste Vector

Maintain a user embedding updated after interactions.

**Interaction weights:**
| Event | Weight |
|-------|--------|
| SAVE | +3.0 |
| LIKE | +2.0 |
| OPEN (dwell ≥60s) | +1.5 |
| OPEN (dwell 10–60s) | +1.0 |
| OPEN (dwell <10s) | +0.2 |
| DISLIKE | -2.0 |
| HIDE | -3.0 |

**Update rule (EMA):**
```
U = user embedding, E = article embedding, w = weight, lr = 0.05

if w > 0: U := normalize((1 - lr) * U + lr * w * E)
if w < 0: U := normalize((1 - lr) * U - lr * |w| * E)
```

**Cold start:** Initialize from average embeddings of onboarding-selected topics' recent articles + trending content.

### Candidate Generation

Build candidate set (~500–2000 items) from:

| Source | Description |
|--------|-------------|
| VECTOR | Nearest neighbors to user embedding (recent 7–30 days). **Important:** use `ORDER BY embedding <=> $queryVector LIMIT k` (distance operator) so pgvector can use the ANN index; compute similarity score after retrieval. |
| SUBSCRIBED | Recent articles from subscribed sources |
| TRENDING | Globally high-engagement items |
| EXPLORE | Random-but-good items from adjacent space |

**Always filter:**
- Hidden articles
- Already shown recently (or heavy penalty)
- Hard cap on article age (e.g. 30 days)

### Ranking

**Feature set:**
```
Relevance:    sim = cosine(userEmbedding, articleEmbedding)
Source:       sourceAff, subscribed (0/1)
Freshness:    fresh = exp(-ageHours / τ), τ ~ 24–72
Quality:      qualityScore, sourceQuality
Novelty:      penalty if similar to recently shown
Seen:         seenPenalty (0/1)
```

**Heuristic scoring (baseline):**
```
score = 1.5 * sim
      + 0.8 * fresh
      + 0.6 * subscribed
      + 0.4 * sourceAff
      + 0.3 * qualityScore
      - 1.0 * seenPenalty
      - 0.5 * repetitionPenalty
```

### Re-ranking with Constraints

**Hard constraints:**
- Source cap: max 2 items per source in top 20
- Duplicate cap: block near-duplicates (cosine > 0.95)

**MMR-based diversity:**
```
λ = 0.7–0.9 (relevance weight)

MMR(a) = λ * score(a) - (1-λ) * max_{s∈Selected} cosine(E(a), E(s))
```

**Algorithm:**
```typescript
function rerank(candidates: Article[], pageSize: number): Article[] {
  const selected: Article[] = [];
  
  while (selected.length < pageSize && candidates.length > 0) {
    let best = null;
    let bestVal = -Infinity;
    
    for (const a of candidates) {
      if (violatesHardConstraints(a, selected)) continue;
      
      const diversityPenalty = selected.length === 0 
        ? 0 
        : Math.max(...selected.map(s => cosine(a.embedding, s.embedding)));
      
      const val = LAMBDA * a.score - (1 - LAMBDA) * diversityPenalty;
      
      if (val > bestVal) {
        bestVal = val;
        best = a;
      }
    }
    
    if (best) {
      selected.push(best);
      candidates = candidates.filter(c => c.id !== best.id);
    } else {
      break;
    }
  }
  
  return selected;
}
```

**Freshness guarantee:** Ensure ≥X items in top 20 are <24h old.

### Exploration

Rate: 10–20% of feed items.

Every N items, inject one exploration item from:
- New/newly approved sources
- Topics adjacent to user embedding
- Trending items not yet seen

Exploration items must pass a quality floor.

### Topic Weight Updates (Fallback)

When embeddings unavailable, update topic weights:

```typescript
// On LIKE
for (const topicId of articleTopics) {
  weight[topicId] = clamp(weight[topicId] + 0.2, -3, 3);
}

// On DISLIKE/HIDE
for (const topicId of articleTopics) {
  weight[topicId] = clamp(weight[topicId] - 0.2, -3, 3);
}
```

---

## API Contracts

### Public
```
GET  /api/sources/public          → sources + topics (no auth)
```

### Auth
```
GET  /api/me                      → current user
POST /api/onboarding              → { topicSlugs: string[] }
```

### Feed
```
GET  /api/feed?cursor=...         → ranked items + pagination
POST /api/feed/impression         → log impression batch
```

### Interactions
```
POST /api/articles/:id/like
POST /api/articles/:id/dislike
POST /api/articles/:id/hide
POST /api/articles/:id/open       → { dwellSeconds?: number }
POST /api/articles/:id/save
```

### Sources
```
GET  /api/sources                 → catalog + subscription state
POST /api/sources/:id/subscribe
POST /api/sources/:id/unsubscribe
```

### Suggestions
```
POST /api/suggestions             → { url, topicSlugs, title?, note? }
GET  /api/suggestions/mine        → user's suggestions
```

### Admin
```
GET  /api/admin/suggestions?status=PENDING
POST /api/admin/suggestions/:id/approve
POST /api/admin/suggestions/:id/reject
```

Admin gating via `ADMIN_EMAILS` env var.

---

## Ingestion

### Seed Catalog

Ship `data/feeds.json`:
```json
[
  { "title": "...", "url": "...", "siteUrl": "...", "topics": ["ai", "robotics"] }
]
```

### Cron Strategy (Serverless-safe)

Route: `/api/cron/ingest` (every 5–10 min)

**Security:** Configure `CRON_SECRET` in Vercel. Vercel will send it as `Authorization: Bearer <CRON_SECRET>` to cron routes.
Your cron handlers must verify this header and return `401` if it’s missing/invalid.


Each run:
1. Select batch of ~25 sources (oldest `lastFetchedAt` first)
2. Fetch with conditional GET (etag/last-modified)
3. Parse with `rss-parser`
4. Upsert new articles (dedupe by guid or url)
5. Update `lastFetchedAt` and status

### Additional Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `/api/cron/ingest` | 5–10 min | Fetch RSS feeds |
| `/api/cron/embeddings` | Hourly | Compute embeddings for new articles |
| `/api/cron/stats` | Hourly | Update ArticleStats aggregates |
| `/api/cron/cleanup` | Daily | Prune old impressions, decay user vectors |

---

## Security

### URL Validation (Suggestions)

- Only allow `http://` and `https://`
- Reject: `localhost`, `127.0.0.1`, `0.0.0.0`, `169.254.169.254`
- Reject private ranges: `10.*`, `192.168.*`, `172.16-31.*`
- Fetch timeout: 10s
- Response size limit: 5MB
- Rate limit: 10 suggestions/user/day

### Moderation

- Suggestions require approval before ingestion
- Public directory shows only approved + preinstalled sources

---

## Project Structure

```
/
├── app/
│   ├── feed/
│   ├── sources/
│   ├── onboarding/
│   ├── admin/suggestions/
│   └── api/
│       ├── feed/
│       ├── sources/
│       ├── suggestions/
│       ├── admin/
│       └── cron/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── data/
│   └── feeds.json
├── lib/
│   ├── rank.ts
│   ├── embeddings.ts
│   ├── ingest/
│   │   ├── ingestBatch.ts
│   │   ├── parseFeed.ts
│   │   └── validateUrl.ts
│   └── db.ts
├── components/
│   ├── feed/
│   ├── sources/
│   └── ui/
└── tests/
    ├── rank.test.ts
    └── ingest.test.ts
```

---

## Implementation Order

1. Scaffold Next.js + Tailwind + shadcn/ui
2. DB + Prisma schema (all tables)
3. Seed topics + preinstalled feeds
4. Auth (Auth.js + Resend)
5. Public Sources Directory (`/sources`)
6. Onboarding flow
7. Ingestion cron + batch processing
8. Feed ranking (heuristic first)
9. Impression + interaction logging
10. Interactions endpoints + optimistic UI
11. Suggest Source flow + admin review
12. Embeddings pipeline (upgrade ranking)
13. Debug UX ("Why am I seeing this?")

---

## Definition of Done (MVP)

- [ ] Anyone can browse `/sources` without login
- [ ] Logged-in user can complete onboarding
- [ ] Ranked feed displays with Like/Dislike/Subscribe/Hide
- [ ] Interactions adapt recommendations
- [ ] All feed items log impressions
- [ ] User can suggest new sources
- [ ] Admin can approve/reject suggestions
- [ ] Approved sources begin ingesting on next cron

---

## Seed Topics

```
ai, robotics, biology, neuroscience, security, programming,
startups, math, design, geopolitics, economics, climate, hardware, data
```

---

## Coding Guidelines

- Keep ranking logic in `lib/rank.ts` with tests
- All write endpoints must be idempotent
- Cursor pagination only (no offset)
- Dedupe articles rigorously (guid → url fallback)
- Ingest in small batches (serverless time limits)
- Log `algorithmVersion` on every impression for A/B testing
- Suggestion flow validates feeds before storing

---

## Debug UX (Recommended)

Add "Why am I seeing this?" on each feed item:
- Similarity score bucket (high/med/low)
- "Because you subscribed to X"
- "Because you liked Y"
- "Trending today"
- "Exploring new sources"

This builds trust and reduces "random algo" complaints.
