const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const express = require('express');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = __dirname;
const dataDir = path.join(__dirname, 'data');
const enquiryFile = path.join(dataDir, 'enquiries.json');
const eventFile = path.join(dataDir, 'events.json');
const practiceFile = path.join(dataDir, 'practices.json');
let enquiryFallback = [];
let eventFallback = [];
let practiceFallback = [];

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

async function readPractices() { try { return JSON.parse(await fs.readFile(practiceFile, 'utf8')); } catch (_error) { return practiceFallback; } }
async function writePractices(practices) { practiceFallback = practices; await fs.mkdir(dataDir, { recursive: true }); try { await fs.writeFile(practiceFile, JSON.stringify(practices, null, 2)); } catch (_error) { /* Memory fallback remains available. */ } }
const publicPractice = item => { const { editToken, ...profile } = item; return profile; };

app.post('/api/practices', async (req, res) => {
  const { name, type, practice, city } = req.body || {};
  if (!name || !practice || !city) return res.status(400).json({ error: 'Name, practice and city are required.' });
  const base = practice.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'practice';
  const slug = `${base}-${crypto.randomBytes(4).toString('hex')}`;
  const editToken = crypto.randomBytes(18).toString('hex');
  const practices = await readPractices();
  practices.unshift({ ...req.body, slug, editToken, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await writePractices(practices.slice(0, 5000));
  res.status(201).json({ saved: true, slug, editToken });
});

app.get('/api/practices/:slug', async (req, res) => {
  const practices = await readPractices();
  const profile = practices.find(item => item.slug === req.params.slug);
  if (!profile) return res.status(404).json({ error: 'Website preview not found.' });
  res.json(publicPractice(profile));
});

app.patch('/api/practices/:slug', async (req, res) => {
  const practices = await readPractices();
  const profile = practices.find(item => item.slug === req.params.slug);
  if (!profile) return res.status(404).json({ error: 'Website preview not found.' });
  if (!req.get('x-edit-token') || req.get('x-edit-token') !== profile.editToken) return res.status(401).json({ error: 'This edit link is not valid.' });
  const allowed = ['practice', 'headline', 'bio', 'theme', 'template'];
  allowed.forEach(key => { if (typeof req.body?.[key] === 'string') profile[key] = req.body[key].slice(0, key === 'bio' ? 500 : 100); });
  profile.updatedAt = new Date().toISOString();
  await writePractices(practices);
  res.json({ saved: true });
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

async function readEvents() {
  try { return JSON.parse(await fs.readFile(eventFile, 'utf8')); }
  catch (_error) { return eventFallback; }
}

async function writeEvents(events) {
  eventFallback = events;
  try { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(eventFile, JSON.stringify(events.slice(0, 5000), null, 2)); }
  catch (_error) { /* Analytics remain best-effort if storage is unavailable. */ }
}

async function sendEnquiryEmails(enquiry) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return false;
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  const adminEmail = process.env.LEAD_EMAIL || process.env.SMTP_USER;
  const text = `New NiroLife publishing enquiry\n\nPractice: ${enquiry.practice}\nContact: ${enquiry.contactName}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone}\nPackage: ${enquiry.package}\nCity: ${enquiry.city || ''}\nMessage: ${enquiry.message || ''}`;
  await transporter.sendMail({ from: `NiroLife <${process.env.SMTP_USER}>`, to: adminEmail, replyTo: enquiry.email, subject: `New NiroLife enquiry: ${enquiry.practice}`, text });
  await transporter.sendMail({ from: `NiroLife <${process.env.SMTP_USER}>`, to: enquiry.email, subject: `We received your NiroLife website enquiry`, text: `Hello ${enquiry.contactName},\n\nThank you for requesting help publishing the ${enquiry.practice} website preview. We received your interest in ${enquiry.package}. We will review the information and reply shortly.\n\nThis message confirms an enquiry only; no payment or contract has been created.\n\nNiroLife` });
  return true;
}

app.post('/api/events', async (req, res) => {
  const { name, page = '/', source = '', profession = '' } = req.body || {};
  const allowed = ['page_view','generator_start','preview_created','claim_opened','enquiry_sent'];
  if (!allowed.includes(name)) return res.status(400).json({ error: 'Unsupported event.' });
  const events = await readEvents();
  events.unshift({ id: Date.now().toString(36), name, page: String(page).slice(0, 220), source: String(source).slice(0, 120), profession: String(profession).slice(0, 100), createdAt: new Date().toISOString() });
  await writeEvents(events);
  res.status(202).json({ recorded: true });
});

app.post('/api/enquiries', async (req, res) => {
  const { contactName, email, phone, package: selectedPackage, practice, type, specialty, city, message = '', preview = {} } = req.body || {};
  if (!contactName || !email || !phone || !practice) return res.status(400).json({ error: 'Contact name, email, phone and practice are required.' });
  const enquiry = { id: Date.now().toString(36), contactName, email, phone, package: selectedPackage || 'Not sure yet', practice, type, specialty, city, message, preview, status: 'new', createdAt: new Date().toISOString() };
  const db = getPool();
  if (db) {
    try { await db.query('INSERT INTO enquiries (contact_name,email,phone,package_name,practice_name,practice_type,specialty,city,message,preview_json,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [contactName, email, phone, enquiry.package, practice, type || '', specialty || '', city || '', message, JSON.stringify(preview), 'new']); }
    catch (_error) { const enquiries = await readEnquiries(); enquiries.unshift(enquiry); await writeEnquiries(enquiries); }
  } else { const enquiries = await readEnquiries(); enquiries.unshift(enquiry); await writeEnquiries(enquiries); }
  sendEnquiryEmails(enquiry).catch(error => console.error('Enquiry email failed:', error.message));
  res.status(201).json({ saved: true, id: enquiry.id, emailQueued: Boolean(process.env.SMTP_HOST && process.env.SMTP_PASSWORD) });
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

app.get('/api/admin/analytics', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.get('x-admin-key') !== adminKey) return res.status(401).json({ error: 'Invalid admin password.' });
  const events = await readEvents();
  const totals = events.reduce((summary, event) => { summary[event.name] = (summary[event.name] || 0) + 1; return summary; }, {});
  const pages = events.filter(event => event.name === 'page_view').reduce((summary, event) => { summary[event.page] = (summary[event.page] || 0) + 1; return summary; }, {});
  res.json({ totals, pages, recent: events.slice(0, 50) });
});

app.patch('/api/admin/enquiries/:id', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.get('x-admin-key') !== adminKey) return res.status(401).json({ error: 'Invalid admin password.' });
  const allowed = ['new', 'contacted', 'qualified', 'won', 'closed'];
  const status = req.body?.status;
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid lead status.' });
  const db = getPool();
  if (db && /^\d+$/.test(req.params.id)) {
    try {
      await db.query('UPDATE enquiries SET status = ? WHERE id = ?', [status, req.params.id]);
      return res.json({ updated: true });
    } catch (_error) { /* Fall back to file storage. */ }
  }
  const enquiries = await readEnquiries();
  const enquiry = enquiries.find(item => String(item.id) === String(req.params.id));
  if (!enquiry) return res.status(404).json({ error: 'Enquiry not found.' });
  enquiry.status = status;
  await writeEnquiries(enquiries);
  res.json({ updated: true });
});

app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.listen(port, () => console.log(`NiroLife listening on port ${port}`));
