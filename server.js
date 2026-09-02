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
const workflowFile = path.join(dataDir, 'workflows.json');
const automationFile = path.join(dataDir, 'automation-state.json');
let enquiryFallback = [];
let eventFallback = [];
let practiceFallback = [];
let workflowFallback = {};
let automationFallback = {};

const WORKFLOW_STAGES = {
  manual_review: { label: 'Review enquiry', nextAction: 'Review the preview, package and contact details, then contact the customer.', owner: 'admin', manual: true, legacy: 'new' },
  verification_review: { label: 'Verify free website', nextAction: 'Confirm the healthcare business, public contact details and website content, then publish the free NiroLife website.', owner: 'admin', manual: true, legacy: 'qualified' },
  awaiting_customer: { label: 'Awaiting customer reply', nextAction: 'Automation waits for the customer to reply or choose the next step.', owner: 'customer', manual: false, legacy: 'contacted' },
  payment_review: { label: 'Verify payment', nextAction: 'Confirm the payment or payment arrangement, then request onboarding details.', owner: 'admin', manual: true, legacy: 'qualified' },
  onboarding: { label: 'Customer onboarding', nextAction: 'Customer must provide domain, logo, photos and verified practice details.', owner: 'customer', manual: false, legacy: 'qualified' },
  content_approval: { label: 'Approve website content', nextAction: 'Review the completed website and request customer approval.', owner: 'admin', manual: true, legacy: 'qualified' },
  revision_requested: { label: 'Revisions requested', nextAction: 'Complete the requested revisions, then resend the website for approval.', owner: 'admin', manual: true, legacy: 'qualified' },
  launch_setup: { label: 'Launch setup', nextAction: 'Connect the domain, verify SSL, contact buttons and analytics, then publish.', owner: 'admin', manual: true, legacy: 'won' },
  live: { label: 'Website live', nextAction: 'Automation monitors the website and starts the maintenance schedule.', owner: 'automation', manual: false, legacy: 'won' },
  maintenance: { label: 'Managed maintenance', nextAction: 'Continue scheduled updates, checks and reporting.', owner: 'automation', manual: false, legacy: 'won' },
  closed: { label: 'Closed', nextAction: 'No further action is scheduled.', owner: 'none', manual: false, legacy: 'closed' }
};
const CUSTOMER_STAGE_INFO = {
  manual_review: { label: 'Request review', nextAction: 'Our team is reviewing your website request.' },
  verification_review: { label: 'Business verification', nextAction: 'NiroLife is checking your public practice information before the free website can go live.' },
  awaiting_customer: { label: 'Awaiting your response', nextAction: 'Please reply to the latest NiroLife email if more information was requested.' },
  payment_review: { label: 'Quotation and payment', nextAction: 'Review the quotation below. If you pay manually, report it here so our team can verify it.' },
  onboarding: { label: 'Onboarding', nextAction: 'We are checking your website information and supplied assets.' },
  content_approval: { label: 'Website approval', nextAction: 'Review the website below and either approve it for launch or request revisions.' },
  revision_requested: { label: 'Revisions in progress', nextAction: 'Your requested revisions are being completed. You will be notified when the website is ready to review again.' },
  launch_setup: { label: 'Launch preparation', nextAction: 'We are connecting the domain and completing launch checks.' },
  live: { label: 'Website live', nextAction: 'Your website has been published.' },
  maintenance: { label: 'Managed maintenance', nextAction: 'Your website is covered by the managed maintenance service.' },
  closed: { label: 'Closed', nextAction: 'No further action is scheduled.' }
};

app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  const blocked = ['/data','/server.js','/schema.sql','/package.json','/readme.md','/deployment.md','/pnpm-lock.yaml'];
  if (blocked.some(item => req.path.toLowerCase() === item || req.path.toLowerCase().startsWith(`${item}/`))) return res.status(404).send('Not found.');
  res.set('X-Content-Type-Options','nosniff');
  res.set('Referrer-Policy','strict-origin-when-cross-origin');
  res.set('X-Frame-Options','SAMEORIGIN');
  next();
});
app.use(express.static(publicDir, { extensions: ['html'] }));

