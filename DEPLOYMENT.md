# Deployment Guide: Vercel + Neon PostgreSQL

This guide walks you through deploying the Clio AI Legal Practice Management application to Vercel with a Neon PostgreSQL database.

## Prerequisites

- GitHub account with the repository pushed
- Vercel account (free tier works)
- Neon account (free tier works)

---

## Step 1: Create a Neon Database

1. **Sign up for Neon**
   - Go to [https://console.neon.tech](https://console.neon.tech)
   - Sign up with GitHub, Google, or email

2. **Create a new project**
   - Click "New Project"
   - Name: `clio-ai` (or your preferred name)
   - Region: Choose the closest to your users (e.g., `US East (N. Virginia)`)
   - PostgreSQL version: `16` (latest)
   - Click "Create Project"

3. **Get your connection strings**
   - After creation, you'll see the connection details
   - You need TWO connection strings:

   **Pooled connection (for DATABASE_URL):**
   ```
   postgresql://username:password@ep-xxx-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   Note the `-pooler` in the hostname.

   **Direct connection (for DIRECT_URL):**
   ```
   postgresql://username:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   No `-pooler` in the hostname.

4. **Copy both connection strings** - you'll need them for Vercel

---

## Step 2: Push Your Code to GitHub

1. **Initialize git** (if not already done)
   ```bash
   cd C:\Dev\clio-ai
   git init
   ```

2. **Create a .gitignore** (if not exists)
   Make sure these are in your `.gitignore`:
   ```
   node_modules
   .env
   .env.local
   .next
   ```

3. **Commit and push**
   ```bash
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/clio-ai.git
   git push -u origin main
   ```

---

## Step 3: Connect to Vercel

1. **Sign up/Login to Vercel**
   - Go to [https://vercel.com](https://vercel.com)
   - Sign in with GitHub (recommended for easy repo access)

2. **Import your project**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Find and select your `clio-ai` repository
   - Click "Import"

3. **Configure the project**
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `apps/web`
     - Click "Edit" next to Root Directory
     - Enter: `apps/web`
   - **Build Command**: Leave as default (uses package.json)
   - **Output Directory**: Leave as default

---

## Step 4: Set Environment Variables in Vercel

Before deploying, add these environment variables:

1. **In the Vercel project settings**, expand "Environment Variables"

2. **Add each variable** (click "Add" after each):

   | Name | Value | Environment |
   |------|-------|-------------|
   | `DATABASE_URL` | `postgresql://...pooler...` (your Neon pooled URL) | Production, Preview, Development |
   | `DIRECT_URL` | `postgresql://...` (your Neon direct URL) | Production, Preview, Development |
   | `NEXTAUTH_SECRET` | Generate with: `openssl rand -base64 32` | Production, Preview, Development |
   | `NEXTAUTH_URL` | `https://your-app.vercel.app` | Production only |

   **To generate NEXTAUTH_SECRET:**
   ```bash
   # On Mac/Linux:
   openssl rand -base64 32

   # On Windows (PowerShell):
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
   ```

3. **Click "Deploy"**

---

## Step 5: Run Database Migrations

After the first deploy, you need to push the database schema to Neon:

### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Link your project**
   ```bash
   cd C:\Dev\clio-ai
   vercel link
   ```

3. **Pull environment variables**
   ```bash
   vercel env pull apps/web/.env.local
   ```

4. **Run migrations**
   ```bash
   cd apps/web
   npx prisma db push
   ```

### Option B: Manual (using Neon connection string)

1. **Create a temporary .env.neon file** in `apps/web/`:
   ```
   DATABASE_URL="your-neon-pooled-connection-string"
   DIRECT_URL="your-neon-direct-connection-string"
   ```

2. **Run the migration**
   ```bash
   cd apps/web
   npx dotenv -e .env.neon -- prisma db push
   ```

3. **Delete the temporary file**
   ```bash
   rm .env.neon
   ```

---

## Step 6: Create an Initial User

Since authentication requires a user in the database, create one:

### Using Prisma Studio (Recommended)

1. **Open Prisma Studio** with your Neon connection:
   ```bash
   cd apps/web
   # With Vercel env pulled:
   npx prisma studio

   # Or with direct env:
   DATABASE_URL="your-neon-url" npx prisma studio
   ```

2. **Add a user** in the User table:
   - email: `admin@example.com`
   - name: `Admin`
   - passwordHash: Generate using bcrypt (see below)

### Generate a password hash

```javascript
// Run in Node.js REPL (node)
const bcrypt = require('bcryptjs');
bcrypt.hash('your-password', 10).then(console.log);
```

Or use an online bcrypt generator (for testing only).

---

## Step 7: Verify Deployment

1. **Visit your Vercel URL**
   - Format: `https://your-project.vercel.app`
   - Or check the Vercel dashboard for the URL

2. **Test the application**
   - Try logging in with your created user
   - Create a client, matter, etc.
   - Check the trust accounting features

---

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon pooled connection string (for Prisma queries) | Yes |
| `DIRECT_URL` | Neon direct connection string (for migrations) | Yes |
| `NEXTAUTH_SECRET` | Secret for JWT signing (min 32 chars) | Yes |
| `NEXTAUTH_URL` | Your production URL | Yes (prod) |

---

## Troubleshooting

### "PrismaClientInitializationError"
- Check that `DATABASE_URL` is correctly set in Vercel
- Ensure it's the **pooled** connection string (has `-pooler` in hostname)

### "NEXTAUTH_URL" errors
- Make sure `NEXTAUTH_URL` matches your Vercel deployment URL exactly
- Include `https://`

### Build fails with Prisma errors
- Ensure `prisma generate` runs during build (already configured in package.json)
- Check that `DIRECT_URL` is set for migrations

### Database connection timeout
- Neon free tier has cold starts; first request may be slow
- Consider enabling "Always On" in Neon settings for production

---

## Local Development

To switch back to local Docker PostgreSQL:

1. **Start Docker PostgreSQL**
   ```bash
   cd C:\Dev\clio-ai
   docker-compose up -d
   ```

2. **Update .env** in `apps/web/`:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/clio_ai?schema=public"
   DIRECT_URL="postgresql://postgres:postgres@localhost:5432/clio_ai?schema=public"
   ```

3. **Push schema to local database**
   ```bash
   cd apps/web
   npx prisma db push
   ```

4. **Run the dev server**
   ```bash
   pnpm dev
   ```

---

## Updating After Deployment

When you push changes to GitHub:
1. Vercel automatically redeploys
2. For schema changes, run `prisma db push` manually after deploy
3. Or set up a CI/CD pipeline with `prisma migrate deploy`
