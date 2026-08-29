const token = new URLSearchParams(location.search).get('token') || '';
const stages = ['payment_review','onboarding','content_approval','launch_setup','live','maintenance'];
const labels = ['Quotation','Onboarding','Website approval','Launch setup','Website live','Maintenance'];
let customer;
const el = id => document.getElementById(id);
const approvalStyle = document.createElement('link'); approvalStyle.rel='stylesheet'; approvalStyle.href='approval.css'; document.head.appendChild(approvalStyle);
document.querySelector('.help').insertAdjacentHTML('beforebegin', `<section class="approval-card" id="approvalCard" hidden><div><span class="eyebrow">Final website review</span><h2>Your website is ready for approval.</h2><p>Check names, qualifications, services, contact details, links and spelling before approving.</p><a id="finalPreviewLink" target="_blank" rel="noopener">Open final website preview ↗</a></div><div class="approval-actions"><label>Revisions needed <small>Describe all requested changes together</small><textarea id="revisionFeedback" rows="4" maxlength="2000" placeholder="Please change…"></textarea></label><div><button type="button" id="requestChanges">Request revisions</button><button type="button" id="approveWebsite">Approve for launch</button></div><p id="approvalStatus" aria-live="polite"></p></div></section><section class="reported-card" id="revisionCard" hidden><b>Revisions requested</b><span id="revisionText"></span></section><section class="live-card" id="liveCard" hidden><span class="eyebrow">Website launched</span><h2>Your website is live.</h2><a id="liveLink" target="_blank" rel="noopener">Open live website ↗</a></section>`);
const clean = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function renderTimeline(stage, packageName = '') {
  const isFreeLive = packageName === 'Free Live Website';
  const flow = isFreeLive ? ['verification_review','live'] : stages;
  const flowLabels = isFreeLive ? ['Business verification','Website live'] : labels;
  let index = flow.indexOf(stage); if (!isFreeLive && stage === 'revision_requested') index = 2; if (stage === 'manual_review' || stage === 'awaiting_customer') index = -1; if (stage === 'closed') index = 0;
  el('timeline').innerHTML = flowLabels.map((label, i) => `<div class="timeline-item ${i < index ? 'complete' : i === index ? 'active' : ''}"><i>${i < index ? '✓' : i + 1}</i><span>${clean(label)}</span></div>`).join('');
  el('progressCount').textContent = index < 0 ? 'Reviewing request' : `${Math.min(index + 1, flow.length)} of ${flow.length}`;
}
async function loadStatus() {
  if (!token) return showError('The private token is missing from this link.');
  try {
    const response = await fetch(`/api/customer/${encodeURIComponent(token)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load this request.'); customer = data;
    el('loading').hidden = true; el('portal').hidden = false; el('practiceName').textContent = data.practice; el('contactName').textContent = data.contactName; el('stageLabel').textContent = data.label; el('packageName').textContent = data.package; el('createdDate').textContent = new Date(data.createdAt).toLocaleDateString(); el('nextAction').textContent = data.nextAction;
    if (data.previewUrl) { el('previewLink').href = data.previewUrl; } else { el('previewLink').hidden = true; }
    renderTimeline(data.stage, data.package);
    if (data.paymentReportedAt) { el('reportedCard').hidden = false; }
    else if (data.stage === 'payment_review' && data.quoteAmount) { el('paymentCard').hidden = false; el('quoteAmount').textContent = data.quoteAmount; el('paymentInstructions').textContent = data.paymentInstructions || 'NiroLife will send payment instructions separately.'; }
    if (data.stage === 'content_approval' && data.finalPreviewUrl) { el('approvalCard').hidden=false; el('finalPreviewLink').href=data.finalPreviewUrl; }
    if (data.stage === 'revision_requested') { el('revisionCard').hidden=false; el('revisionText').textContent=data.revisionFeedback || 'Your requested changes are being completed.'; }
    if ((data.stage === 'live' || data.stage === 'maintenance') && data.liveUrl) { el('liveCard').hidden=false; el('liveLink').href=data.liveUrl; }
  } catch (error) { showError(error.message); }
}
function showError(message) { el('loading').hidden = true; el('errorPanel').hidden = false; el('errorMessage').textContent = message; }
el('paymentForm').addEventListener('submit', async event => { event.preventDefault(); const button=event.currentTarget.querySelector('button'); const status=el('paymentStatus'); button.disabled=true;button.textContent='Reporting…';try{const response=await fetch(`/api/customer/${encodeURIComponent(token)}/payment-reported`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:new FormData(event.currentTarget).get('reference')})});const result=await response.json();if(!response.ok)throw new Error(result.error);el('paymentCard').hidden=true;el('reportedCard').hidden=false;}catch(error){status.textContent=error.message||'Unable to report payment.';button.disabled=false;button.textContent='I have made the payment';}});
async function submitApproval(action) { const status=el('approvalStatus'); const feedback=el('revisionFeedback').value.trim(); const buttons=[el('requestChanges'),el('approveWebsite')]; if(action==='request_changes'&&feedback.length<5){status.textContent='Please describe the requested changes.';return;} buttons.forEach(button=>button.disabled=true);status.textContent=action==='approve'?'Saving approval…':'Sending revision request…';try{const response=await fetch(`/api/customer/${encodeURIComponent(token)}/approval`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,feedback})});const result=await response.json();if(!response.ok)throw new Error(result.error);el('approvalCard').hidden=true;if(action==='approve'){el('stageLabel').textContent='Launch preparation';el('nextAction').textContent='We are connecting the domain and completing launch checks.';}else{el('revisionCard').hidden=false;el('revisionText').textContent=feedback;el('stageLabel').textContent='Revisions in progress';}renderTimeline(result.stage);}catch(error){status.textContent=error.message||'Unable to save your decision.';buttons.forEach(button=>button.disabled=false);}}
el('requestChanges').addEventListener('click',()=>submitApproval('request_changes'));
el('approveWebsite').addEventListener('click',()=>submitApproval('approve'));
loadStatus();
