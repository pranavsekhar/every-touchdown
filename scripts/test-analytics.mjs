import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/analytics.ts','utf8');
for(const [id,dnt,enabled] of [['','0',false],['G-TEST123','1',false],['G-TEST123','0',true]]){
 const scripts=[],window={},module={exports:{}};
 const code=transformSync(source,{loader:'ts',format:'cjs',define:{'import.meta.env.VITE_GA_MEASUREMENT_ID':JSON.stringify(id)}}).code;
 runInNewContext(code,{module,exports:module.exports,window,navigator:{doNotTrack:dnt},location:{origin:'https://example.test'},document:{createElement:()=>({}),head:{append:s=>scripts.push(s)}}});
 module.exports.analyticsContext('MIA',2023);module.exports.track('season_view');module.exports.track('touchdown_select',{type:'pass',playId:'123'});
 assert.equal(scripts.length,enabled?1:0);
 if(enabled){const calls=window.dataLayer.map(a=>Array.from(a));assert.equal(calls.filter(a=>a[0]==='config').length,1);assert.equal(calls[0][2].analytics_storage,'denied');assert.equal(calls[0][2].ad_storage,'denied');assert.equal(calls[2][2].send_page_view,false);assert.equal(calls[4][2].playId,'123');assert.equal(calls[4][2].team,'MIA');assert.equal(calls[4][2].season,2023);assert.equal(calls[4][2].page_location,'https://example.test/MIA/2023');assert.equal(calls[4][2].page_referrer,'');}
}
console.log('GA4 adapter: disabled without ID or with DNT, initializes once, denies storage/ads, sends scoped events without query strings or referrers.');
