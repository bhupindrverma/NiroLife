const keyInput = document.getElementById('adminKey');
const loginStatus = document.getElementById('loginStatus');
const board = document.getElementById('workflowBoard');
const metrics = document.getElementById('metrics');
const attentionList = document.getElementById('attentionList');
const filterSelect = document.getElementById('stageFilter');
let activeAdminKey = '';
let leads = [];
let stages = {};
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatDate = value => value ? new Date(value).toLocaleString() : 'Not scheduled';
const stageOptions = selected => Object.entries(stages).map(([key, item]) => `<option value="${key}"${key === selected ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
const previewUrl = lead => lead.previewUrl || (lead.preview?.siteSlug ? `/preview.html?site=${encodeURIComponent(lead.preview.siteSlug)}` : '');

function renderMetrics(analytics) {
  const totals = analytics.totals || {};
  const manual = leads.filter(lead => lead.workflow?.manual).length;
  const active = leads.filter(lead => !['closed','live','maintenance'].includes(lead.workflow?.stage)).length;
  metrics.innerHTML = [['Manual attention',manual],['Active customers',active],['Previews',totals.preview_created],['Enquiries',leads.length],['Live / managed',leads.filter(lead => ['live','maintenance'].includes(lead.workflow?.stage)).length]].map(([label,value]) => `<div class="metric"><strong>${value || 0}</strong><span>${label}</span></div>`).join('');
}
function renderAttention() {
  const waiting = leads.filter(lead => lead.workflow?.manual);
  attentionList.innerHTML = waiting.length ? waiting.map(lead => `<a href="#lead-${escapeHtml(lead.id)}"><strong>${escapeHtml(lead.practice)}</strong><span>${escapeHtml(lead.workflow.label)} · ${escapeHtml(lead.workflow.nextAction)}</span></a>`).join('') : '<p class="all-clear">✓ No customer currently needs manual feedback.</p>';
}
function renderBoard() {
  const visible = filterSelect.value === 'all' ? leads : leads.filter(lead => lead.workflow?.stage === filterSelect.value);
  board.innerHTML = visible.length ? visible.map(lead => {
    const workflow = lead.workflow || {}; const link = previewUrl(lead);
    const onboarding = lead.preview?.onboarding || {};
    const onboardingBlock = Object.keys(onboarding).length ? `<details class="onboarding-details"><summary>View onboarding details</summary><div class="customer-grid"><div><small>Domain</small><strong>${escapeHtml(onboarding.domain || 'Not decided')}</strong><p>${escapeHtml(onboarding.ownerName)}${onboarding.qualifications ? ` · ${escapeHtml(onboarding.qualifications)}` : ''}</p></div><div><small>Practice setup</small><strong>${escapeHtml(onboarding.hours || 'Hours not provided')}</strong><p>${escapeHtml(onboarding.address)}</p><p>${escapeHtml(onboarding.businessWhatsapp)}</p></div><div><small>Services and assets</small><p>${escapeHtml(onboarding.services)}</p>${onboarding.assetsUrl ? `<a href="${escapeHtml(onboarding.assetsUrl)}" target="_blank" rel="noopener">Open supplied assets ↗</a>` : '<p>No assets supplied</p>'}</div></div></details>` : '';
    return `<article class="customer-card ${workflow.manual ? 'needs-attention' : ''}" id="lead-${escapeHtml(lead.id)}"><header><div><span class="owner owner-${escapeHtml(workflow.owner)}">${workflow.manual ? 'Action needed' : escapeHtml(workflow.owner || 'automation')}</span><h2>${escapeHtml(lead.practice)}</h2><p>${escapeHtml(lead.type)} · ${escapeHtml(lead.specialty)} · ${escapeHtml(lead.city)}</p></div><time>${formatDate(lead.createdAt)}</time></header><div class="journey"><div><small>Current stage</small><select class="stage-select" data-id="${escapeHtml(lead.id)}">${stageOptions(workflow.stage)}</select></div><div class="next-action"><small>What happens next</small><strong>${escapeHtml(workflow.nextAction)}</strong></div></div><div class="customer-grid"><div><small>Customer</small><strong>${escapeHtml(lead.contactName)}</strong><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a><a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a></div><div><small>Selected offer</small><strong>${escapeHtml(lead.package)}</strong><p>${escapeHtml(lead.message)}</p></div><div><small>Follow-up</small><input class="follow-up" data-id="${escapeHtml(lead.id)}" type="datetime-local" value="${escapeHtml(workflow.followUpAt ? workflow.followUpAt.slice(0,16) : '')}"><button class="save-follow-up" data-id="${escapeHtml(lead.id)}">Save reminder</button></div></div>${onboardingBlock}<label class="notes-label">Internal notes<textarea class="notes" data-id="${escapeHtml(lead.id)}" placeholder="Add decisions, customer feedback or setup details…">${escapeHtml(workflow.notes)}</textarea></label><footer>${link ? `<a class="preview-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Open customer website ↗</a>` : '<span class="muted">Preview link unavailable for older enquiry</span>'}<button class="save-notes" data-id="${escapeHtml(lead.id)}">Save notes</button></footer></article>`;
  }).join('') : '<div class="empty">No customers in this stage.</div>';
  bindActions();
}
async function updateLead(id, changes, button) {
  if (button) button.disabled = true;
  try { const response = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': activeAdminKey }, body: JSON.stringify(changes) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Update failed.'); const lead = leads.find(item => String(item.id) === String(id)); if (lead && result.workflow) lead.workflow = result.workflow; renderAttention(); renderBoard(); }
  catch (error) { loginStatus.textContent = error.message; } finally { if (button) button.disabled = false; }
}
function bindActions() {
  document.querySelectorAll('.stage-select').forEach(select => select.addEventListener('change', () => updateLead(select.dataset.id, { workflowStage: select.value }, select)));
  document.querySelectorAll('.save-notes').forEach(button => button.addEventListener('click', () => { const notes = document.querySelector(`.notes[data-id="${CSS.escape(button.dataset.id)}"]`).value; updateLead(button.dataset.id, { workflowStage: leads.find(item => String(item.id) === String(button.dataset.id)).workflow.stage, notes }, button); }));
  document.querySelectorAll('.save-follow-up').forEach(button => button.addEventListener('click', () => { const followUpAt = document.querySelector(`.follow-up[data-id="${CSS.escape(button.dataset.id)}"]`).value; updateLead(button.dataset.id, { workflowStage: leads.find(item => String(item.id) === String(button.dataset.id)).workflow.stage, followUpAt }, button); }));
}
filterSelect.addEventListener('change', renderBoard);
document.getElementById('refreshButton').addEventListener('click', loadDashboard);
document.getElementById('loadButton').addEventListener('click', loadDashboard);
async function loadDashboard() {
  loginStatus.textContent = 'Loading…';
  try { activeAdminKey = keyInput.value || activeAdminKey; const headers = { 'x-admin-key': activeAdminKey }; const [leadResponse, analyticsResponse, stageResponse] = await Promise.all([fetch('/api/admin/enquiries', { headers }), fetch('/api/admin/analytics', { headers }), fetch('/api/admin/workflow-stages', { headers })]); const data = await leadResponse.json(); const analytics = await analyticsResponse.json(); stages = await stageResponse.json(); if (!leadResponse.ok) throw new Error(data.error || 'Unable to load customers.'); leads = data; document.getElementById('login').hidden = true; document.getElementById('dashboard').hidden = false; filterSelect.innerHTML = '<option value="all">All stages</option>' + stageOptions(''); renderMetrics(analytics); renderAttention(); renderBoard(); loginStatus.textContent = ''; }
  catch (error) { loginStatus.textContent = error.message; }
}
