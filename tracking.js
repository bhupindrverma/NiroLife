// Google Analytics 4. Loading this here keeps one measurement ID across public pages.
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-CSM92S2JGH');
const gaScript = document.createElement('script');
gaScript.async = true;
gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-CSM92S2JGH';
document.head.appendChild(gaScript);

const track = (name, details = {}) => fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, page: location.pathname, source: document.referrer, ...details }), keepalive: true }).catch(() => {});
track('page_view', { profession: document.body.dataset.profession || '' });
document.querySelectorAll('a[href*="#generator"]').forEach(link => link.addEventListener('click', () => track('generator_start', { profession: document.body.dataset.profession || '' })));
