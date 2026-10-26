import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const base=readFileSync('dist/index.html','utf8');
const catalog=JSON.parse(readFileSync('public/data/index.json','utf8'));
const teamSource=readFileSync('src/data/teams.ts','utf8');
const names=Object.fromEntries([...teamSource.matchAll(/"abbreviation":\s*"([^"]+)",\s*"name":\s*"([^"]+)"/g)].map(m=>[m[1],m[2]]));
const site=process.env.VITE_SITE_URL||process.env.CF_PAGES_URL;
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function render(team,year){
 const name=team==='LV'&&year<2020?'Oakland Raiders':team==='LAC'&&year<2017?'San Diego Chargers':team==='WAS'&&year<2020?'Washington Redskins':team==='WAS'&&year<2022?'Washington Football Team':names[team]||team;
 const title=`Every Touchdown — ${name} ${year}`;
 const desc=`Explore every offensive touchdown from the ${name}' ${year} season as an interactive 3D visualization.`;
 let html=base.replace(/<title>.*?<\/title>/,`<title>${escape(title)}</title>`);
 for(const key of ['description','og:description','twitter:description'])html=html.replace(new RegExp(`<meta (?:name|property)="${key}" content="[^"]*"\\s*\\/?>`),`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escape(desc)}"/>`);
 for(const key of ['og:title','twitter:title'])html=html.replace(new RegExp(`<meta (?:name|property)="${key}" content="[^"]*"\\s*\\/?>`),`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escape(title)}"/>`);
 if(site){const url=new URL(`/${team}/${year}`,site).href;html=html.replace('</head>',`<link rel="canonical" href="${escape(url)}"/><meta property="og:url" content="${escape(url)}"/></head>`).replaceAll('content="/og-preview.png"',`content="${escape(new URL('/og-preview.png',site).href)}"`);}
 return html;
}
let count=0;for(const [year,teams] of Object.entries(catalog.seasons))for(const team of Object.keys(teams)){mkdirSync(`dist/${team}/${year}`,{recursive:true});writeFileSync(`dist/${team}/${year}/index.html`,render(team,year));count++;}
writeFileSync('dist/index.html',render('DET',2025));
console.log(`Generated metadata for ${count} public season routes${site?' with canonical URLs':''}.`);