let pool;
let exchangeCache = null;
let exchangeRequest = null;
app.get('/api/exchange-rates', async (_req, res) => {
  if (!exchangeCache || Date.now() - exchangeCache.fetchedAt > 86400000) {
    if (!exchangeRequest) exchangeRequest = (async () => {
      const response = await fetch('https://api.frankfurter.dev/v2/rates?base=INR&quotes=USD,GBP,EUR', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error('Rate provider unavailable');
      const rows = await response.json(); const rates = { INR:1 };
      for (const row of rows) if (['USD','GBP','EUR'].includes(row.quote) && row.base === 'INR' && Number.isFinite(row.rate) && row.rate > 0) rates[row.quote] = row.rate;
      if (Object.keys(rates).length !== 4) throw Error('Incomplete rates');
      exchangeCache = { rates, date:rows[0].date, fetchedAt:Date.now() };
    })().finally(() => { exchangeRequest = null; });
    try { await exchangeRequest; } catch (_) {}
  }
  if (!exchangeCache || Date.now()-exchangeCache.fetchedAt > 7*86400000) return res.status(503).json({ rates:{INR:1} });
  res.set('Cache-Control','public, max-age=3600').json({ rates:exchangeCache.rates, date:exchangeCache.date });
});
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

let durableStateReady;
async function ensureDurableState() {
  const db = getPool();
  if (!db) return false;
  if (!durableStateReady) durableStateReady = db.query('CREATE TABLE IF NOT EXISTS app_state (state_key VARCHAR(80) PRIMARY KEY, state_json LONGTEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4').then(() => true).catch(() => false);
  return durableStateReady;
}
async function readDurableState(key, file, fallback) {
  const db = getPool();
  if (db && await ensureDurableState()) {
    try { const [rows] = await db.query('SELECT state_json FROM app_state WHERE state_key = ? LIMIT 1', [key]); if (rows[0]) return typeof rows[0].state_json === 'string' ? JSON.parse(rows[0].state_json) : rows[0].state_json; } catch (_error) { /* File fallback remains available. */ }
  }
  try {
    const fileValue = JSON.parse(await fs.readFile(file, 'utf8'));
    if (db && await ensureDurableState()) { try { await db.query('INSERT IGNORE INTO app_state (state_key,state_json) VALUES (?,?)', [key, JSON.stringify(fileValue)]); } catch (_error) { /* Continue with the file value. */ } }
    return fileValue;
  } catch (_error) { return fallback; }
}
async function writeDurableState(key, file, value) {
  const serialized = JSON.stringify(value);
  const db = getPool();
  if (db && await ensureDurableState()) {
    try { await db.query('INSERT INTO app_state (state_key,state_json) VALUES (?,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)', [key, serialized]); } catch (_error) { /* File copy is still attempted. */ }
  }
  try { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(file, JSON.stringify(value, null, 2)); } catch (_error) { /* Memory fallback remains available. */ }
}
async function readPractices() { return readDurableState('practices', practiceFile, practiceFallback); }
async function writePractices(practices) { practiceFallback = practices; await writeDurableState('practices', practiceFile, practices); }
const publicPractice = item => { const { editToken, ...profile } = item; return profile; };
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const publicSiteHtml = profile => {
  const practice = String(profile.practice || 'Healthcare Practice').slice(0, 180);
  const specialty = String(profile.specialty || profile.type || 'Healthcare practice').slice(0, 120);
  const city = String(profile.city || '').slice(0, 120);
  const address = String(profile.address || city).slice(0, 500);
  const hours = String(profile.hours || 'Contact the practice for timings').slice(0, 200);
  const phone = String(profile.phone || '').replace(/[^0-9+ ()-]/g, '').slice(0, 40);
  const whatsapp = String(profile.whatsapp || profile.phone || '').replace(/\D/g, '').slice(0, 16);
  const bio = String(profile.bio || `${practice} provides ${specialty.toLowerCase()} services in ${city}. Contact the practice for current information and appointment availability.`).slice(0, 700);
  const services = String(profile.services || 'Consultation, Treatment planning, Follow-up care').split(/,|\n|;/).map(item => item.replace(/^[-•\d.\s]+/,'').trim()).filter(item => item.length > 2).slice(0, 8);
  const slug = String(profile.slug || '').replace(/[^a-z0-9-]/g, '');
  const canonical = `https://nirolife.com/sites/${slug}`;
  const description = `${practice} — ${specialty}${city ? ` in ${city}` : ''}. View services, timings, location and contact information.`.slice(0, 160);
  const callLink = phone ? `<a class="public-primary" href="tel:${phone.replace(/\s/g,'')}">Call the practice</a>` : '';
  const waLink = whatsapp.length >= 10 ? `<a class="public-secondary" href="https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hello ${practice}, I would like to request an appointment.`)}" rel="noopener">WhatsApp</a>` : '';
  const serviceCards = services.map((service, index) => `<article><span>0${index + 1}</span><h3>${escapeHtml(service)}</h3><p>Contact the practice for current service information and appointment availability.</p></article>`).join('');
  const schemaText = value => String(value || '').replace(/[<>]/g, '');
  const schema = { '@context':'https://schema.org', '@type':'MedicalBusiness', name:schemaText(practice), url:canonical, telephone:phone || undefined, description:schemaText(bio), address:address ? { '@type':'PostalAddress', streetAddress:schemaText(address), addressLocality:schemaText(city), addressCountry:'IN' } : undefined };
  return `<!doctype html><html lang="en-IN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(practice)} | ${escapeHtml(specialty)}${city ? ` in ${escapeHtml(city)}` : ''}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/public-site.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><header class="public-header"><a class="public-brand" href="${canonical}">${escapeHtml(practice)}</a><nav><a href="#services">Services</a><a href="#about">About</a><a href="#contact">Contact</a></nav>${callLink}</header><main><section class="public-hero"><div><p class="public-kicker">${escapeHtml(specialty)}${city ? ` in ${escapeHtml(city)}` : ''}</p><h1>${escapeHtml(practice)}</h1><p>${escapeHtml(bio)}</p><div class="public-actions">${callLink}${waLink}</div></div><img src="/healthcare-website-design.svg" width="800" height="560" alt="Healthcare practice website" decoding="async" fetchpriority="high"></section><section class="public-section" id="services"><p class="public-kicker">Services</p><h2>How the practice can help</h2><div class="public-services">${serviceCards}</div></section><section class="public-section public-about" id="about"><div><p class="public-kicker">About the practice</p><h2>${escapeHtml(specialty)} with clear, accessible contact information</h2><p>${escapeHtml(bio)}</p></div><dl><div><dt>Location</dt><dd>${escapeHtml(address || 'Contact the practice')}</dd></div><div><dt>Hours</dt><dd>${escapeHtml(hours)}</dd></div><div><dt>Phone</dt><dd>${escapeHtml(phone || 'Contact details available on request')}</dd></div></dl></section><section class="public-contact" id="contact"><p class="public-kicker">Contact</p><h2>Request information or an appointment</h2><p>Contact the practice directly for availability, fees and service information.</p><div class="public-actions">${callLink}${waLink}</div></section></main><footer class="public-footer"><div><strong>${escapeHtml(practice)}</strong><span>${escapeHtml([phone,city].filter(Boolean).join(' · '))}</span></div><div><span>Free website powered by <a href="https://nirolife.com/">NiroLife</a></span><small>Practice information is supplied and approved by the provider. This page does not provide medical advice.</small></div></footer></body></html>`;
};

