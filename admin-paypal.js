(() => {
  const panel = document.createElement('section');
  panel.className = 'customer-card';
  panel.style.cssText = 'margin:24px 0;padding:24px';
  panel.innerHTML = '<h2>PayPal recurring payments — sandbox only</h2><p>Managed Website: USD 29 / GBP 25 / EUR 29 per month. Setup fees are separate. India remains manual INR 1,999/month. No live customer billing is enabled.</p><p>Test subscriptions start on sandbox approval. Production subscriptions must only start after website launch and customer approval.</p><button type="button" data-action="connect">Test connection / refresh</button> <button type="button" data-action="setup">Prepare sandbox plans and notifications</button><p role="status" class="paypal-message"></p><div class="paypal-tests"></div>';
  document.getElementById('dashboard').append(panel);
  const message = panel.querySelector('.paypal-message');
  const output = panel.querySelector('.paypal-tests');
  async function request(path, body) {
    if (!activeAdminKey) throw Error('Sign in to the admin dashboard first.');
    const response = await fetch('/api/admin/paypal-sandbox' + path, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'x-admin-key': activeAdminKey, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Sandbox request failed.');
    return data;
  }
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };
  function render(data) {
    output.replaceChildren();
    output.append(text('p', data.configured ? 'Sandbox plans and webhook are configured.' : 'Credentials work. Prepare sandbox plans next.'));
    if (data.configured) {
      ['USD','GBP','EUR'].forEach(currency => {
        const button = text('button', 'Create/open ' + currency + ' test');
        button.type = 'button'; button.dataset.action = 'test'; button.dataset.currency = currency; output.append(button);
      });
    }
    for (const sub of data.subscriptions || []) {
      const row = document.createElement('div'); row.style.cssText = 'padding:16px 0;border-bottom:1px solid #ddd';
      row.append(text('strong', sub.currency + ' ' + sub.amount + '/month — ' + sub.status));
      row.append(text('p', 'Test ID: ' + sub.id + '. Next billing: ' + (sub.nextBillingTime || 'not scheduled') + '. Failed payments: ' + (sub.failedPayments || 0)));
      if (sub.lastPayment) row.append(text('p', 'Last sandbox payment: ' + sub.lastPayment.amount?.currency_code + ' ' + sub.lastPayment.amount?.value + ' at ' + sub.lastPayment.time));
      if (sub.status === 'APPROVAL_PENDING' && sub.approvalUrl && new URL(sub.approvalUrl).origin === 'https://www.sandbox.paypal.com') {
        const link = text('a', 'Approve with a sandbox buyer account ↗'); link.href = sub.approvalUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; row.append(link);
      }
      for (const action of ['refresh','cancel']) {
        if (action === 'cancel' && !['ACTIVE','SUSPENDED'].includes(sub.status)) continue;
        const button = text('button', action === 'cancel' ? 'Cancel sandbox subscription' : 'Refresh from PayPal');
        button.type = 'button'; button.dataset.action = action; button.dataset.id = sub.id; row.append(button);
      }
      output.append(row);
    }
  }
  panel.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    if (button.dataset.action === 'cancel' && !confirm('Cancel this sandbox test subscription? No live payments are affected.')) return;
    panel.querySelectorAll('button').forEach(item => item.disabled = true);
    message.textContent = 'Working with PayPal sandbox…';
    try {
      const action = button.dataset.action;
      if (action === 'setup') await request('/setup', {});
      else if (action === 'test') await request('/test', { currency: button.dataset.currency });
      else if (action !== 'connect') await request('/' + encodeURIComponent(button.dataset.id) + '/' + action, {});
      render(await request(''));
      message.textContent = 'Sandbox connection verified. Live recurring billing remains disabled.';
    } catch (error) { message.textContent = error.message; }
    finally { panel.querySelectorAll('button').forEach(item => item.disabled = false); }
  });
})();
