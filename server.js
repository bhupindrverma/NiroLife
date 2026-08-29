const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = __dirname;
const dataDir = path.join(__dirname, 'data');
const enquiryFile = path.join(dataDir, 'enquiries.json');
let enquiryFallback = [];

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
  const { name, type, practice, city, services = '', phone = '', hours = '', specialty = '', whatsapp = '', email = '', address = '', bio = '', color = 'green' } = req.body || {};
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

async function readEnquiries() {
  try { return JSON.parse(await fs.readFile(enquiryFile, 'utf8')); }
  catch (_error) { return enquiryFallback; }
}

async function writeEnquiries(enquiries) {
  enquiryFallback = enquiries;
  try { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(enquiryFile, JSON.stringify(enquiries, null, 2)); }
  catch (_error) { /* Memory fallback keeps the live request working. */ }
}

app.post('/api/enquiries', async (req, res) => {
  const { contactName, email, phone, package: selectedPackage, practice, type, specialty, city, message = '', preview = {} } = req.body || {};
  if (!contactName || !email || !phone || !practice) return res.status(400).json({ error: 'Contact name, email, phone and practice are required.' });
  const enquiry = { id: Date.now().toString(36), contactName, email, phone, package: selectedPackage || 'Not sure yet', practice, type, specialty, city, message, preview, status: 'new', createdAt: new Date().toISOString() };
  const db = getPool();
  if (db) {
    try { await db.query('INSERT INTO enquiries (contact_name,email,phone,package_name,practice_name,practice_type,specialty,city,message,preview_json,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [contactName, email, phone, enquiry.package, practice, type || '', specialty || '', city || '', message, JSON.stringify(preview), 'new']); }
    catch (_error) { const enquiries = await readEnquiries(); enquiries.unshift(enquiry); await writeEnquiries(enquiries); }
  } else { const enquiries = await readEnquiries(); enquiries.unshift(enquiry); await writeEnquiries(enquiries); }
  res.status(201).json({ saved: true, id: enquiry.id });
});

app.get('/api/admin/enquiries', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return res.status(503).json({ error: 'Admin access is not configured.' });
  if (req.get('x-admin-key') !== adminKey) return res.status(401).json({ error: 'Invalid admin password.' });
  const db = getPool();
  if (db) {
    try { const [rows] = await db.query('SELECT id,contact_name AS contactName,email,phone,package_name AS package,practice_name AS practice,practice_type AS type,specialty,city,message,status,created_at AS createdAt FROM enquiries ORDER BY created_at DESC'); return res.json(rows); }
    catch (_error) { /* Fall through to file store. */ }
  }
  res.json(await readEnquiries());
});

app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.listen(port, () => console.log(`NiroLife listening on port ${port}`));
