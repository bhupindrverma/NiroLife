// Sandbox-only workbench. No route in this module can call PayPal's live API.
const crypto = require('crypto');
const PRICES = Object.freeze({ USD: '29.00', GBP: '25.00', EUR: '29.00' });
const API = 'https://api-m.sandbox.paypal.com';
const HOOK = 'https://nirolife.com/api/paypal/sandbox/webhook';
function planBody(productId, currency) {
  if (!Object.hasOwn(PRICES, currency)) throw Error('Unsupported subscription currency.');
  return { product_id: productId, name: 'NiroLife Managed Website ' + currency + ' monthly v1',
    status: 'ACTIVE', description: 'Monthly maintenance; setup and domain fees excluded.',
    billing_cycles: [{ frequency: { interval_unit: 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR',
      sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { currency_code: currency, value: PRICES[currency] } } }],
    payment_preferences: { auto_bill_outstanding: false, payment_failure_threshold: 2 } };
}
function install(app, getPool) {
  let accessToken = '', expires = 0, pending = Promise.resolve();
  const serial = task => { const next = pending.then(task, task); pending = next.catch(() => {}); return next; };
  const enabled = () => {
    if (process.env.PAYPAL_MODE !== 'sandbox') throw Error('Sandbox mode is required. Live billing is disabled.');
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) throw Error('PayPal sandbox credentials are missing.');
  };
  async function token() {
    enabled();
    if (accessToken && Date.now() < expires) return accessToken;
    const response = await fetch(API + '/v1/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Basic ' + Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials' });
    if (!response.ok) throw Error('PayPal sandbox authentication failed. Check the saved sandbox credentials.');
    const data = await response.json();
    if (!data.access_token) throw Error('PayPal did not return an access token.');
    accessToken = data.access_token; expires = Date.now() + Math.max(0, Number(data.expires_in) - 60) * 1000;
    return accessToken;
  }
  async function api(path, body, requestId) {
    const response = await fetch(API + path, { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json', Prefer: 'return=representation',
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw Error('PayPal sandbox request failed (HTTP ' + response.status + '). Check the PayPal sandbox event log.');
    return response.status === 204 ? {} : response.json();
  }
  async function db() {
    const pool = getPool();
    if (!pool) throw Error('Database storage is required for subscription tests.');
    await pool.query('CREATE TABLE IF NOT EXISTS paypal_sandbox_state (state_key VARCHAR(100) PRIMARY KEY, state_json LONGTEXT NOT NULL) ENGINE=InnoDB');
    return pool;
  }
  async function read(key, fallback = null) {
    const [rows] = await (await db()).query('SELECT state_json FROM paypal_sandbox_state WHERE state_key=?', [key]);
    return rows.length ? JSON.parse(rows[0].state_json) : fallback;
  }
  async function save(key, value) {
    await (await db()).query('INSERT INTO paypal_sandbox_state (state_key,state_json) VALUES (?,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)', [key, JSON.stringify(value)]);
  }
  async function summary() {
    const config = await read('config', {});
    const [rows] = await (await db()).query("SELECT state_json FROM paypal_sandbox_state WHERE state_key LIKE 'sub:%'");
    return { mode: 'sandbox', liveBillingEnabled: false, prices: PRICES, configured: Boolean(config.webhookId),
      plans: config.plans || {}, subscriptions: rows.map(row => JSON.parse(row.state_json)) };
  }
  async function sync(id) {
    const record = await read('sub:' + id);
    if (!record) throw Error('Unknown sandbox test subscription.');
    const data = await api('/v1/billing/subscriptions/' + encodeURIComponent(id));
    if (data.plan_id !== record.planId) throw Error('Subscription plan mismatch.');
    record.status = data.status;
    record.nextBillingTime = data.billing_info?.next_billing_time || '';
    record.lastPayment = data.billing_info?.last_payment || null;
    record.failedPayments = data.billing_info?.failed_payments_count || 0;
    record.updatedAt = new Date().toISOString();
    await save('sub:' + id, record);
    return record;
  }
  const route = action => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!process.env.ADMIN_KEY || req.get('x-admin-key') !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'Admin sign-in required.' });
    try { enabled(); res.json(await serial(() => action(req))); }
    catch (error) { res.status(400).json({ error: error.message.startsWith('PayPal') || error.message.includes('subscription') || error.message.includes('Sandbox') || error.message.includes('Database') ? error.message : 'Sandbox operation could not be completed. Check configuration and retry.' }); }
  };
  app.get('/api/admin/paypal-sandbox', route(async () => { await token(); return summary(); }));
  app.post('/api/admin/paypal-sandbox/setup', route(async () => {
    let config = await read('config', { plans: {} });
    if (!config.productId) {
      const product = await api('/v1/catalogs/products', { name: 'NiroLife Managed Website Sandbox', type: 'SERVICE', description: 'Test-only monthly website maintenance' }, 'nirolife-sandbox-product-v1');
      config.productId = product.id; await save('config', config);
    }
    for (const currency of Object.keys(PRICES)) {
      if (!config.plans[currency]) {
        const plan = await api('/v1/billing/plans', planBody(config.productId, currency), 'nirolife-sandbox-plan-v1-' + currency);
        config.plans[currency] = plan.id; await save('config', config);
      }
    }
    if (!config.webhookId) {
      const hooks = await api('/v1/notifications/webhooks');
      const existing = hooks.webhooks?.find(hook => hook.url === HOOK);
      const hook = existing || await api('/v1/notifications/webhooks', { url: HOOK, event_types: [
        { name: 'BILLING.SUBSCRIPTION.ACTIVATED' }, { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
        { name: 'BILLING.SUBSCRIPTION.SUSPENDED' }, { name: 'BILLING.SUBSCRIPTION.EXPIRED' },
        { name: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' }, { name: 'PAYMENT.SALE.COMPLETED' }] });
      config.webhookId = hook.id; await save('config', config);
    }
    return summary();
  }));
  app.post('/api/admin/paypal-sandbox/test', route(async req => {
    const currency = req.body?.currency;
    if (!Object.hasOwn(PRICES, currency)) throw Error('Unsupported subscription currency.');
    const config = await read('config', {});
    if (!config.plans?.[currency] || !config.webhookId) throw Error('PayPal sandbox setup must be completed first.');
    // Persist retry identity before calling PayPal. One unfinished test per currency.
    const pendingKey = 'pending:' + currency;
    let attempt = await read(pendingKey);
    if (!attempt) { attempt = { requestId: crypto.randomUUID(), createdAt: Date.now() }; await save(pendingKey, attempt); }
    if (Date.now() - attempt.createdAt > 70 * 3600000) throw Error('PayPal test request is older than the safe retry window. Review it manually.');
    if (attempt.subscriptionId) return sync(attempt.subscriptionId);
    const data = await api('/v1/billing/subscriptions', { plan_id: config.plans[currency], custom_id: attempt.requestId,
      application_context: { brand_name: 'NiroLife SANDBOX', shipping_preference: 'NO_SHIPPING', user_action: 'SUBSCRIBE_NOW',
        return_url: 'https://nirolife.com/admin.html?paypal=sandbox-return', cancel_url: 'https://nirolife.com/admin.html?paypal=sandbox-cancel' } }, attempt.requestId);
    const approvalUrl = data.links?.find(link => link.rel === 'approve')?.href;
    if (!approvalUrl || new URL(approvalUrl).origin !== 'https://www.sandbox.paypal.com') throw Error('PayPal returned an unexpected sandbox approval URL.');
    const record = { id: data.id, currency, amount: PRICES[currency], planId: config.plans[currency], status: data.status, approvalUrl, testOnly: true };
    await save('sub:' + data.id, record);
    attempt.subscriptionId = data.id; await save(pendingKey, attempt);
    return record;
  }));
  app.post('/api/admin/paypal-sandbox/:id/refresh', route(req => sync(req.params.id)));
  app.post('/api/admin/paypal-sandbox/:id/cancel', route(async req => {
    const record = await sync(req.params.id);
    if (['ACTIVE','SUSPENDED'].includes(record.status)) await api('/v1/billing/subscriptions/' + encodeURIComponent(record.id) + '/cancel', { reason: 'NiroLife sandbox cancellation test' });
    return sync(record.id);
  }));
  app.post('/api/paypal/sandbox/webhook', async (req, res) => {
    try {
      enabled();
      const config = await read('config', {});
      if (!config.webhookId) return res.sendStatus(503);
      const fields = { transmission_id: req.get('paypal-transmission-id'), transmission_time: req.get('paypal-transmission-time'),
        cert_url: req.get('paypal-cert-url'), auth_algo: req.get('paypal-auth-algo'), transmission_sig: req.get('paypal-transmission-sig') };
      if (Object.values(fields).some(value => !value)) return res.sendStatus(400);
      const verified = await api('/v1/notifications/verify-webhook-signature', { ...fields, webhook_id: config.webhookId, webhook_event: req.body });
      if (verified.verification_status !== 'SUCCESS') return res.sendStatus(401);
      const id = req.body.resource?.billing_agreement_id || req.body.resource?.id;
      if (typeof id === 'string' && await read('sub:' + id)) await serial(() => sync(id));
      // Refresh from PayPal instead of applying potentially duplicated or out-of-order event data.
      res.sendStatus(200);
    } catch (_) { res.sendStatus(503); }
  });
}
module.exports = { install, planBody, PRICES };
