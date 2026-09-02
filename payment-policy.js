const CURRENCIES = ['INR', 'USD', 'GBP', 'EUR'];
const REGIONS = ['IN', 'OVERSEAS'];
const DOMESTIC_INSTRUCTIONS = 'Pay the confirmed INR quotation by UPI to 8728834646@upi. Expected recipient name: Niro Life. Check the recipient shown in your UPI app before paying. If the name differs, stop and contact help@nirolife.com. Report the transaction reference below after payment. Payment is verified manually.';
function paymentDetails(workflow) {
  const quoteCurrency = CURRENCIES.includes(workflow.quoteCurrency) ? workflow.quoteCurrency : 'INR';
  const base = { quoteCurrency, paymentReady: false, paymentMethod: '', paymentInstructions: 'Please contact NiroLife to confirm your billing location and payment instructions before paying.' };
  if (!workflow.quoteAmount) return base;
  if (workflow.billingRegion === 'OVERSEAS' && quoteCurrency !== 'INR') {
    return { ...base, paymentReady: true, paymentMethod: 'PayPal', paymentInstructions: 'Pay the confirmed quotation in ' + quoteCurrency + ' through PayPal to swayambhucomics@gmail.com for your NiroLife website service. Check the recipient and currency before confirming. If PayPal is unavailable in your country or you need an invoice, contact help@nirolife.com before paying. Report the PayPal transaction reference below. Payment is verified manually.' };
  }
  if (workflow.billingRegion === 'IN' && quoteCurrency === 'INR') {
    return { ...base, paymentReady: true, paymentMethod: 'Domestic payment', paymentInstructions: workflow.paymentInstructions?.trim() || DOMESTIC_INSTRUCTIONS };
  }
  return base;
}
module.exports = { CURRENCIES, REGIONS, paymentDetails, DOMESTIC_INSTRUCTIONS };
