const assert = require('node:assert/strict');
const {install, planBody, PRICES} = require('./paypal-sandbox');
for (const [currency, amount] of Object.entries(PRICES)) {
  const plan = planBody('PROD-TEST', currency);
  assert.deepEqual(plan.billing_cycles[0].pricing_scheme.fixed_price, {currency_code:currency,value:amount});
  assert.equal(plan.billing_cycles[0].frequency.interval_unit,'MONTH');
  assert.equal(plan.billing_cycles[0].total_cycles,0);
  assert.equal(plan.payment_preferences.setup_fee,undefined);
}
assert.throws(()=>planBody('PROD-TEST','INR'));
const routes={};
const app={get:(p,h)=>routes['GET '+p]=h,post:(p,h)=>routes['POST '+p]=h};
install(app,()=>null);
function res(){return {code:200,set(){return this},status(c){this.code=c;return this},json(body){this.body=body;return this},sendStatus(c){this.code=c;return this}}}
(async()=>{
  process.env.ADMIN_KEY='test-admin';
  let r=res();
  await routes['GET /api/admin/paypal-sandbox']({get:()=>''},r);
  assert.equal(r.code,401);
  process.env.PAYPAL_MODE='live';
  r=res();
  await routes['GET /api/admin/paypal-sandbox']({get:()=> 'test-admin'},r);
  assert.equal(r.code,400);
  assert.match(r.body.error,/Live billing is disabled/);
  process.env.PAYPAL_MODE='sandbox';
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  r=res();
  await routes['GET /api/admin/paypal-sandbox']({get:()=> 'test-admin'},r);
  assert.equal(r.code,400);
  assert.match(r.body.error,/credentials are missing/);
  r=res();
  await routes['POST /api/paypal/sandbox/webhook']({get:()=>'',body:{}},r);
  assert.equal(r.code,503);
  console.log('Fixed prices, separate setup fees, admin auth, live lockout and missing credential tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
