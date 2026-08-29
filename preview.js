const saved = JSON.parse(localStorage.getItem('nirolifePreview') || '{}');
const practice = saved.practice || 'Your Practice';
const name = saved.name || 'Your care team';
const type = saved.type || 'Healthcare practice';
const city = saved.city || 'Your city';
const specialty = saved.specialty || type;
const phone = saved.phone || '';
const whatsapp = (saved.whatsapp || phone).replace(/\D/g, '');
const hours = saved.hours || 'Appointments available';
const address = saved.address || city;
const bio = saved.bio || `${name} welcomes you to a more personal, informed care experience.`;
const services = String(saved.services || 'Consultation, Treatment planning, Follow-up care').split(/,|\n/).map(item => item.trim()).filter(Boolean).slice(0, 6);
const safe = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

document.title = `${practice} — website preview`;
document.getElementById('sitePreview').className = `preview-shell theme-${saved.color || 'green'}`;
document.getElementById('brandName').textContent = practice;
document.getElementById('footerPractice').textContent = practice;
document.getElementById('heroTitle').innerHTML = `${safe(practice)}<em>care you can trust.</em>`;
document.getElementById('heroSub').textContent = bio;
document.getElementById('specialtyLabel').textContent = `${specialty} in ${city}`;
document.getElementById('cityLabel').textContent = city;
document.getElementById('hoursLabel').textContent = hours;
document.getElementById('hoursCard').textContent = hours;
document.getElementById('contactHours').textContent = hours;
document.getElementById('doctorName').textContent = name;
document.getElementById('doctorRole').textContent = specialty;
document.getElementById('welcomeTitle').textContent = `A warm welcome from ${practice}.`;
document.getElementById('welcomeCopy').textContent = bio;
document.getElementById('localBenefit').textContent = `Conveniently located in ${city}.`;
document.getElementById('addressLabel').textContent = address;
document.getElementById('mapButton').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
document.getElementById('servicesList').innerHTML = services.map((service, index) => `<article class="service-card"><span class="service-number">0${index + 1}</span><h3>${safe(service)}</h3><p>Contact our team to learn more about this service, suitability and appointment availability.</p></article>`).join('');

if (phone) {
  const tel = `tel:${phone.replace(/\s/g, '')}`;
  const contactLabel = document.getElementById('contactLabel');
  contactLabel.textContent = phone;
  contactLabel.href = tel;
  ['callButton', 'topCall', 'contactCall'].forEach(id => document.getElementById(id).href = tel);
}
if (whatsapp) document.getElementById('whatsappButton').href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hello ${practice}, I would like to enquire about an appointment.`)}`;

const claimPanel = document.getElementById('claimPanel');
const claimForm = document.getElementById('claimForm');
const claimStatus = document.getElementById('claimStatus');
document.getElementById('claimButton').addEventListener('click', () => {
  claimPanel.classList.add('open');
  claimPanel.scrollIntoView({ behavior: 'smooth' });
  if (typeof track === 'function') track('claim_opened', { profession: type });
});
claimForm.elements.contactName.value = saved.name || '';
claimForm.elements.email.value = saved.email || '';
claimForm.elements.phone.value = saved.whatsapp || saved.phone || '';
claimForm.addEventListener('submit', async event => {
  event.preventDefault();
  claimStatus.textContent = 'Sending…';
  const enquiry = { ...Object.fromEntries(new FormData(claimForm).entries()), practice, type, specialty, city, preview: saved };
  try {
    const response = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(enquiry) });
    if (!response.ok) throw new Error('Request failed');
    claimStatus.textContent = 'Thank you — your enquiry has been received.';
    claimForm.querySelector('button').disabled = true;
    if (typeof track === 'function') track('enquiry_sent', { profession: type });
  } catch (_error) { claimStatus.textContent = 'Please email help@nirolife.com and we will assist you.'; }
});
