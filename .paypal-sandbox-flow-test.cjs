const assert = require('node:assert/strict');
const {install} = require('./paypal-sandbox');
const routes = {}, records = new Map(), calls = [];
let subscriptionStatus = 'APPROVAL_PENDING', verify = 'FAILURE';
const pool = { async query(sql, args=[]) {
  if (sql.startsWith('CREATE')) return [[]];
  if (sql.startsWith('INSERT')) { records.set(args[0],args[1]); return [{}]; }
  if (sql.includes("LIKE 'sub:%'")) return [[...records].filter(([k])=>k.startsWith('sub:')).map(([,v])=>({state_json:v}))];
  return [records.has(args[0]) ? [{state_json:records.get(args[0])}] : []];
}};
process.env.ADMIN_KEY='test-key'; process.env.PAYPAL_MODE='sandbox';
process.env.PAYPAL_CLIENT_ID='dummy-id'; process.env.PAYPAL_CLIENT_SECRET='dummy-secret';
global.fetch=async (url, options) => {
  assert.ok(url.startsWith('https://api-m.sandbox.paypal.com/'));
  calls.push(url);
  let data;
  const body=options.body?.startsWith('{')?JSON.parse(options.body):{};
  if(url.endsWith('/token')) data={access_token:'test-token',expires_in:3600};
  else if(url.endsWith('/products')) data={id:'PROD-TEST'};
  else if(url.endsWith('/plans')) {
    assert.equal(body.billing_cycles[0].frequency.interval_unit,'MONTH');
    data={id:'P-'+body.billing_cycles[0].pricing_scheme.fixed_price.currency_code};
  } else if(url.endsWith('/webhooks')) data=options.method==='GET'?{webhooks:[]}:{id:'WH-TEST'};
  else if(url.endsWith('/verify-webhook-signature')) data={verification_status:verify};
  else if(url.endsWith('/subscriptions')) {
    assert.equal(body.plan_id,'P-USD'); assert.equal(body.application_context.user_action,'SUBSCRIBE_NOW');
    data={id:'I-TEST',status:subscriptionStatus,links:[{rel:'approve',href:'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=test'}]};
  } else if(url.endsWith('/cancel')) {subscriptionStatus='CANCELLED';return {ok:true,status:204};}
  else if(url.endsWith('/I-TEST')) data={id:'I-TEST',plan_id:'P-USD',status:subscriptionStatus,billing_info:{next_billing_time:'2026-10-03T00:00:00Z'}};
  else throw Error('Unexpected URL '+url);
  return {ok:true,status:200,json:async()=>data};
};
install({get:(p,h)=>routes['GET '+p]=h,post:(p,h)=>routes['POST '+p]=h},()=>pool);
async function run(method,path,body={},params={},headers={}) {
  const response={code:200,set(){return this},status(n){this.code=n;return this},json(d){this.body=d;return this},sendStatus(n){this.code=n;return this}};
  await routes[method+' '+path]({body,params,get:n=>n==='x-admin-key'?'test-key':headers[n]},response);
  return response;
}
(async()=>{
  let r=await run('POST','/api/admin/paypal-sandbox/setup');
  assert.equal(r.code,200);assert.equal(r.body.configured,true);assert.equal(Object.keys(r.body.plans).length,3);
  const count=calls.length;await run('POST','/api/admin/paypal-sandbox/setup');assert.equal(calls.length,count);
  r=await run('POST','/api/admin/paypal-sandbox/test',{currency:'INR'});assert.equal(r.code,400);
  r=await run('POST','/api/admin/paypal-sandbox/test',{currency:'USD'});assert.equal(r.body.status,'APPROVAL_PENDING');
  await run('POST','/api/admin/paypal-sandbox/test',{currency:'USD'});
  assert.equal(calls.filter(url=>url.endsWith('/subscriptions')).length,1);
  subscriptionStatus='ACTIVE';
  r=await run('POST','/api/admin/paypal-sandbox/:id/refresh',{}, {id:'I-TEST'});assert.equal(r.body.status,'ACTIVE');
  const headers=Object.fromEntries(['paypal-transmission-id','paypal-transmission-time','paypal-cert-url','paypal-auth-algo','paypal-transmission-sig'].map(k=>[k,'test']));
  r=await run('POST','/api/paypal/sandbox/webhook',{resource:{billing_agreement_id:'I-TEST'}},{},headers);assert.equal(r.code,401);
  verify='SUCCESS';
  r=await run('POST','/api/paypal/sandbox/webhook',{resource:{billing_agreement_id:'I-TEST'}},{},headers);assert.equal(r.code,200);
  r=await run('POST','/api/admin/paypal-sandbox/:id/cancel',{}, {id:'I-TEST'});assert.equal(r.body.status,'CANCELLED');
  assert.equal(JSON.parse(records.get('sub:I-TEST')).status,'CANCELLED');
  console.log('Mocked setup, retry safety, approval state, forged webhook rejection, verified refresh and cancellation passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
