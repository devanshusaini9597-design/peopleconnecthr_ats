# Environment / secrets (Fix 1)

## What is protected
- `.gitignore` ignores all `.env` / `.env.local` files
- Husky pre-commit blocks staging of `.env` files
- Your **local** `backend/.env` (MongoDB connection, etc.) is **left intact** on purpose so the app keeps connecting

## What you must do outside the repo (manual)
1. If these files were ever committed/shared, **rotate** MongoDB password, JWT_SECRET, Vercel OIDC, etc.
2. Never commit `.env` — only update `.env.example` with placeholders

This project copy may not have a `.git` folder; when you init/push a remote, confirm `.env` is not tracked.
