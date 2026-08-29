const keyInput = document.getElementById('adminKey');
const status = document.getElementById('loginStatus');
const cards = document.getElementById('leadCards');
const metrics = document.getElementById('metrics');
let activeAdminKey = '';
const leadStatuses = ['new', 'contacted', 'qualified', 'won', 'closed'];
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

document.getElementById('loadButton').addEventListener('click', async () => {
  status.textContent = 'Loading…';
  try {
    const headers = { 'x-admin-key': keyInput.value };
    activeAdminKey = keyInput.value;
    const [response, analyticsResponse] = await Promise.all([fetch('/api/admin/enquiries', { headers }), fetch('/api/admin/analytics', { headers })]);
    const data = await response.json();
    const analytics = await analyticsResponse.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load enquiries.');
    document.getElementById('login').hidden = true;
    document.getElementById('dashboard').hidden = false;
    const totals = analytics.totals || {};
    metrics.innerHTML = [['Visitors',totals.page_view],['Generator starts',totals.generator_start],['Previews',totals.preview_created],['Claim opens',totals.claim_opened],['Enquiries',totals.enquiry_sent]].map(([label,value]) => `<div class="metric"><strong>${value || 0}</strong><span>${label}</span></div>`).join('');
    cards.innerHTML = data.length ? data.map(lead => `<article class="lead"><div><select class="status-select" data-id="${escapeHtml(lead.id)}" aria-label="Lead status">${leadStatuses.map(item => `<option value="${item}"${item === lead.status ? ' selected' : ''}>${item}</option>`).join('')}</select><h2>${escapeHtml(lead.practice)}</h2><p>${escapeHtml(lead.type)} · ${escapeHtml(lead.specialty)} · ${escapeHtml(lead.city)}</p></div><div><strong>${escapeHtml(lead.contactName)}</strong><p><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></p><p><a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a></p></div><div><strong>${escapeHtml(lead.package)}</strong><p>${escapeHtml(lead.message)}</p></div><time>${new Date(lead.createdAt).toLocaleString()}</time></article>`).join('') : '<div class="empty">No enquiries yet.</div>';
    document.querySelectorAll('.status-select').forEach(select => select.addEventListener('change', async () => {
      select.disabled = true;
      try {
        const update = await fetch(`/api/admin/enquiries/${encodeURIComponent(select.dataset.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': activeAdminKey }, body: JSON.stringify({ status: select.value }) });
        if (!update.ok) throw new Error('Status was not saved.');
      } catch (error) { status.textContent = error.message; }
      finally { select.disabled = false; }
    }));
  } catch (error) { status.textContent = error.message; }
});
