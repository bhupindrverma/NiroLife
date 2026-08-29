const track = (name, details = {}) => fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, page: location.pathname, source: document.referrer, ...details }), keepalive: true }).catch(() => {});
track('page_view', { profession: document.body.dataset.profession || '' });
document.querySelectorAll('a[href*="#generator"]').forEach(link => link.addEventListener('click', () => track('generator_start', { profession: document.body.dataset.profession || '' })));
