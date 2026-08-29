const params = new URLSearchParams(location.search);
const siteSlug = params.get('site') || localStorage.getItem('nirolifeSlug') || '';
const form = document.getElementById('publishForm');
const steps = [...document.querySelectorAll('.form-step')];
const navSteps = [...document.querySelectorAll('[data-step-nav]')];
let currentStep = 1;
let practice = JSON.parse(localStorage.getItem('nirolifePreview') || '{}');
const clean = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const previewLink = siteSlug ? `preview.html?site=${encodeURIComponent(siteSlug)}` : 'preview.html';
document.getElementById('backToPreview').href = previewLink;
document.getElementById('successPreview').href = previewLink;

async function loadPractice() {
  if (siteSlug) { try { const response = await fetch(`/api/practices/${encodeURIComponent(siteSlug)}`); if (response.ok) practice = await response.json(); } catch (_error) {} }
  form.elements.contactName.value = practice.name || '';
  form.elements.email.value = practice.email || '';
  form.elements.phone.value = practice.whatsapp || practice.phone || '';
  form.elements.ownerName.value = practice.name || '';
  form.elements.address.value = practice.address || '';
  form.elements.hours.value = practice.hours || '';
  form.elements.businessWhatsapp.value = practice.whatsapp || practice.phone || '';
  form.elements.services.value = practice.services || '';
}
loadPractice();

function showStep(number) {
  currentStep = number;
  steps.forEach(step => step.classList.toggle('active', Number(step.dataset.step) === number));
  navSteps.forEach(item => { const n = Number(item.dataset.stepNav); item.classList.toggle('active', n === number); item.classList.toggle('complete', n < number); });
  scrollTo({ top: 0, behavior: 'smooth' });
}
function validateDetails() {
  const required = [...steps[1].querySelectorAll('[required]')];
  for (const field of required) { if (!field.checkValidity()) { field.reportValidity(); return false; } }
  return true;
}
function renderReview() {
  const data = new FormData(form); const addOns = data.getAll('addOns');
  document.getElementById('reviewSummary').innerHTML = `<div><small>Selected plan</small><strong>${clean(data.get('package'))}</strong><span>${addOns.length ? clean(addOns.join(' + ')) : 'No optional add-ons'}</span></div><div><small>Practice</small><strong>${clean(practice.practice || 'Your practice')}</strong><span>${clean(data.get('ownerName'))}${data.get('qualifications') ? ` · ${clean(data.get('qualifications'))}` : ''}</span></div><div><small>Contact</small><strong>${clean(data.get('contactName'))}</strong><span>${clean(data.get('email'))} · ${clean(data.get('phone'))}</span></div><div><small>Launch information</small><strong>${clean(data.get('domain') || 'Domain to be decided')}</strong><span>${clean(data.get('address'))}</span></div>`;
}
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => { if (currentStep === 2 && !validateDetails()) return; if (currentStep === 2) renderReview(); showStep(currentStep + 1); }));
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => showStep(currentStep - 1)));
navSteps.forEach(button => button.addEventListener('click', () => { const target = Number(button.dataset.stepNav); if (target < currentStep) showStep(target); }));

form.addEventListener('submit', async event => {
  event.preventDefault(); const button = document.getElementById('submitRequest'); const status = document.getElementById('formStatus');
  button.disabled = true; button.textContent = 'Submitting…'; status.textContent = '';
  const data = new FormData(form);
  const onboarding = { domain: data.get('domain'), ownerName: data.get('ownerName'), qualifications: data.get('qualifications'), address: data.get('address'), hours: data.get('hours'), businessWhatsapp: data.get('businessWhatsapp'), services: data.get('services'), assetsUrl: data.get('assetsUrl'), verified: Boolean(data.get('verified')) };
  const payload = { contactName: data.get('contactName'), email: data.get('email'), phone: data.get('phone'), package: data.get('package'), addOns: data.getAll('addOns').join(', '), practice: practice.practice || 'Website preview', type: practice.type || '', specialty: practice.specialty || practice.type || '', city: practice.city || '', message: data.get('message'), onboarding, preview: { ...practice, siteSlug } };
  try {
    const response = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to submit your request.');
    steps[2].classList.remove('active'); document.querySelector('.steps').hidden = true; document.getElementById('successPanel').hidden = false;
    document.getElementById('successMessage').textContent = data.get('package') === 'Free Preview' ? 'Your preview remains available. We have saved your interest and will contact you only about this request.' : 'Your details are ready for review. We will contact you before any payment or publishing work begins.';
  } catch (error) { status.textContent = `${error.message} You can also email help@nirolife.com.`; button.disabled = false; button.textContent = 'Submit publishing request'; }
});
