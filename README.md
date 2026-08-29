# NiroLife MVP

NiroLife is the healthcare website-generator product by SeRankPro. The current MVP is a static, hosting-ready prototype: `index.html` contains the marketing site and generator, while `preview.html` renders the generated practice website.

Verified healthcare professionals can also request a Free Live Website. The request enters the `verification_review` workflow, an administrator confirms business authority, contact details and public content, and the application publishes an indexable server-rendered page at `/sites/:slug`. Unverified previews remain `noindex` and cannot use the public route.

## Current flow

1. A visitor completes the generator form.
2. The practice details are saved in browser storage for the prototype.
3. A personalised preview is rendered at `preview.html`.

## Next Hostinger integration

The initial persistence layer is defined in `database/schema.sql`. When the Node.js app is deployed to Hostinger Cloud Professional, connect it to the Hostinger MySQL database and replace browser storage with authenticated API routes.

Recommended implementation order:

1. Add email/password authentication.
2. Save a practice record and website record after form submission.
3. Add a dashboard for editing practice information.
4. Publish websites from the `websites.slug` field.
5. Add admin moderation before public indexing.
6. Add Razorpay subscriptions after the free flow is proven.

Never store patient medical records in this first product. Keep provider and practice information separate from any future patient system.

## Running on Hostinger Cloud Professional

Connect the project to a GitHub repository and deploy it as a Node.js web app. Set these environment variables in hPanel (never commit them): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Run `database/schema.sql` once in Hostinger phpMyAdmin, then start the app with `npm start`.

Without database variables, the site remains in safe prototype mode and does not fail; `/api/health` reports `database: not-configured`.
