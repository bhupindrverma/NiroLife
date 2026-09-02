const assert = require('node:assert/strict');
const {paymentDetails} = require('./payment-policy');
for (const currency of ['USD','GBP','EUR']) {
  const result = paymentDetails({quoteAmount:'99.95',quoteCurrency:currency,billingRegion:'OVERSEAS',paymentInstructions:'UPI PRIVATE DOMESTIC INSTRUCTIONS'});
  assert.equal(result.paymentReady, true);
  assert.equal(result.paymentMethod, 'PayPal');
  assert.match(result.paymentInstructions, /swayambhucomics@gmail.com/);
  assert.ok(!result.paymentInstructions.includes('UPI'));
  assert.equal(result.quoteCurrency,currency);
}
for (const workflow of [
  {quoteAmount:'100',billingRegion:'OVERSEAS',quoteCurrency:'INR'},
  {quoteAmount:'100',billingRegion:'IN',quoteCurrency:'USD'},
  {quoteAmount:'100',quoteCurrency:'INR'},
  {billingRegion:'OVERSEAS',quoteCurrency:'USD'},
  {quoteAmount:'100',billingRegion:'IN',quoteCurrency:'INR'}
]) {
  const result=paymentDetails({...workflow,paymentInstructions:workflow.billingRegion==='IN'&&workflow.quoteCurrency==='INR'?'':'UPI secret'});
  assert.equal(result.paymentReady,false);
  assert.ok(!result.paymentInstructions.includes('UPI'));
}
assert.equal(paymentDetails({quoteAmount:'100',billingRegion:'IN',quoteCurrency:'INR',paymentInstructions:'UPI approved instructions'}).paymentInstructions,'UPI approved instructions');
console.log('9 payment routing cases passed');
