# Antibiotic Awareness Learning Portal — Full Software

A deployable full-stack university learning portal for antibiotic-awareness education.

## Stack
- Node.js 20+
- Express 5
- SQLite database (better-sqlite3)
- Secure password hashing with bcryptjs
- HTTP-only authentication cookie with JWT
- Media uploads for video/image/PDF
- Faculty/Admin CMS
- Student registration and login
- Quiz engine with persistent attempts
- Learning analytics and event tracking
- Responsive vanilla HTML/CSS/JavaScript frontend

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

The SQLite database is created automatically at `data/antibiotic_awareness.db`.

## Demo accounts
- Admin: `admin@university.edu` / `admin123`
- Student: `student@university.edu` / `student123`

Change these credentials before real university deployment.

## Faculty/Admin capabilities
- Update portal CMS title, subtitle and announcements.
- Publish university videos, external resources, PDFs and images.
- View student/activity analytics.
- View quiz attempts and average score.

## Production checklist
- Set a strong random JWT_SECRET.
- Change/remove seeded demo accounts.
- Put the site behind HTTPS.
- Configure a reverse proxy such as Nginx.
- Back up the SQLite `data` directory, or migrate to PostgreSQL for multi-server deployment.
- Store large media in S3/Cloudinary/Azure Blob rather than local disk.
- Configure institutional email/SSO if required.
- Add privacy/consent and university data-retention policies before collecting real student data.
