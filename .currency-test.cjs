const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('currency.js','utf8');
async function test(zone, expected, saved, fail=false) {
  const elements = [];
  class Element {
    constructor(tag) { this.tag=tag; this.style={}; this.children=[]; elements.push(this); }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
    addEventListener(name, callback) { this[name]=callback; }
  }
  const host=new Element('host'); const price={nodeValue:'From ₹9,999 / month'}; const free={nodeValue:'₹0'};
  const store={nirolifeCurrency:saved}; const window={};
  vm.runInNewContext(source,{window,Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:zone})}),NumberFormat:Intl.NumberFormat},localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v},NodeFilter:{SHOW_TEXT:4},CustomEvent:class {},document:{querySelector:()=>host,createElement:tag=>new Element(tag),querySelectorAll:()=>[price,free],createTreeWalker:node=>({currentNode:node,used:false,nextNode(){if(this.used)return false;this.used=true;return true;}}),dispatchEvent(){}},fetch:async()=>{if(fail)throw Error();return{ok:true,json:async()=>({rates:{INR:1,USD:.012,GBP:.009,EUR:.011},date:'2026-09-03'})};}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(window.nirolifeCurrency,expected);
  if(fail)assert.match(price.nodeValue,/INR/); else assert.match(price.nodeValue,new RegExp(expected));
  const select=elements.find(e=>e.tag==='select'); select.value='GBP';select.change();select.value='INR';select.change();
  assert.match(price.nodeValue,/9,999/); assert.match(free.nodeValue,/0/);
}
(async()=>{await test('Asia/Kolkata','INR');await test('Europe/London','GBP');await test('Europe/Berlin','EUR');await test('America/New_York','USD');await test('Asia/Tokyo','USD');await test('Asia/Kolkata','EUR','EUR');await test('Europe/London','GBP',null,true);console.log('7 currency scenarios passed; manual override, original-price restoration and failure fallback passed.');})();
