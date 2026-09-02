const form = document.getElementById('generatorForm');
const currencyScript = document.createElement('script'); currencyScript.src = '/currency.js'; document.head.append(currencyScript);
const modal = document.getElementById('previewModal');
const modalTitle = document.getElementById('previewTitle');
const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
const submitButton = form.querySelector('button[type="submit"]');
const stepOneNames = ['name', 'type', 'practice', 'specialty', 'city'];
const stepTwoNames = ['services', 'phone', 'whatsapp', 'email', 'address', 'hours', 'bio', 'color'];
const stepActions = document.createElement('div');
let generatedSlug = localStorage.getItem('nirolifeSlug') || '';
stepActions.className = 'step-actions';
stepActions.innerHTML = '<button class="button button-outline" type="button" id="backStep">← Back</button><button class="button button-primary" type="button" id="nextStep">Continue →</button>';
submitButton.before(stepActions);
let currentStep = 1;

function showStep(step) {
  currentStep = step;
  [...stepOneNames, ...stepTwoNames].forEach(name => {
    const control = form.elements[name];
    if (control) control.closest('label').hidden = step === 1 ? !stepOneNames.includes(name) : !stepTwoNames.includes(name);
  });
  document.getElementById('backStep').hidden = step === 1;
  document.getElementById('nextStep').hidden = step === 2;
  submitButton.hidden = step === 1;
  form.querySelector('.form-kicker').textContent = `STEP ${step} OF 2 · FREE WEBSITE PREVIEW`;
  form.querySelector('h3').textContent = step === 1 ? 'Start with your practice' : 'Add patient-friendly details';
}

document.getElementById('nextStep').addEventListener('click', () => {
  const invalid = stepOneNames.map(name => form.elements[name]).find(control => control && !control.checkValidity());
  if (invalid) return invalid.reportValidity();
  showStep(2);
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
document.getElementById('backStep').addEventListener('click', () => showStep(1));
showStep(1);
const requestedType = new URLSearchParams(window.location.search).get('type');
if (requestedType) {
  const typeSelect = form.elements.type;
  const matchingOption = [...typeSelect.options].find(option => option.value.toLowerCase() === requestedType.toLowerCase());
  if (matchingOption) typeSelect.value = matchingOption.value;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (currentStep !== 2) return showStep(2);
  const data = new FormData(form);
  const practice = data.get('practice') || 'Your practice';
  const profile = Object.fromEntries(data.entries());
  profile.practice = practice;
  localStorage.setItem('nirolifePreview', JSON.stringify(profile));
  fetch('/api/practices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    .then((response) => response.json())
    .then((result) => { if (result.slug) { generatedSlug = result.slug; localStorage.setItem('nirolifeSlug', result.slug); localStorage.setItem(`nirolifeEditToken:${result.slug}`, result.editToken || ''); } })
    .catch(() => { /* Local preview mode: browser storage remains the fallback. */ });
  modalTitle.textContent = `${practice} website preview`;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (typeof track === 'function') track('preview_created', { profession: profile.type });
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('continueButton').addEventListener('click', () => {
  closeModal();
  window.location.href = generatedSlug ? `preview.html?site=${encodeURIComponent(generatedSlug)}` : 'preview.html';
});
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
