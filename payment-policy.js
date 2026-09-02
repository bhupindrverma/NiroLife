const CURRENCIES = ['INR', 'USD', 'GBP', 'EUR'];
const REGIONS = ['IN', 'OVERSEAS'];
function paymentDetails(workflow) {
  const quoteCurrency = CURRENCIES.includes(workflow.quoteCurrency) ? workflow.quoteCurrency : 'INR';
  const base = { quoteCurrency, paymentReady: false, paymentMethod: '', paymentInstructions: 'Please contact NiroLife to confirm your billing location and payment instructions before paying.' };
  if (!workflow.quoteAmount) return base;
  if (workflow.billingRegion === 'OVERSEAS' && quoteCurrency !== 'INR') {
    return { ...base, paymentReady: true, paymentMethod: 'PayPal', paymentInstructions: 'Pay the confirmed quotation in ' + quoteCurrency + ' through PayPal to swayambhucomics@gmail.com for your NiroLife website service. Check the recipient and currency before confirming. If PayPal is unavailable in your country or you need an invoice, contact help@nirolife.com before paying. Report the PayPal transaction reference below. Payment is verified manually.' };
  }
  if (workflow.billingRegion === 'IN' && quoteCurrency === 'INR' && workflow.paymentInstructions?.trim()) {
    return { ...base, paymentReady: true, paymentMethod: 'Domestic payment', paymentInstructions: workflow.paymentInstructions };
  }
  return base;
}
module.exports = { CURRENCIES, REGIONS, paymentDetails };
