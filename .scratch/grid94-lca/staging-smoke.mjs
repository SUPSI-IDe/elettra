import { chromium } from 'playwright';
const base = process.env.GRID94_UI_URL || 'http://127.0.0.1:18558/elettra/';
const login = await fetch('http://127.0.0.1:18002/auth/login', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email:'ci-release@example.com',password:'CI-release-gate_Str0ng!'})
});
if (!login.ok) throw new Error(`Login failed: ${login.status}`);
const token = (await login.json()).access_token;
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1500,height:1100}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(({token}) => {
  localStorage.setItem('access_token',token);
  localStorage.setItem('language','en');
  window.name = 'elettra:route:' + JSON.stringify({slug:'yearly-analysis-results',options:{analysisId:'f05b2037-5754-4e13-8029-f95e2921d895'}});
}, {token});
await page.goto(base+'#yearly-analysis-results');
await page.locator('[data-tab="emissions"]').click({timeout:45000});
await page.locator('[data-lca-export]').waitFor({timeout:120000});
const text = await page.locator('[data-role="ya-env-kpis"]').innerText();
if (!text.includes('26.77') || !text.includes('94%')) throw new Error('Expected reconciled report result missing: '+text);
await page.locator('[data-panel="emissions"]').screenshot({path:'/ssd2/elettra-releases/grid94-lca-20260930/environmental-result-grid94.png'});
await page.locator('[data-tab="costs"]').click();
if (!(await page.locator('[data-panel="costs"]').innerText()).includes('CHF')) throw new Error('Cost panel unavailable');
const overview = await browser.newPage({viewport:{width:1765,height:1100}});
overview.on('pageerror', e => errors.push(e.message));
await overview.addInitScript(({token}) => {
  localStorage.setItem('access_token',token);
  localStorage.setItem('elettra_lang','de');
  window.name = 'elettra:route:' + JSON.stringify({slug:'yearly-analysis-results',options:{analysisId:'bf7d839a-fd4b-4f26-8a5d-3f415e907ef1'}});
}, {token});
await overview.goto(base+'#yearly-analysis-results');
await overview.locator('[data-tab="emissions"]').click({timeout:45000});
await overview.locator('[data-lca-export]').waitFor({state:'attached',timeout:120000});
await overview.locator('[data-tab="overview"]').click();
await overview.waitForTimeout(600);
if (!(await overview.locator('body').innerText()).includes('L5_08-20_model_08.09.2026_HP')) throw new Error('Wrong overview case');
await overview.screenshot({path:'/ssd2/elettra-releases/grid94-lca-20260930/yearly-overview-grid94-de.png',fullPage:true});
console.log(JSON.stringify({status:'passed',runtimeErrors:errors}));
await browser.close();
if (errors.length) process.exitCode=1;