const designedPublicSiteHtml = profile => {
  const theme = ['green','blue','purple','coral'].includes(profile.theme) ? profile.theme : 'green';
  const template = ['modern','premium','minimal'].includes(profile.template) ? profile.template : 'modern';
  const heroStyle = profile.heroStyle === 'illustration' ? 'illustration' : 'photo';
  const heroImage = heroStyle === 'illustration' ? '/healthcare-website-design.svg' : '/healthcare-hero-v2.png';
  const headline = escapeHtml(String(profile.headline || 'care you can trust.').slice(0, 100));
  const practice = escapeHtml(String(profile.practice || 'Healthcare Practice').slice(0, 180));
  const designCss = `<style>.theme-blue{--green:#176b8a;--coral:#249cc5}.theme-purple{--green:#60408e;--coral:#8c68c7}.theme-coral{--green:#a9493b;--coral:#ef765d}.public-hero h1 em{display:block;color:var(--green);font-weight:500}.public-hero img{max-height:560px;object-fit:cover;border-radius:14px}.visual-illustration .public-hero img{object-fit:contain;border-radius:0}.template-premium{--ink:#172d35;--green:#8b542a;--coral:#d69558}.template-premium .public-primary,.template-premium .public-secondary,.template-premium .public-services article,.template-premium .public-about dl{border-radius:3px}.template-minimal .public-services article{border-width:1px 0 0;border-radius:0;padding-left:0}</style>`;
  return publicSiteHtml(profile)
    .replace('</head>', `${designCss}</head>`)
    .replace('<body>', `<body class="theme-${theme} template-${template} visual-${heroStyle}">`)
    .replace(`<h1>${practice}</h1>`, `<h1>${practice}<em>${headline}</em></h1>`)
    .replace('src="/healthcare-website-design.svg" width="800" height="560" alt="Healthcare practice website"', `src="${heroImage}" width="800" height="560" alt="${practice} healthcare website"`);
};

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

app.get('/sites/:slug', async (req, res) => {
  const practices = await readPractices();
  const profile = practices.find(item => item.slug === req.params.slug && item.publicationStatus === 'live');
  if (!profile) return res.status(404).send('This website is not published or is no longer available.');
  res.set('Cache-Control', 'public, max-age=300, s-maxage=900');
  res.send(designedPublicSiteHtml(profile));
});

