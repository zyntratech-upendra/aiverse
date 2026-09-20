# AI Verse Backend API

Express + MongoDB Atlas + Cloudinary backend architecture for AI Verse.

## Quick Start:

1. Copy `.env.example` to `.env` and configure `MONGO_URI`, `JWT_SECRET`, and Cloudinary keys:
   ```env
   MONGO_URI=mongodb+srv://...
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```

2. Install dependencies and start server:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

## Production Cluster:
Run with Node.js cluster mode for maximum CPU utilization and concurrent traffic handling:
```bash
npm run start:cluster
```

## Key API Endpoints:
- `GET /api/albums` - Public gallery photo albums (cached)
- `POST /api/upload` - Secure Cloudinary media upload (images/videos)
- `GET /api/events` - Events catalog
- `GET /api/registrations` - Participant registrations
- `GET /api/users` - User directory and team members
- `GET /api/quizzes` - Quizzes & challenges
- `POST /api/contacts` - Contact & inquiries
