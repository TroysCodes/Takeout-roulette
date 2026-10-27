# Takeout Roulette

Can't decide what to eat? Spin for a local, independent takeout spot in Hamilton, Dundas, Stoney Creek, Binbrook, Ancaster or Waterdown. Every listed place is rated 4.0+ on Google, or is a brand-new spot.

## What's where

- `public/index.html` is the whole app: Spin, My lists, Explore and Map. Each visitor's lists, visits and ratings are saved in their own browser.
- `public/places.json` lists the restaurants. Edit this file to add or remove a place.
- `public/admin.html` (served at `/admin`) is the owner page. It's password protected and has two tabs: **Email sign-ups** and **Reviews** (ratings, comments, stats and a CSV download).
- `api/signup.js` saves an email from the Spin pop-up.
- `api/signups.js` returns the sign-ups, but only with the admin password.
- `api/review.js` saves a diner's rating and optional comment, and `api/reviews.js` returns all of them, without ids, for the restaurant cards. Reviews live in their own Redis hash (`reviews`), separate from the email sign-ups (`signups`). Each browser gets a random anonymous id, and only its latest rating per restaurant counts.

## Deploy on Vercel (one time)

1. Go to vercel.com/new, import this GitHub repo and press **Deploy**. No build settings are needed.
2. In the project, open **Storage**, then **Create / Connect Database**, then **Upstash for Redis** (the free plan is fine), and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to the project.
3. In **Settings**, then **Environment Variables**, add `ADMIN_PASSWORD` with a long password that only the owner knows.
4. Open **Deployments**, then **Redeploy**, so the new settings take effect.

Every push to `main` goes live automatically after that.