app.get('/sitemap-sites.xml', async (_req, res) => {
  const practices = await readPractices();
  const urls = practices.filter(item => item.publicationStatus === 'live' && item.slug).map(item => `<url><loc>https://nirolife.com/sites/${escapeHtml(String(item.slug).replace(/[^a-z0-9-]/g,''))}</loc>${item.updatedAt ? `<lastmod>${escapeHtml(String(item.updatedAt).slice(0,10))}</lastmod>` : ''}<changefreq>monthly</changefreq></url>`).join('');
  res.type('application/xml').set('Cache-Control','public, max-age=300, s-maxage=900').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

app.patch('/api/practices/:slug', async (req, res) => {
  const practices = await readPractices();
  const profile = practices.find(item => item.slug === req.params.slug);
  if (!profile) return res.status(404).json({ error: 'Website preview not found.' });
  if (!req.get('x-edit-token') || req.get('x-edit-token') !== profile.editToken) return res.status(401).json({ error: 'This edit link is not valid.' });
  const allowed = ['practice', 'headline', 'bio', 'theme', 'template', 'heroStyle'];
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

async function readWorkflows() { return readDurableState('workflows', workflowFile, workflowFallback); }
async function writeWorkflows(workflows) { workflowFallback = workflows; await writeDurableState('workflows', workflowFile, workflows); }
async function readAutomationState() { return readDurableState('automation', automationFile, automationFallback); }
async function writeAutomationState(state) { automationFallback = state; await writeDurableState('automation', automationFile, state); }
const workflowFor = (id, workflows, fallbackStatus = 'new') => {
  const savedWorkflow = workflows[String(id)] || {};
  const fallbackStage = fallbackStatus === 'closed' ? 'closed' : fallbackStatus === 'won' ? 'live' : fallbackStatus === 'contacted' ? 'awaiting_customer' : 'manual_review';
  const stage = WORKFLOW_STAGES[savedWorkflow.stage] ? savedWorkflow.stage : fallbackStage;
  return { stage, ...WORKFLOW_STAGES[stage], notes: savedWorkflow.notes || '', followUpAt: savedWorkflow.followUpAt || '', quoteAmount: savedWorkflow.quoteAmount || '', paymentInstructions: savedWorkflow.paymentInstructions || '', paymentReportedAt: savedWorkflow.paymentReportedAt || '', customerToken: savedWorkflow.customerToken || '', finalPreviewUrl: savedWorkflow.finalPreviewUrl || '', revisionFeedback: savedWorkflow.revisionFeedback || '', revisionRequestedAt: savedWorkflow.revisionRequestedAt || '', contentApprovedAt: savedWorkflow.contentApprovedAt || '', launchChecklist: savedWorkflow.launchChecklist || {}, liveUrl: savedWorkflow.liveUrl || '', launchedAt: savedWorkflow.launchedAt || '', updatedAt: savedWorkflow.updatedAt || '' };
};

async function readEvents() {
  return readDurableState('events', eventFile, eventFallback);
}

async function writeEvents(events) {
  eventFallback = events.slice(0, 5000);
  await writeDurableState('events', eventFile, eventFallback);
}

async function sendEnquiryEmails(enquiry) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return false;
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  const adminEmail = process.env.LEAD_EMAIL || process.env.SMTP_USER;
  const onboarding = enquiry.preview?.onboarding || {};
  const onboardingText = Object.keys(onboarding).length ? `\nDomain: ${onboarding.domain || 'Not decided'}\nOwner: ${onboarding.ownerName || ''}\nQualifications: ${onboarding.qualifications || ''}\nAddress: ${onboarding.address || ''}\nHours: ${onboarding.hours || ''}\nBusiness WhatsApp: ${onboarding.businessWhatsapp || ''}\nServices: ${onboarding.services || ''}\nAssets: ${onboarding.assetsUrl || 'Not provided'}` : '';
  const text = `New NiroLife publishing enquiry\n\nPractice: ${enquiry.practice}\nContact: ${enquiry.contactName}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone}\nPackage: ${enquiry.package}\nCity: ${enquiry.city || ''}${onboardingText}\nMessage: ${enquiry.message || ''}`;
  await transporter.sendMail({ from: `NiroLife <${process.env.SMTP_USER}>`, to: adminEmail, replyTo: enquiry.email, subject: `New NiroLife enquiry: ${enquiry.practice}`, text });
  await transporter.sendMail({ from: `NiroLife <${process.env.SMTP_USER}>`, to: enquiry.email, subject: `We received your NiroLife website enquiry`, text: `Hello ${enquiry.contactName},\n\nThank you for requesting help publishing the ${enquiry.practice} website preview. We received your interest in ${enquiry.package}. We will review the information and reply shortly.\n\nTrack your request securely:\n${enquiry.statusUrl}\n\nThis message confirms an enquiry only; no payment or contract has been created.\n\nNiroLife` });
  return true;
}

async function sendCustomerStatusEmail(enquiry, workflow, subject = 'Your NiroLife website request has been updated') {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !enquiry?.email) return false;
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  const statusUrl = `https://nirolife.com/status.html?token=${encodeURIComponent(workflow.customerToken)}`;
  const quote = workflow.quoteAmount ? `\nConfirmed quotation: ₹${workflow.quoteAmount}` : '';
  const payment = workflow.paymentInstructions ? `\nPayment instructions: ${workflow.paymentInstructions}` : '';
  const live = workflow.liveUrl ? `\nLive website: ${workflow.liveUrl}` : '';
  await transporter.sendMail({ from: `NiroLife <${process.env.SMTP_USER}>`, to: enquiry.email, subject, text: `Hello ${enquiry.contactName},\n\nYour ${enquiry.practice} website request is now at: ${workflow.label}.\n\nNext step: ${workflow.nextAction}${quote}${payment}${live}\n\nTrack your request securely:\n${statusUrl}\n\nNo payment is confirmed until NiroLife manually verifies it.\n\nNiroLife` });
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
  const { contactName, email, phone, package: selectedPackage, addOns = '', practice, type, specialty, city, message = '', onboarding = {}, preview = {} } = req.body || {};
  if (!contactName || !email || !phone || !practice) return res.status(400).json({ error: 'Contact name, email, phone and practice are required.' });
  const safeOnboarding = ['domain','ownerName','qualifications','address','hours','businessWhatsapp','services','assetsUrl'].reduce((result, key) => { if (typeof onboarding[key] === 'string') result[key] = onboarding[key].slice(0, key === 'services' ? 1500 : 500); return result; }, {});
  if (safeOnboarding.assetsUrl && !/^https:\/\//i.test(safeOnboarding.assetsUrl)) safeOnboarding.assetsUrl = '';
  safeOnboarding.verified = onboarding.verified === true;
  const allowedPackages = ['Free Preview','Free Live Website','Website Launch','Managed Website'];
  const selected = allowedPackages.includes(selectedPackage) ? selectedPackage : 'Not sure yet';
  if (selected !== 'Free Preview' && !safeOnboarding.verified) return res.status(400).json({ error: 'Please confirm that the submitted business information is authorised and accurate.' });
  const enquiry = { id: Date.now().toString(36), contactName: String(contactName).slice(0,120), email: String(email).slice(0,180), phone: String(phone).slice(0,60), package: String(selected).slice(0,80), practice: String(practice).slice(0,180), type, specialty, city, message: [String(message).slice(0,1500), addOns ? `Add-ons: ${String(addOns).slice(0,500)}` : ''].filter(Boolean).join('\n'), preview: { ...preview, onboarding: safeOnboarding }, status: 'new', createdAt: new Date().toISOString() };
  const db = getPool();
  // Currency is a quotation preference only; no client-supplied amount is accepted.
  const preferredCurrency = ['INR','USD','GBP','EUR'].includes(req.body.currency) ? req.body.currency : 'INR';
  enquiry.preview.currency = preferredCurrency;
  enquiry.message += `\nPreferred quotation currency: ${preferredCurrency}. Converted website prices are estimates, not a payment amount.`;
  if (db) {
    try { const [insertResult] = await db.query('INSERT INTO enquiries (contact_name,email,phone,package_name,practice_name,practice_type,specialty,city,message,preview_json,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [enquiry.contactName, enquiry.email, enquiry.phone, enquiry.package, enquiry.practice, type || '', specialty || '', city || '', enquiry.message, JSON.stringify(enquiry.preview), 'new']); enquiry.id = String(insertResult.insertId || enquiry.id); }
    catch (_error) { const enquiries = await readEnquiries(); enquiries.unshift(enquiry); await writeEnquiries(enquiries); }
  } else { const enquiries = await readEnquiries(); enquiries.unshift(enquiry); await writeEnquiries(enquiries); }
  const workflows = await readWorkflows();
  const initialStage = selected === 'Free Live Website' ? 'verification_review' : selected === 'Free Preview' ? 'awaiting_customer' : 'payment_review';
  const customerToken = crypto.randomBytes(24).toString('hex');
  workflows[String(enquiry.id)] = { stage: initialStage, notes: selected === 'Free Live Website' ? 'Free live website requested. Verify the business, content and contact details before publishing.' : selected === 'Free Preview' ? 'Free preview request saved. No payment required.' : 'Onboarding details received. Confirm scope and payment before starting work.', followUpAt: '', quoteAmount: '', paymentInstructions: '', customerToken, updatedAt: new Date().toISOString() };
  await writeWorkflows(workflows);
  enquiry.statusUrl = `https://nirolife.com/status.html?token=${customerToken}`;
  sendEnquiryEmails(enquiry).catch(error => console.error('Enquiry email failed:', error.message));
  res.status(201).json({ saved: true, id: enquiry.id, statusUrl: `/status.html?token=${customerToken}`, emailQueued: Boolean(process.env.SMTP_HOST && process.env.SMTP_PASSWORD) });
});

async function findCustomerByToken(token) {
  const workflows = await readWorkflows();
  const match = Object.entries(workflows).find(([, workflow]) => workflow.customerToken && workflow.customerToken === token);
  if (!match) return null;
  const [id] = match;
  let enquiries = await readEnquiries();
  const db = getPool();
  if (db && /^\d+$/.test(id)) {
    try { const [rows] = await db.query('SELECT id,contact_name AS contactName,email,package_name AS package,practice_name AS practice,preview_json AS preview,status,created_at AS createdAt FROM enquiries WHERE id = ? LIMIT 1', [id]); enquiries = rows; rows.forEach(row => { if (typeof row.preview === 'string') { try { row.preview = JSON.parse(row.preview); } catch (_error) { row.preview = {}; } } }); } catch (_error) { /* Use file storage. */ }
  }
  const enquiry = enquiries.find(item => String(item.id) === String(id));
  if (!enquiry) return null;
  return { enquiry, workflow: workflowFor(id, workflows, enquiry.status), workflows, id };
}

app.get('/api/customer/:token', async (req, res) => {
  const customer = await findCustomerByToken(req.params.token);
  if (!customer) return res.status(404).json({ error: 'This private tracking link is invalid or no longer available.' });
  const { enquiry, workflow } = customer;
  const customerInfo = CUSTOMER_STAGE_INFO[workflow.stage] || CUSTOMER_STAGE_INFO.manual_review;
  res.json({ practice: enquiry.practice, contactName: enquiry.contactName, package: enquiry.package, createdAt: enquiry.createdAt, stage: workflow.stage, label: customerInfo.label, nextAction: customerInfo.nextAction, quoteAmount: workflow.quoteAmount, paymentInstructions: workflow.paymentInstructions, paymentReportedAt: workflow.paymentReportedAt, finalPreviewUrl: workflow.finalPreviewUrl || (enquiry.preview?.siteSlug ? `/preview.html?site=${encodeURIComponent(enquiry.preview.siteSlug)}` : ''), revisionFeedback: workflow.revisionFeedback, contentApprovedAt: workflow.contentApprovedAt, liveUrl: workflow.liveUrl, launchedAt: workflow.launchedAt, previewUrl: enquiry.preview?.siteSlug ? `/preview.html?site=${encodeURIComponent(enquiry.preview.siteSlug)}` : '' });
});

app.post('/api/customer/:token/payment-reported', async (req, res) => {
  const customer = await findCustomerByToken(req.params.token);
  if (!customer) return res.status(404).json({ error: 'This private tracking link is invalid or no longer available.' });
  if (!customer.workflow.quoteAmount) return res.status(400).json({ error: 'A quotation has not been issued yet.' });
  const reference = typeof req.body?.reference === 'string' ? req.body.reference.replace(/[^a-zA-Z0-9._\- /]/g, '').slice(0, 100) : '';
  const stored = customer.workflows[customer.id];
  stored.stage = 'payment_review'; stored.paymentReportedAt = new Date().toISOString(); stored.notes = `${stored.notes || ''}\nCustomer reported payment${reference ? ` · Reference: ${reference}` : ''}. Verify manually before continuing.`.trim(); stored.updatedAt = new Date().toISOString();
  await writeWorkflows(customer.workflows);
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
    transporter.sendMail({ from: `NiroLife <${process.env.SMTP_USER}>`, to: process.env.LEAD_EMAIL || process.env.SMTP_USER, subject: `Payment reported: ${customer.enquiry.practice}`, text: `${customer.enquiry.contactName} reported a payment for ${customer.enquiry.practice}.\nReference: ${reference || 'Not supplied'}\nQuoted amount: ₹${stored.quoteAmount}\n\nVerify it manually in the admin dashboard before moving the customer to onboarding.` }).catch(error => console.error('Payment report email failed:', error.message));
  }
  res.json({ reported: true, message: 'Thank you. NiroLife will verify the payment manually.' });
});

app.post('/api/customer/:token/approval', async (req, res) => {
  const customer = await findCustomerByToken(req.params.token);
  if (!customer) return res.status(404).json({ error: 'This private tracking link is invalid or no longer available.' });
  if (customer.workflow.stage !== 'content_approval') return res.status(400).json({ error: 'This website is not currently awaiting approval.' });
  const action = req.body?.action;
  if (!['approve','request_changes'].includes(action)) return res.status(400).json({ error: 'Choose approval or request changes.' });
  const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.slice(0, 2000).trim() : '';
  if (action === 'request_changes' && feedback.length < 5) return res.status(400).json({ error: 'Please describe the requested changes.' });
  const stored = customer.workflows[customer.id];
  stored.stage = action === 'approve' ? 'launch_setup' : 'revision_requested';
  stored.revisionFeedback = action === 'request_changes' ? feedback : '';
  stored.revisionRequestedAt = action === 'request_changes' ? new Date().toISOString() : stored.revisionRequestedAt || '';
  stored.contentApprovedAt = action === 'approve' ? new Date().toISOString() : '';
  stored.launchChecklist = { ...(stored.launchChecklist || {}), approval: action === 'approve' };
  stored.notes = `${stored.notes || ''}\nCustomer ${action === 'approve' ? 'approved the website for launch' : `requested revisions: ${feedback}`}.`.trim();
  stored.updatedAt = new Date().toISOString();
  await writeWorkflows(customer.workflows);
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
    transporter.sendMail({ from: `NiroLife <${process.env.SMTP_USER}>`, to: process.env.LEAD_EMAIL || process.env.SMTP_USER, subject: action === 'approve' ? `Website approved: ${customer.enquiry.practice}` : `Revisions requested: ${customer.enquiry.practice}`, text: action === 'approve' ? `${customer.enquiry.contactName} approved ${customer.enquiry.practice} for launch. Complete the launch checklist in the admin dashboard.` : `${customer.enquiry.contactName} requested revisions for ${customer.enquiry.practice}:\n\n${feedback}\n\nUpdate the website and resend it for approval.` }).catch(error => console.error('Approval email failed:', error.message));
  }
  res.json({ saved: true, stage: stored.stage, message: action === 'approve' ? 'Website approved for launch.' : 'Revision request received.' });
});

app.get('/api/admin/enquiries', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return res.status(503).json({ error: 'Admin access is not configured.' });
  if (req.get('x-admin-key') !== adminKey) return res.status(401).json({ error: 'Invalid admin password.' });
  const workflows = await readWorkflows();
  const enrich = rows => rows.map(item => ({ ...item, workflow: workflowFor(item.id, workflows, item.status), previewUrl: item.preview?.siteSlug ? `/preview.html?site=${encodeURIComponent(item.preview.siteSlug)}` : '' }));
  const db = getPool();
  if (db) {
    try { const [rows] = await db.query('SELECT id,contact_name AS contactName,email,phone,package_name AS package,practice_name AS practice,practice_type AS type,specialty,city,message,preview_json AS preview,status,created_at AS createdAt FROM enquiries ORDER BY created_at DESC'); rows.forEach(row => { if (typeof row.preview === 'string') { try { row.preview = JSON.parse(row.preview); } catch (_error) { row.preview = {}; } } }); return res.json(enrich(rows)); }
    catch (_error) { /* Fall through to file store. */ }
  }
  res.json(enrich(await readEnquiries()));
});

app.get('/api/admin/workflow-stages', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.get('x-admin-key') !== adminKey) return res.status(401).json({ error: 'Invalid admin password.' });
  res.json(WORKFLOW_STAGES);
});

