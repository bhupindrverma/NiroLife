let saved = JSON.parse(localStorage.getItem('nirolifePreview') || '{}');
let uiSaved = JSON.parse(localStorage.getItem('nirolifePreviewDesign') || '{}');
const requestedSite = new URLSearchParams(location.search).get('site') || '';
let siteSlug = requestedSite || localStorage.getItem('nirolifeSlug') || '';
let editToken = siteSlug ? localStorage.getItem(`nirolifeEditToken:${siteSlug}`) || '' : '';
if (requestedSite && !editToken) { saved = {}; uiSaved = {}; }
const state = {
  practice: uiSaved.practice || saved.practice || 'Your Practice', name: saved.name || 'Your care team', type: saved.type || 'Healthcare practice',
  city: saved.city || 'Your city', specialty: saved.specialty || saved.type || 'Healthcare practice', phone: saved.phone || '',
  whatsapp: (saved.whatsapp || '').replace(/\D/g, ''), hours: saved.hours || 'Contact the practice for timings', address: saved.address || saved.city || 'Your practice address',
  bio: uiSaved.bio || saved.bio || `${saved.name || 'Our team'} welcomes you to a more personal, informed care experience.`,
  headline: uiSaved.headline || 'care you can trust.', theme: uiSaved.theme || saved.color || 'green', template: uiSaved.template || 'modern', heroStyle: uiSaved.heroStyle || saved.heroStyle || 'photo', photo: uiSaved.photo || 'healthcare-hero-v2.png'
};
let services = String(saved.services || 'Consultation, Treatment planning, Follow-up care').split(/,|\n|;/).map(item => item.replace(/^[-•\d.\s]+/,'').trim()).filter(item => item.length > 2).slice(0, 6);
const safe = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const el = id => document.getElementById(id);

function render() {
  document.title = `${state.practice} — website preview`;
  const mobilePreview = el('sitePreview').classList.contains('device-mobile');
  el('sitePreview').className = `preview-shell theme-${state.theme} template-${state.template}${mobilePreview ? ' device-mobile' : ''}`;
  el('brandName').textContent = state.practice; el('footerPractice').textContent = state.practice;
  el('heroTitle').innerHTML = `${safe(state.practice)}<em>${safe(state.headline)}</em>`;
  el('heroSub').textContent = state.bio; el('heroSub').classList.add('hero-sub-clamped');
  el('specialtyLabel').textContent = `${state.specialty} in ${state.city}`; el('trustSpecialty').textContent = state.specialty;
  el('cityLabel').textContent = state.city; el('hoursLabel').textContent = state.hours; el('hoursCard').textContent = state.hours; el('contactHours').textContent = state.hours;
  el('doctorName').textContent = state.name; el('doctorRole').textContent = state.specialty;
  el('welcomeTitle').textContent = `A warm welcome from ${state.practice}.`; el('welcomeCopy').textContent = state.bio;
  el('addressLabel').textContent = state.address; el('mapCity').textContent = state.city; el('mapButton').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(state.address)}`;
  el('heroPhoto').src = state.photo; el('profilePhoto').src = state.photo;
  el('profilePhoto').loading='lazy';el('profilePhoto').decoding='async';el('heroPhoto').fetchPriority='high';
  const ownPhoto = /^data:image\/(png|jpeg|webp);base64,/.test(state.photo);
  el('heroPhoto').alt = ownPhoto ? 'Practice image supplied by the owner' : 'Illustrative healthcare image, not the actual practitioner';
  el('profilePhoto').alt = ownPhoto ? 'Practice image supplied by the owner' : 'Decorative healthcare illustration';
  if (!ownPhoto) el('profilePhoto').src = 'healthcare-website-design.svg';
  let photoNote = document.getElementById('photoNote');
  if (!photoNote) { photoNote=document.createElement('small');photoNote.id='photoNote';photoNote.className='photo-note';el('heroPhoto').parentElement.appendChild(photoNote); }
  photoNote.hidden=ownPhoto;photoNote.textContent='Illustrative image · Personalise with your practice photo';
  el('footerContact').textContent = [state.phone,state.city].filter(Boolean).join(' · ');
  el('servicesList').innerHTML = services.map((service,index)=>`<article class="service-card"><span class="service-number">0${index+1}</span><h3>${safe(service)}</h3><p>Speak with our team for service information and appointment availability.</p></article>`).join('');
  el('viewServices').hidden = services.length <= 3;
  const benefits = [
    ['Patient-first communication','Clear information and a simple appointment journey.'],
    state.whatsapp ? ['Convenient WhatsApp contact','Connect with the practice directly from your phone.'] : ['Convenient contact','Call the practice directly from any device.'],
    [`Local care in ${state.city}`,state.address !== state.city ? 'Directions and practice information in one place.' : 'Easy access to local practice information.']
  ];
  el('benefitList').innerHTML = benefits.map(([title,copy])=>`<div class="benefit"><i>✓</i><div><strong>${safe(title)}</strong><span>${safe(copy)}</span></div></div>`).join('');
  el('visitLocationCopy').textContent = state.address && state.address !== 'Your practice address' ? `Visit us at ${state.address}. Opening hours: ${state.hours}.` : 'Contact the practice for directions and current opening hours.';
  const serviceNames = services.slice(0,3).join(', ');
  const faqs = [
    ['How can I request an appointment?', state.whatsapp.length >= 10 ? 'Use the appointment form, WhatsApp button or telephone number on this page. The practice will confirm availability directly.' : 'Use the appointment form or call the practice. The practice will confirm availability directly.'],
    [`What services does ${state.practice} provide?`, serviceNames ? `${state.practice} lists ${serviceNames}${services.length > 3 ? ' and other services' : ''}. Contact the team to ask whether a service is appropriate for your needs.` : 'Contact the practice to ask about its currently available services.'],
    ['Where is the practice located?', state.address && state.address !== 'Your practice address' ? `${state.practice} is located at ${state.address}. Use the directions button below to plan your journey.` : `The practice serves patients in ${state.city}. Contact the team for complete directions.`],
    ['What are the opening hours?', state.hours && state.hours !== 'Appointments available' ? `The hours supplied by the practice are ${state.hours}. Contact the team to confirm availability on holidays or before travelling.` : 'Contact the practice to confirm its current opening hours and appointment availability.']
  ];
  el('faqList').innerHTML = faqs.map(([question,answer],index)=>`<details${index===0?' open':''}><summary>${safe(question)}<span>+</span></summary><p>${safe(answer)}</p></details>`).join('');
  if (state.phone) {
    const tel=`tel:${state.phone.replace(/\s/g,'')}`; el('contactLabel').textContent=state.phone; el('contactLabel').href=tel;
    ['callButton','mobileCall'].forEach(id=>{el(id).href=tel;el(id).style.display='';});
  } else { ['callButton','mobileCall'].forEach(id=>el(id).style.display='none'); el('contactLabel').textContent='Contact details available soon'; }
  const wa = state.whatsapp.length >= 10 ? `https://wa.me/${state.whatsapp}?text=${encodeURIComponent(`Hello ${state.practice}, I would like to request an appointment.`)}` : '#appointment';
  el('whatsappButton').href=wa; el('mobileWhatsapp').href=wa;
  ['whatsappButton','mobileWhatsapp'].forEach(id=>el(id).style.display=state.whatsapp.length>=10?'':'none');
  const hasWhatsapp = state.whatsapp.length >= 10;
  el('appointmentForm').querySelector('button').textContent=hasWhatsapp?'Continue on WhatsApp':'Call the practice';
  el('appointment').querySelector('div > p').textContent=hasWhatsapp?'Your request opens in WhatsApp and goes directly to the practice. NiroLife does not receive patient information.':'Call the practice to request an appointment. Availability will be confirmed by the practice.';
  el('appointmentForm').querySelectorAll('label').forEach(label=>{label.hidden=!hasWhatsapp;label.querySelector('input').required=hasWhatsapp;});
  el('appointmentForm').querySelector('button').hidden=!hasWhatsapp&&!state.phone;
  if (!hasWhatsapp&&!state.phone) el('appointment').querySelector('div > p').textContent='Contact information has not yet been supplied by the practice.';
}
render();

