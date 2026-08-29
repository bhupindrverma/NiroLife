const form = document.getElementById('generatorForm');
const modal = document.getElementById('previewModal');
const modalTitle = document.getElementById('previewTitle');
const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
const requestedType = new URLSearchParams(window.location.search).get('type');
if (requestedType) {
  const typeSelect = form.elements.type;
  const matchingOption = [...typeSelect.options].find(option => option.value.toLowerCase() === requestedType.toLowerCase());
  if (matchingOption) typeSelect.value = matchingOption.value;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const practice = data.get('practice') || 'Your practice';
  const profile = Object.fromEntries(data.entries());
  profile.practice = practice;
  localStorage.setItem('nirolifePreview', JSON.stringify(profile));
  fetch('/api/practices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    .then((response) => response.json())
    .then((result) => { if (result.slug) localStorage.setItem('nirolifeSlug', result.slug); })
    .catch(() => { /* Local preview mode: browser storage remains the fallback. */ });
  modalTitle.textContent = `${practice} website preview`;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (typeof track === 'function') track('preview_created', { profession: profile.type });
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('continueButton').addEventListener('click', () => {
  closeModal();
  window.location.href = 'preview.html';
});
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