app.get('/api/admin/analytics', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.get('x-admin-key') !== adminKey) return res.status(401).json({ error: 'Invalid admin password.' });
  const events = await readEvents();
  const totals = events.reduce((summary, event) => { summary[event.name] = (summary[event.name] || 0) + 1; return summary; }, {});
  const pages = events.filter(event => event.name === 'page_view').reduce((summary, event) => { summary[event.page] = (summary[event.page] || 0) + 1; return summary; }, {});
  res.json({ totals, pages, recent: events.slice(0, 50) });
});

app.post('/api/admin/enquiries/:id/publish-free', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.get('x-admin-key') !== adminKey) return res.status(401).json({ error: 'Invalid admin password.' });
  const checks = req.body?.checks || {};
  if (!['identity','contact','content'].every(key => checks[key] === true)) return res.status(400).json({ error: 'Confirm identity, contact details and public content before publishing.' });
  let enquiries = await readEnquiries();
  let enquiry = enquiries.find(item => String(item.id) === String(req.params.id));
  const db = getPool();
  if (!enquiry && db && /^\d+$/.test(req.params.id)) {
    try {
      const [rows] = await db.query('SELECT id,contact_name AS contactName,email,phone,package_name AS package,practice_name AS practice,preview_json AS preview,status,created_at AS createdAt FROM enquiries WHERE id = ? LIMIT 1', [req.params.id]);
      enquiry = rows[0];
      if (enquiry && typeof enquiry.preview === 'string') { try { enquiry.preview = JSON.parse(enquiry.preview); } catch (_error) { enquiry.preview = {}; } }
    } catch (_error) { /* File storage remains available. */ }
  }
  if (!enquiry) return res.status(404).json({ error: 'Enquiry not found.' });
  if (enquiry.package !== 'Free Live Website') return res.status(400).json({ error: 'This action is only available for the Free Live Website plan.' });
  if (enquiry.preview?.onboarding?.verified !== true) return res.status(400).json({ error: 'The customer has not confirmed authority to publish these business details.' });
  const siteSlug = String(enquiry.preview?.siteSlug || '').replace(/[^a-z0-9-]/g, '');
  if (!siteSlug) return res.status(400).json({ error: 'The original website preview is unavailable.' });
  const practices = await readPractices();
  const profile = practices.find(item => item.slug === siteSlug);
  if (!profile) return res.status(404).json({ error: 'The website preview record was not found.' });
  const onboarding = enquiry.preview.onboarding || {};
  Object.assign(profile, {
    address: onboarding.address || profile.address || '',
    hours: onboarding.hours || profile.hours || '',
    whatsapp: onboarding.businessWhatsapp || profile.whatsapp || profile.phone || '',
    services: onboarding.services || profile.services || '',
    qualifications: onboarding.qualifications || profile.qualifications || '',
    publicationStatus: 'live',
    verifiedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  await writePractices(practices);
  const workflows = await readWorkflows();
  const existing = workflows[String(enquiry.id)] || {};
  const liveUrl = `https://nirolife.com/sites/${siteSlug}`;
  workflows[String(enquiry.id)] = { ...existing, stage:'live', liveUrl, launchedAt:new Date().toISOString(), launchChecklist:{ domain:true, dns:true, ssl:true, contact:true, forms:true, analytics:true, approval:true, verification:true }, notes:`${existing.notes || ''}\nFree website verified and published on the NiroLife address.`.trim(), updatedAt:new Date().toISOString() };
  await writeWorkflows(workflows);
  if (db && /^\d+$/.test(String(enquiry.id))) { try { await db.query('UPDATE enquiries SET status = ? WHERE id = ?', ['won', enquiry.id]); } catch (_error) { /* File record is updated below when present. */ } }
  const fileEnquiry = enquiries.find(item => String(item.id) === String(enquiry.id));
  if (fileEnquiry) { fileEnquiry.status = 'won'; await writeEnquiries(enquiries); }
  const workflow = workflowFor(enquiry.id, workflows, 'won');
  sendCustomerStatusEmail(enquiry, workflow, 'Your free NiroLife website is live').catch(error => console.error('Free website email failed:', error.message));
  res.json({ published:true, liveUrl, workflow });
});

