Express + MongoDB migration starter for AI Verse

Quick start:

1. Copy `.env.example` to `.env` and set `MONGO_URI`.
2. Install dependencies and run:

```bash
cd migrate/backend
npm install
npm run dev
```

API endpoints (examples):
- `GET /api/quizzes/:id`
- `POST /api/quizzes/:quizId/sessions` (body: `{ user, team? }`)
- `GET /api/sessions/:sessionId/draft`
- `POST /api/sessions/:sessionId/draft` (body: `{ answers, clientTimestamp }`)
- `POST /api/sessions/:sessionId/submit` (body: `{ answers, isAutoSubmitted }`)

 Auth / JWT:
 - `POST /auth/token` (body: `{ user: { uid, email, displayName } }`) returns `{ token }` for dev usage.
 - `POST /auth/exchange` (body: `{ idToken }`) exchanges Firebase ID token for local JWT (recommended)
 
 Migration:
- Set `GOOGLE_APPLICATION_CREDENTIALS` to your Firebase service account JSON.
- Run migration to copy Firestore collections into MongoDB:

```bash
npm run migrate
```

Notes:
- The `/sessions/:sessionId/submit` endpoint is protected by JWT. Use `/auth/token` to get a demo token (replace with a real auth flow for production).
- For production, verify Firebase ID tokens or implement a proper auth provider instead of the demo `/auth/token`.
