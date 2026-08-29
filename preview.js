let saved = JSON.parse(localStorage.getItem('nirolifePreview') || '{}');
let uiSaved = JSON.parse(localStorage.getItem('nirolifePreviewDesign') || '{}');
const requestedSite = new URLSearchParams(location.search).get('site') || '';
let siteSlug = requestedSite || localStorage.getItem('nirolifeSlug') || '';
let editToken = siteSlug ? localStorage.getItem(`nirolifeEditToken:${siteSlug}`) || '' : '';
if (requestedSite && !editToken) { saved = {}; uiSaved = {}; }
const state = {
  practice: uiSaved.practice || saved.practice || 'Your Practice', name: saved.name || 'Your care team', type: saved.type || 'Healthcare practice',
  city: saved.city || 'Your city', specialty: saved.specialty || saved.type || 'Healthcare practice', phone: saved.phone || '',
  whatsapp: (saved.whatsapp || saved.phone || '').replace(/\D/g, ''), hours: saved.hours || 'Appointments available', address: saved.address || saved.city || 'Your practice address',
  bio: uiSaved.bio || saved.bio || `${saved.name || 'Our team'} welcomes you to a more personal, informed care experience.`,
  headline: uiSaved.headline || 'care you can trust.', theme: uiSaved.theme || saved.color || 'green', template: uiSaved.template || 'modern', photo: uiSaved.photo || 'healthcare-hero-v2.png'
};
let services = String(saved.services || 'Consultation, Treatment planning, Follow-up care').split(/,|\n|;/).map(item => item.replace(/^[-•\d.\s]+/,'').trim()).filter(item => item.length > 2).slice(0, 6);
const safe = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const el = id => document.getElementById(id);

function render() {
  document.title = `${state.practice} — website preview`;
  el('sitePreview').className = `preview-shell theme-${state.theme} template-${state.template}`;
  el('brandName').textContent = state.practice; el('footerPractice').textContent = state.practice;
  el('heroTitle').innerHTML = `${safe(state.practice)}<em>${safe(state.headline)}</em>`;
  el('heroSub').textContent = state.bio; el('heroSub').classList.add('hero-sub-clamped');
  el('specialtyLabel').textContent = `${state.specialty} in ${state.city}`; el('trustSpecialty').textContent = state.specialty;
  el('cityLabel').textContent = state.city; el('hoursLabel').textContent = state.hours; el('hoursCard').textContent = state.hours; el('contactHours').textContent = state.hours;
  el('doctorName').textContent = state.name; el('doctorRole').textContent = state.specialty;
  el('welcomeTitle').textContent = `A warm welcome from ${state.practice}.`; el('welcomeCopy').textContent = state.bio;
  el('addressLabel').textContent = state.address; el('mapCity').textContent = state.city; el('mapButton').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(state.address)}`;
  el('heroPhoto').src = state.photo; el('profilePhoto').src = state.photo;
  el('footerContact').textContent = [state.phone,state.city].filter(Boolean).join(' · ');
  el('servicesList').innerHTML = services.map((service,index)=>`<article class="service-card"><span class="service-number">0${index+1}</span><h3>${safe(service)}</h3><p>Speak with our team for service information and appointment availability.</p></article>`).join('');
  el('viewServices').hidden = services.length <= 3;
  const benefits = [
    ['Patient-first communication','Clear information and a simple appointment journey.'],
    state.whatsapp ? ['Convenient WhatsApp contact','Connect with the practice directly from your phone.'] : ['Convenient contact','Call the practice directly from any device.'],
    [`Local care in ${state.city}`,state.address !== state.city ? 'Directions and practice information in one place.' : 'Easy access to local practice information.']
  ];
  el('benefitList').innerHTML = benefits.map(([title,copy])=>`<div class="benefit"><i>✓</i><div><strong>${safe(title)}</strong><span>${safe(copy)}</span></div></div>`).join('');
  if (state.phone) {
    const tel=`tel:${state.phone.replace(/\s/g,'')}`; el('contactLabel').textContent=state.phone; el('contactLabel').href=tel;
    ['callButton','mobileCall'].forEach(id=>el(id).href=tel);
  } else { ['callButton','mobileCall'].forEach(id=>el(id).style.display='none'); }
  const wa = state.whatsapp.length >= 10 ? `https://wa.me/${state.whatsapp}?text=${encodeURIComponent(`Hello ${state.practice}, I would like to request an appointment.`)}` : '#appointment';
  el('whatsappButton').href=wa; el('mobileWhatsapp').href=wa;
}
render();