app.patch('/api/admin/enquiries/:id', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.get('x-admin-key') !== adminKey) return res.status(401).json({ error: 'Invalid admin password.' });
  const requestedStage = req.body?.workflowStage;
  const legacyAllowed = ['new', 'contacted', 'qualified', 'won', 'closed'];
  if (requestedStage && !WORKFLOW_STAGES[requestedStage]) return res.status(400).json({ error: 'Invalid workflow stage.' });
  const status = requestedStage ? WORKFLOW_STAGES[requestedStage].legacy : req.body?.status;
  if (!legacyAllowed.includes(status)) return res.status(400).json({ error: 'Invalid lead status.' });
  const workflows = await readWorkflows();
  const existing = workflows[String(req.params.id)] || {};
  const previousStage = workflowFor(req.params.id, workflows, status).stage;
  const quoteAmount = typeof req.body?.quoteAmount === 'string' ? req.body.quoteAmount.replace(/[^0-9,]/g, '').slice(0, 20) : existing.quoteAmount || '';
  const paymentInstructions = typeof req.body?.paymentInstructions === 'string' ? req.body.paymentInstructions.slice(0, 1000) : existing.paymentInstructions || '';
  const safeUrl = value => typeof value === 'string' && (/^https:\/\//i.test(value) || /^\/[a-z0-9]/i.test(value)) ? value.slice(0, 500) : '';
  const finalPreviewUrl = typeof req.body?.finalPreviewUrl === 'string' ? safeUrl(req.body.finalPreviewUrl) : existing.finalPreviewUrl || '';
  const liveUrl = typeof req.body?.liveUrl === 'string' ? (/^https:\/\//i.test(req.body.liveUrl) ? req.body.liveUrl.slice(0, 500) : '') : existing.liveUrl || '';
  const checklistKeys = ['domain','dns','ssl','contact','forms','analytics','approval'];
  const launchChecklist = req.body?.launchChecklist && typeof req.body.launchChecklist === 'object' ? checklistKeys.reduce((result, key) => { result[key] = req.body.launchChecklist[key] === true; return result; }, {}) : existing.launchChecklist || {};
  if (requestedStage === 'content_approval' && !finalPreviewUrl) return res.status(400).json({ error: 'Add the final website preview link before requesting approval.' });
  if (requestedStage === 'live' && (!liveUrl || !checklistKeys.every(key => launchChecklist[key] === true))) return res.status(400).json({ error: 'Complete every launch check and enter the secure live website URL before marking it live.' });
  workflows[String(req.params.id)] = {
    stage: requestedStage || workflowFor(req.params.id, workflows, status).stage,
    notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 2000) : existing.notes || '',
    followUpAt: typeof req.body?.followUpAt === 'string' ? req.body.followUpAt.slice(0, 40) : existing.followUpAt || '',
    quoteAmount,
    paymentInstructions,
    paymentReportedAt: existing.paymentReportedAt || '',
    customerToken: existing.customerToken || crypto.randomBytes(24).toString('hex'),
    finalPreviewUrl,
    revisionFeedback: requestedStage === 'content_approval' ? '' : existing.revisionFeedback || '',
    revisionRequestedAt: existing.revisionRequestedAt || '',
    contentApprovedAt: requestedStage === 'content_approval' ? '' : existing.contentApprovedAt || '',
    launchChecklist,
    liveUrl,
    launchedAt: requestedStage === 'live' ? new Date().toISOString() : existing.launchedAt || '',
    updatedAt: new Date().toISOString()
  };
  await writeWorkflows(workflows);
  const db = getPool();
  let enquiry;
  if (db && /^\d+$/.test(req.params.id)) {
    try {
      await db.query('UPDATE enquiries SET status = ? WHERE id = ?', [status, req.params.id]);
      const [rows] = await db.query('SELECT id,contact_name AS contactName,email,package_name AS package,practice_name AS practice,status FROM enquiries WHERE id = ? LIMIT 1', [req.params.id]);
      enquiry = rows[0];
    } catch (_error) { /* Fall back to file storage. */ }
  }
  const enquiries = await readEnquiries();
  enquiry = enquiry || enquiries.find(item => String(item.id) === String(req.params.id));
  if (!enquiry) return res.status(404).json({ error: 'Enquiry not found.' });
  const fileEnquiry = enquiries.find(item => String(item.id) === String(req.params.id));
  if (fileEnquiry) { fileEnquiry.status = status; await writeEnquiries(enquiries); }
  const workflow = workflowFor(req.params.id, workflows, status);
  const shouldNotify = req.body?.notifyCustomer === true || (requestedStage && requestedStage !== previousStage);
  if (shouldNotify) sendCustomerStatusEmail(enquiry, workflow, quoteAmount ? 'Your NiroLife quotation and next step' : 'Your NiroLife website request has been updated').catch(error => console.error('Customer status email failed:', error.message));
  res.json({ updated: true, workflow, customerNotified: shouldNotify });
});

