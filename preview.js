const saved = JSON.parse(localStorage.getItem('nirolifePreview') || '{}');
const uiSaved = JSON.parse(localStorage.getItem('nirolifePreviewDesign') || '{}');
const state = {
  practice: uiSaved.practice || saved.practice || 'Your Practice', name: saved.name || 'Your care team', type: saved.type || 'Healthcare practice',
  city: saved.city || 'Your city', specialty: saved.specialty || saved.type || 'Healthcare practice', phone: saved.phone || '',
  whatsapp: (saved.whatsapp || saved.phone || '').replace(/\D/g, ''), hours: saved.hours || 'Appointments available', address: saved.address || saved.city || 'Your practice address',
  bio: uiSaved.bio || saved.bio || `${saved.name || 'Our team'} welcomes you to a more personal, informed care experience.`,
  headline: uiSaved.headline || 'care you can trust.', theme: uiSaved.theme || saved.color || 'green', template: uiSaved.template || 'modern', photo: uiSaved.photo || 'healthcare-hero-v2.png'
};
const rawServices = String(saved.services || 'Consultation, Treatment planning, Follow-up care');
const services = rawServices.split(/,|\n|;/).map(item => item.replace(/^[-•\d.\s]+/,'').trim()).filter(item => item.length > 2).slice(0, 6);
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

const toolbar = el('builderToolbar');
el('toolbarToggle').addEventListener('click',()=>toolbar.classList.add('open')); el('closeToolbar').addEventListener('click',()=>toolbar.classList.remove('open'));
el('editPractice').value=state.practice; el('editHeadline').value=state.headline; el('editBio').value=state.bio; el('themePicker').value=state.theme; el('templatePicker').value=state.template;
['themePicker','templatePicker'].forEach(id=>el(id).addEventListener('change',event=>{state[id==='themePicker'?'theme':'template']=event.target.value;render();}));
el('photoPicker').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{state.photo=reader.result;render();};reader.readAsDataURL(file);});
el('savePreview').addEventListener('click',()=>{state.practice=el('editPractice').value.trim()||state.practice;state.headline=el('editHeadline').value.trim()||state.headline;state.bio=el('editBio').value.trim()||state.bio;const design={practice:state.practice,headline:state.headline,bio:state.bio,theme:state.theme,template:state.template};if(state.photo.startsWith('data:')&&state.photo.length<1500000)design.photo=state.photo;localStorage.setItem('nirolifePreviewDesign',JSON.stringify(design));render();toolbar.classList.remove('open');});
el('viewServices').addEventListener('click',()=>{const section=el('services');section.classList.toggle('expanded');el('viewServices').textContent=section.classList.contains('expanded')?'Show fewer services':'View all services';});

el('appointmentForm').addEventListener('submit',event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget).entries());const message=`Hello ${state.practice}, my name is ${data.patientName}. I would like to request an appointment on ${data.preferredDay}. My phone number is ${data.patientPhone}.`;if(state.whatsapp.length>=10)window.open(`https://wa.me/${state.whatsapp}?text=${encodeURIComponent(message)}`,'_blank','noopener');else window.location.href=state.phone?`tel:${state.phone.replace(/\s/g,'')}`:'#location';});

const claimPanel=el('claimPanel'),claimForm=el('claimForm'),claimStatus=el('claimStatus');
el('claimButton').addEventListener('click',()=>{claimPanel.classList.add('open');claimPanel.scrollIntoView({behavior:'smooth'});if(typeof track==='function')track('claim_opened',{profession:state.type});});
claimForm.elements.contactName.value=saved.name||'';claimForm.elements.email.value=saved.email||'';claimForm.elements.phone.value=saved.whatsapp||saved.phone||'';
claimForm.addEventListener('submit',async event=>{event.preventDefault();claimStatus.textContent='Sending…';const enquiry={...Object.fromEntries(new FormData(claimForm).entries()),practice:state.practice,type:state.type,specialty:state.specialty,city:state.city,preview:{...saved,design:{theme:state.theme,template:state.template,headline:state.headline}}};try{const response=await fetch('/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(enquiry)});if(!response.ok)throw new Error();claimStatus.textContent='Thank you — your enquiry has been received.';claimForm.querySelector('button').disabled=true;if(typeof track==='function')track('enquiry_sent',{profession:state.type});}catch(_error){claimStatus.textContent='Please email help@nirolife.com and we will assist you.';}});