async function loadSharedWebsite() {
  if (!siteSlug) return;
  try {
    const response = await fetch(`/api/practices/${encodeURIComponent(siteSlug)}`);
    if (!response.ok) throw new Error();
    const remote = await response.json();
    saved = remote;
    Object.assign(state, { practice: remote.practice || state.practice, name: remote.name || state.name, type: remote.type || state.type, city: remote.city || state.city, specialty: remote.specialty || remote.type || state.specialty, phone: remote.phone || '', whatsapp: (remote.whatsapp || remote.phone || '').replace(/\D/g,''), hours: remote.hours || state.hours, address: remote.address || remote.city || state.address, bio: remote.bio || state.bio, headline: remote.headline || state.headline, theme: remote.theme || remote.color || state.theme, template: remote.template || state.template, heroStyle: remote.heroStyle || state.heroStyle });
    state.whatsapp = String(remote.whatsapp || '').replace(/\D/g,'');
    state.photo = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(remote.photo || '') ? remote.photo : state.heroStyle === 'illustration' ? 'healthcare-website-design.svg' : 'healthcare-hero-v2.png';
    services = String(remote.services || 'Consultation, Treatment planning, Follow-up care').split(/,|\n|;/).map(item=>item.replace(/^[-•\d.\s]+/,'').trim()).filter(item=>item.length>2).slice(0,6);
    el('editPractice').value=state.practice;el('editHeadline').value=state.headline;el('editBio').value=state.bio;el('themePicker').value=state.theme;el('templatePicker').value=state.template;el('heroStylePicker').value=state.heroStyle;
    el('previewStatus').textContent = editToken ? 'Owner preview · Saved and shareable' : 'Shared website preview';
    if (!editToken) { el('toolbarToggle').hidden = true; document.querySelector('.preview-note').textContent = 'Shared website preview'; }
    render();
  } catch (_error) { el('previewStatus').textContent = 'This preview link is unavailable'; el('toolbarToggle').hidden = true; }
}
async function ensureShareLink() {
  if (siteSlug || !saved.name || !saved.practice || !saved.city) return;
  try {
    const response = await fetch('/api/practices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(saved)});
    const result = await response.json();
    if (!response.ok || !result.slug) throw new Error();
    siteSlug=result.slug;editToken=result.editToken||'';localStorage.setItem('nirolifeSlug',siteSlug);localStorage.setItem(`nirolifeEditToken:${siteSlug}`,editToken);history.replaceState({},'',`preview.html?site=${encodeURIComponent(siteSlug)}`);el('previewStatus').textContent='Owner preview · Saved and shareable';
  } catch (_error) { el('previewStatus').textContent='Private preview · Saved on this device'; }
}
if(siteSlug)loadSharedWebsite();else ensureShareLink();

const toolbar = el('builderToolbar');
el('photoPicker').closest('label').querySelector('.input-help').textContent='Use an image you have permission to publish. Images under 1 MB can be saved to your shareable website.';
el('toolbarToggle').addEventListener('click',()=>toolbar.classList.add('open')); el('closeToolbar').addEventListener('click',()=>toolbar.classList.remove('open'));
el('editPractice').value=state.practice; el('editHeadline').value=state.headline; el('editBio').value=state.bio; el('themePicker').value=state.theme; el('templatePicker').value=state.template; el('heroStylePicker').value=state.heroStyle;
['themePicker','templatePicker'].forEach(id=>el(id).addEventListener('change',event=>{state[id==='themePicker'?'theme':'template']=event.target.value;render();}));
el('heroStylePicker').addEventListener('change',event=>{state.heroStyle=event.target.value;state.photo=state.heroStyle==='illustration'?'healthcare-website-design.svg':'healthcare-hero-v2.png';render();});
el('photoPicker').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;if(file.size>1000000||!['image/png','image/jpeg','image/webp'].includes(file.type)){el('savePreview').textContent='Choose a PNG, JPG or WebP under 1 MB';event.target.value='';return;}const reader=new FileReader();reader.onload=()=>{state.photo=reader.result;el('savePreview').textContent='Save changes';render();};reader.readAsDataURL(file);});
el('savePreview').addEventListener('click',async()=>{state.practice=el('editPractice').value.trim()||state.practice;state.headline=el('editHeadline').value.trim()||state.headline;state.bio=el('editBio').value.trim()||state.bio;const design={practice:state.practice,headline:state.headline,bio:state.bio,theme:state.theme,template:state.template,heroStyle:state.heroStyle};if(state.photo.startsWith('data:')&&state.photo.length<1500000)design.photo=state.photo;localStorage.setItem('nirolifePreviewDesign',JSON.stringify(design));render();if(siteSlug&&editToken){el('savePreview').textContent='Saving…';try{const response=await fetch(`/api/practices/${encodeURIComponent(siteSlug)}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-edit-token':editToken},body:JSON.stringify(design)});if(!response.ok)throw new Error();el('savePreview').textContent='Saved and shareable ✓';}catch(_error){el('savePreview').textContent='Saved on this device';}}toolbar.classList.remove('open');});

el('copyLink').addEventListener('click',async()=>{const link=siteSlug?`${location.origin}/preview.html?site=${encodeURIComponent(siteSlug)}`:location.href;try{await navigator.clipboard.writeText(link);el('copyLink').textContent='Link copied ✓';}catch(_error){el('copyLink').textContent='Copy unavailable';}});
el('desktopPreview').addEventListener('click',()=>{el('sitePreview').classList.remove('device-mobile');el('desktopPreview').classList.add('active');el('mobilePreview').classList.remove('active');});
el('mobilePreview').addEventListener('click',()=>{el('sitePreview').classList.add('device-mobile');el('mobilePreview').classList.add('active');el('desktopPreview').classList.remove('active');el('sitePreview').scrollIntoView({behavior:'smooth'});});
el('viewServices').addEventListener('click',()=>{const section=el('services');section.classList.toggle('expanded');el('viewServices').textContent=section.classList.contains('expanded')?'Show fewer services':'View all services';});

el('appointmentForm').addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget).entries());const message=`Hello ${state.practice}, my name is ${data.patientName}. I would like to request an appointment on ${data.preferredDay}. My phone number is ${data.patientPhone}.`;if(state.whatsapp.length>=10)window.open(`https://wa.me/${state.whatsapp}?text=${encodeURIComponent(message)}`,'_blank','noopener');else window.location.href=state.phone?`tel:${state.phone.replace(/\s/g,'')}`:'#location';});

const publishButton=el('publishButton');
publishButton.href=`publish.html${siteSlug?`?site=${encodeURIComponent(siteSlug)}`:''}`;
publishButton.addEventListener('click',()=>{publishButton.href=`publish.html${siteSlug?`?site=${encodeURIComponent(siteSlug)}`:''}`;if(typeof track==='function')track('claim_opened',{profession:state.type});});