async function loadSharedWebsite() {
  if (!siteSlug) return;
  try {
    const response = await fetch(`/api/practices/${encodeURIComponent(siteSlug)}`);
    if (!response.ok) throw new Error();
    const remote = await response.json();
    saved = remote;
    Object.assign(state, { practice: remote.practice || state.practice, name: remote.name || state.name, type: remote.type || state.type, city: remote.city || state.city, specialty: remote.specialty || remote.type || state.specialty, phone: remote.phone || '', whatsapp: (remote.whatsapp || remote.phone || '').replace(/\D/g,''), hours: remote.hours || state.hours, address: remote.address || remote.city || state.address, bio: remote.bio || state.bio, headline: remote.headline || state.headline, theme: remote.theme || remote.color || state.theme, template: remote.template || state.template });
    services = String(remote.services || 'Consultation, Treatment planning, Follow-up care').split(/,|\n|;/).map(item=>item.replace(/^[-•\d.\s]+/,'').trim()).filter(item=>item.length>2).slice(0,6);
    el('editPractice').value=state.practice;el('editHeadline').value=state.headline;el('editBio').value=state.bio;el('themePicker').value=state.theme;el('templatePicker').value=state.template;
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
el('toolbarToggle').addEventListener('click',()=>toolbar.classList.add('open')); el('closeToolbar').addEventListener('click',()=>toolbar.classList.remove('open'));
el('editPractice').value=state.practice; el('editHeadline').value=state.headline; el('editBio').value=state.bio; el('themePicker').value=state.theme; el('templatePicker').value=state.template;
['themePicker','templatePicker'].forEach(id=>el(id).addEventListener('change',event=>{state[id==='themePicker'?'theme':'template']=event.target.value;render();}));
el('photoPicker').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{state.photo=reader.result;render();};reader.readAsDataURL(file);});
el('savePreview').addEventListener('click',async()=>{state.practice=el('editPractice').value.trim()||state.practice;state.headline=el('editHeadline').value.trim()||state.headline;state.bio=el('editBio').value.trim()||state.bio;const design={practice:state.practice,headline:state.headline,bio:state.bio,theme:state.theme,template:state.template};if(state.photo.startsWith('data:')&&state.photo.length<1500000)design.photo=state.photo;localStorage.setItem('nirolifePreviewDesign',JSON.stringify(design));render();if(siteSlug&&editToken){el('savePreview').textContent='Saving…';try{const response=await fetch(`/api/practices/${encodeURIComponent(siteSlug)}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-edit-token':editToken},body:JSON.stringify(design)});if(!response.ok)throw new Error();el('savePreview').textContent='Saved and shareable ✓';}catch(_error){el('savePreview').textContent='Saved on this device';}}toolbar.classList.remove('open');});

el('copyLink').addEventListener('click',async()=>{const link=siteSlug?`${location.origin}/preview.html?site=${encodeURIComponent(siteSlug)}`:location.href;try{await navigator.clipboard.writeText(link);el('copyLink').textContent='Link copied ✓';}catch(_error){el('copyLink').textContent='Copy unavailable';}});
el('desktopPreview').addEventListener('click',()=>{el('sitePreview').classList.remove('device-mobile');el('desktopPreview').classList.add('active');el('mobilePreview').classList.remove('active');});
el('mobilePreview').addEventListener('click',()=>{el('sitePreview').classList.add('device-mobile');el('mobilePreview').classList.add('active');el('desktopPreview').classList.remove('active');el('sitePreview').scrollIntoView({behavior:'smooth'});});
el('viewServices').addEventListener('click',()=>{const section=el('services');section.classList.toggle('expanded');el('viewServices').textContent=section.classList.contains('expanded')?'Show fewer services':'View all services';});

el('appointmentForm').addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget).entries());const message=`Hello ${state.practice}, my name is ${data.patientName}. I would like to request an appointment on ${data.preferredDay}. My phone number is ${data.patientPhone}.`;if(state.whatsapp.length>=10)window.open(`https://wa.me/${state.whatsapp}?text=${encodeURIComponent(message)}`,'_blank','noopener');else window.location.href=state.phone?`tel:${state.phone.replace(/\s/g,'')}`:'#location';});

const claimPanel=el('claimPanel'),claimForm=el('claimForm'),claimStatus=el('claimStatus');
claimForm.insertAdjacentHTML('afterbegin', `<div class="package-choice"><label><input type="radio" name="offerChoice" value="Free Preview" checked><span><b>Free Preview</b><strong>₹0</strong><small>Keep and share your private preview. No card required.</small></span></label><label><input type="radio" name="offerChoice" value="Website Launch"><span><b>Website Launch</b><strong>₹9,999 <em>one time</em></strong><small>Publish on your domain with setup and launch support.</small></span></label><label class="recommended"><input type="radio" name="offerChoice" value="Managed Website"><span><i>Recommended</i><b>Managed Website</b><strong>₹4,999 setup + ₹1,999/month</strong><small>Hosting, maintenance and reasonable monthly updates.</small></span></label></div><fieldset class="addon-choice"><legend>Optional growth services</legend><label><input type="checkbox" name="addOns" value="Local SEO"> Local SEO <small>from ₹7,500/month</small></label><label><input type="checkbox" name="addOns" value="Advertising management"> Advertising management <small>from ₹5,000/month + ad spend</small></label></fieldset>`);
const packageSelect=claimForm.elements.package;packageSelect.hidden=true;packageSelect.closest('label').hidden=true;packageSelect.insertAdjacentHTML('afterbegin','<option>Free Preview</option><option>Managed Website</option>');
claimForm.querySelectorAll('[name="offerChoice"]').forEach(input=>input.addEventListener('change',()=>{packageSelect.value=input.value;}));
el('claimButton').addEventListener('click',()=>{claimPanel.classList.add('open');claimPanel.scrollIntoView({behavior:'smooth'});if(typeof track==='function')track('claim_opened',{profession:state.type});});
claimForm.elements.contactName.value=saved.name||'';claimForm.elements.email.value=saved.email||'';claimForm.elements.phone.value=saved.whatsapp||saved.phone||'';
claimForm.addEventListener('submit',async event=>{event.preventDefault();claimStatus.textContent='Sending…';const claimData=new FormData(claimForm);const enquiry={...Object.fromEntries(claimData.entries()),package:packageSelect.value,addOns:claimData.getAll('addOns').join(', '),practice:state.practice,type:state.type,specialty:state.specialty,city:state.city,preview:{...saved,siteSlug,design:{theme:state.theme,template:state.template,headline:state.headline}}};try{const response=await fetch('/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(enquiry)});if(!response.ok)throw new Error();claimStatus.textContent='Thank you — your enquiry has been received.';claimForm.querySelector('.claim-submit').disabled=true;if(typeof track==='function')track('enquiry_sent',{profession:state.type,package:packageSelect.value});}catch(_error){claimStatus.textContent='Please email help@nirolife.com and we will assist you.';}});
