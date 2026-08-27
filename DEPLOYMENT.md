# NiroLife deployment on Hostinger Cloud Professional

## 1. Create the website

In hPanel, add `nirolife.com` as a separate website under the existing Cloud Professional subscription. Do not replace or modify `serankpro.com`.

## 2. Create the database

Open Databases → MySQL Databases and create a database, database user and password. Copy the exact host, database name and username shown by hPanel.

## 3. Create the tables

Open phpMyAdmin for the new database, open the SQL tab, paste the contents of `database/schema.sql` and run it once.

## 4. Deploy the application

Connect the GitHub repository in Hostinger's Node.js Web App setup. Use:

- Framework: Next.js/Node.js application (or Other if the panel does not detect Express)
- Entry file: `server.js`
- Install command: `npm install`
- Start command: `npm start`

## 5. Add environment variables

Add `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` in hPanel. Never commit the real values to GitHub.

## 6. Smoke test

Visit `/api/health`. It should return `database: connected`. Complete the generator form and confirm that `/api/practices` returns a saved website slug.

## 7. First production safeguards

- Enable HTTPS before publishing the site.
- Keep daily backups enabled.
- Use a strong, unique database password.
- Do not collect patient medical records.
- Keep generated previews private until provider information is verified.