async function sendManualAttentionDigest() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return;
  const state = await readAutomationState();
  const lastSent = state.manualDigestAt ? new Date(state.manualDigestAt).getTime() : 0;
  if (Date.now() - lastSent < 6 * 60 * 60 * 1000) return;
  let enquiries = await readEnquiries();
  const db = getPool();
  if (db) {
    try { const [rows] = await db.query('SELECT id,contact_name AS contactName,email,phone,package_name AS package,practice_name AS practice,status,created_at AS createdAt FROM enquiries ORDER BY created_at DESC'); enquiries = rows; } catch (_error) { /* Use file store. */ }
  }
  const workflows = await readWorkflows();
  const waiting = enquiries.map(item => ({ ...item, workflow: workflowFor(item.id, workflows, item.status) })).filter(item => item.workflow.manual);
  if (!waiting.length) return;
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  const adminEmail = process.env.LEAD_EMAIL || process.env.SMTP_USER;
  const lines = waiting.map((item, index) => `${index + 1}. ${item.practice} — ${item.workflow.label}\nNext: ${item.workflow.nextAction}\nContact: ${item.contactName} · ${item.email} · ${item.phone}\nPackage: ${item.package}`).join('\n\n');
  await transporter.sendMail({ from: `NiroLife <${process.env.SMTP_USER}>`, to: adminEmail, subject: `${waiting.length} NiroLife customer${waiting.length === 1 ? '' : 's'} need manual attention`, text: `NiroLife workflow reminder\n\nThe following customers are waiting for manual feedback or setup:\n\n${lines}\n\nOpen the private dashboard: https://nirolife.com/admin.html` });
  state.manualDigestAt = new Date().toISOString();
  await writeAutomationState(state);
}

setTimeout(() => sendManualAttentionDigest().catch(error => console.error('Manual digest failed:', error.message)), 60 * 1000);
setInterval(() => sendManualAttentionDigest().catch(error => console.error('Manual digest failed:', error.message)), 60 * 60 * 1000);

app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.listen(port, () => console.log(`NiroLife listening on port ${port}`));
