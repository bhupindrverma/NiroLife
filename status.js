const token = new URLSearchParams(location.search).get('token') || '';
const stages = ['payment_review','onboarding','content_approval','launch_setup','live','maintenance'];
const labels = ['Quotation','Onboarding','Website approval','Launch setup','Website live','Maintenance'];
let customer;
const el = id => document.getElementById(id);
const clean = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function renderTimeline(stage) {
  let index = stages.indexOf(stage); if (stage === 'manual_review' || stage === 'awaiting_customer') index = -1; if (stage === 'closed') index = 0;
  el('timeline').innerHTML = labels.map((label, i) => `<div class="timeline-item ${i < index ? 'complete' : i === index ? 'active' : ''}"><i>${i < index ? '✓' : i + 1}</i><span>${clean(label)}</span></div>`).join('');
  el('progressCount').textContent = index < 0 ? 'Reviewing request' : `${Math.min(index + 1, stages.length)} of ${stages.length}`;
}
async function loadStatus() {
  if (!token) return showError('The private token is missing from this link.');
  try {
    const response = await fetch(`/api/customer/${encodeURIComponent(token)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load this request.'); customer = data;
    el('loading').hidden = true; el('portal').hidden = false; el('practiceName').textContent = data.practice; el('contactName').textContent = data.contactName; el('stageLabel').textContent = data.label; el('packageName').textContent = data.package; el('createdDate').textContent = new Date(data.createdAt).toLocaleDateString(); el('nextAction').textContent = data.nextAction;
    if (data.previewUrl) { el('previewLink').href = data.previewUrl; } else { el('previewLink').hidden = true; }
    renderTimeline(data.stage);
    if (data.paymentReportedAt) { el('reportedCard').hidden = false; }
    else if (data.stage === 'payment_review' && data.quoteAmount) { el('paymentCard').hidden = false; el('quoteAmount').textContent = data.quoteAmount; el('paymentInstructions').textContent = data.paymentInstructions || 'NiroLife will send payment instructions separately.'; }
  } catch (error) { showError(error.message); }
}
function showError(message) { el('loading').hidden = true; el('errorPanel').hidden = false; el('errorMessage').textContent = message; }
el('paymentForm').addEventListener('submit', async event => { event.preventDefault(); const button=event.currentTarget.querySelector('button'); const status=el('paymentStatus'); button.disabled=true;button.textContent='Reporting…';try{const response=await fetch(`/api/customer/${encodeURIComponent(token)}/payment-reported`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:new FormData(event.currentTarget).get('reference')})});const result=await response.json();if(!response.ok)throw new Error(result.error);el('paymentCard').hidden=true;el('reportedCard').hidden=false;}catch(error){status.textContent=error.message||'Unable to report payment.';button.disabled=false;button.textContent='I have made the payment';}});
loadStatus();
