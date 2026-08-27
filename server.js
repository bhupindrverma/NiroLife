const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = __dirname;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(publicDir, { extensions: ['html'] }));

let pool;
function getPool() {
  if (!pool && process.env.DB_HOST) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 8,
      charset: 'utf8mb4'
    });
  }
  return pool;
}

app.get('/api/health', async (_req, res) => {
  const db = getPool();
  if (!db) return res.json({ ok: true, database: 'not-configured', environment: 'prototype' });
  try { await db.query('SELECT 1'); res.json({ ok: true, database: 'connected' }); }
  catch (error) { res.status(503).json({ ok: false, database: 'unavailable' }); }
});

app.post('/api/practices', async (req, res) => {
  const { name, type, practice, city, services = '', phone = '', hours = '' } = req.body || {};
  if (!name || !practice || !city) return res.status(400).json({ error: 'Name, practice and city are required.' });
  const db = getPool();
  if (!db) return res.status(202).json({ saved: false, mode: 'prototype', message: 'Database is not configured yet.' });
  try {
    const [user] = await db.query('INSERT INTO users (email) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', [`preview-${Date.now()}@nirolife.local`]);
    const userId = user.insertId;
    const [practiceRow] = await db.query('INSERT INTO practices (user_id,name,type,city,services,phone,hours) VALUES (?,?,?,?,?,?,?)', [userId, practice, type || 'Healthcare practice', city, services, phone, hours]);
    const slug = `${practice.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${practiceRow.insertId}`;
    await db.query('INSERT INTO websites (practice_id,slug) VALUES (?,?)', [practiceRow.insertId, slug]);
    res.status(201).json({ saved: true, slug });
  } catch (error) { res.status(500).json({ error: 'Unable to save practice.' }); }
});

app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.listen(port, () => console.log(`NiroLife listening on port ${port}`));
