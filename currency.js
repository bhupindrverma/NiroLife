(() => {
  const supported = ['INR', 'USD', 'GBP', 'EUR'];
  const euroZones = /^(Europe\/(Amsterdam|Andorra|Athens|Berlin|Bratislava|Brussels|Dublin|Helsinki|Lisbon|Ljubljana|Luxembourg|Madrid|Malta|Mariehamn|Monaco|Paris|Podgorica|Riga|Rome|San_Marino|Tallinn|Valletta|Vatican|Vienna|Vilnius|Zagreb)|Asia\/Nicosia|Atlantic\/(Canary|Madeira|Azores))$/;
  function suggested() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/^Asia\/(Calcutta|Kolkata)$/.test(zone)) return 'INR';
    if (/^Europe\/(London|Belfast|Guernsey|Isle_of_Man|Jersey)$/.test(zone)) return 'GBP';
    if (euroZones.test(zone)) return 'EUR';
    return 'USD';
  }
  let currency = suggested();
  try { const saved = localStorage.getItem('nirolifeCurrency'); if (supported.includes(saved)) currency = saved; } catch (_) {}
  let rates = { INR: 1 }, date = '';
  const host = document.querySelector('#plans .shell, .publish-shell .intro');
  if (!host) return;
  const box = document.createElement('div');
  box.style.cssText = 'margin:18px 0;padding:14px;border:1px solid #b9cbc4;border-radius:8px;background:#fff;color:#173b3a;text-align:center;font-size:13px';
  const label = document.createElement('label'); label.textContent = 'Display currency: ';
  const select = document.createElement('select'); select.setAttribute('aria-label','Display currency');
  select.style.cssText = 'padding:8px;border:1px solid #b9cbc4;border-radius:6px;background:white;color:#173b3a;font:inherit';
  supported.forEach(code => { const option = document.createElement('option'); option.value = code; option.textContent = code; select.append(option); });
  select.value = currency; label.append(select);
  const note = document.createElement('p'); note.setAttribute('aria-live','polite'); note.style.margin = '8px 0 0';
  box.append(label,note); host.append(box);
  const templates = [];
  document.querySelectorAll('#plans .plan h3, .plan-card strong, .addons strong').forEach(container => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) { const node = walker.currentNode; if (/₹[\d,]+/.test(node.nodeValue)) templates.push([node,node.nodeValue]); }
  });
  function render() {
    const available = Number.isFinite(rates[currency]);
    const actual = available ? currency : 'INR';
    templates.forEach(([node,original]) => { node.nodeValue = original.replace(/₹([\d,]+)/g, (_,amount) => {
      const baseAmount = Number(amount.replace(/,/g,''));
      const fixedMonthly = baseAmount === 1999;
      const priceCurrency = fixedMonthly ? currency : actual;
      const value = fixedMonthly ? ({INR:1999,USD:29,GBP:25,EUR:29})[currency] : Math.round(baseAmount * rates[actual]);
      return new Intl.NumberFormat('en', { style:'currency', currency:priceCurrency, currencyDisplay:'code', maximumFractionDigits:0 }).format(value);
    }); });
    note.textContent = !available ? `Conversion unavailable: showing INR. Your preferred quotation currency is ${currency}.` : actual === 'INR' ? 'Base prices in INR. Final scope and charges are confirmed in your quotation.' : `Approximate converted prices${date ? ` · rates dated ${date}` : ''}. Final currency and amount are confirmed in your quotation.`;
    note.textContent += ' Managed Website monthly prices are fixed: INR 1,999 / USD 29 / GBP 25 / EUR 29; setup and add-ons are separate. Automatic renewals are not yet live. Currency is suggested from device settings; you can change it.';
    window.nirolifeCurrency = currency;
    document.dispatchEvent(new CustomEvent('currencychange',{detail:currency}));
  }
  select.addEventListener('change', () => { currency = select.value; try { localStorage.setItem('nirolifeCurrency',currency); } catch (_) {} render(); });
  render();
  fetch('/api/exchange-rates').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => {
    supported.forEach(code => { if (Number.isFinite(data.rates?.[code]) && data.rates[code] > 0) rates[code] = data.rates[code]; });
    date = /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : ''; render();
  }).catch(() => render());
})();
