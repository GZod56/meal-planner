/* engine.js — offline planner: generation, dish/transform swaps, sides, shopping list */
'use strict';
window.MP = (function(){

/* ---- side option templates (name + rough macros) ---- */
const CARB = {
  indian:   [['Basmati rice',{p:7,f:1,c:68}],['Jeera rice',{p:7,f:4,c:66}],['Naan',{p:9,f:6,c:52}]],
  mexican:  [['Cilantro-lime rice',{p:6,f:4,c:64}],['Rice & black beans',{p:14,f:3,c:70}],['Warm tortillas',{p:8,f:4,c:44}]],
  italian:  [['Crusty bread',{p:8,f:2,c:50}],['Garlic bread',{p:10,f:18,c:52}],['Soft polenta',{p:6,f:6,c:44}]],
  se_asian: [['Jasmine rice',{p:7,f:1,c:68}],['Coconut rice',{p:7,f:7,c:66}],['Rice noodles',{p:6,f:1,c:58}]],
  chinese:  [['Steamed rice',{p:7,f:1,c:68}],['Egg fried rice',{p:12,f:9,c:62}],['Garlic noodles',{p:10,f:8,c:60}]],
  japanese: [['Steamed rice',{p:7,f:1,c:68}],['Sushi rice',{p:6,f:1,c:70}],['Soba',{p:12,f:2,c:56}]],
  korean:   [['Steamed rice',{p:7,f:1,c:68}],['Kimchi fried rice',{p:10,f:8,c:62}]],
  french:   [['New potatoes',{p:5,f:4,c:40}],['Crusty baguette',{p:8,f:2,c:50}],['Buttery mash',{p:5,f:12,c:38}]],
  greek_med:[['Crusty bread',{p:8,f:2,c:50}],['Lemon potatoes',{p:5,f:8,c:42}],['Orzo',{p:12,f:4,c:70}]],
  american: [['Roast potatoes',{p:5,f:8,c:42}],['Buttery mash',{p:5,f:12,c:38}],['Crusty bread',{p:8,f:2,c:50}]],
  other:    [['Steamed rice',{p:7,f:1,c:68}],['Roast potatoes',{p:5,f:8,c:42}],['Crusty bread',{p:8,f:2,c:50}]],
};
const VEG = {
  indian:   [['Cucumber raita salad',{p:3,f:3,c:8}],['Sautéed spinach (saag-style)',{p:5,f:6,c:8}],['Roasted okra',{p:3,f:6,c:10}]],
  mexican:  [['Cabbage-lime slaw',{p:2,f:7,c:9}],['Charred corn salad',{p:6,f:10,c:24}],['Grilled peppers & onions',{p:2,f:5,c:12}]],
  italian:  [['Garlicky greens',{p:5,f:8,c:7}],['Arugula & parm salad',{p:4,f:11,c:5}],['Charred broccolini',{p:4,f:7,c:8}]],
  se_asian: [['Smashed cucumber salad',{p:2,f:4,c:6}],['Pickled carrot & daikon',{p:1,f:0,c:8}],['Charred gai lan',{p:4,f:6,c:7}]],
  chinese:  [['Chinese broccoli, oyster sauce',{p:4,f:6,c:8}],['Smashed cucumber',{p:2,f:4,c:6}],['Stir-fried greens',{p:4,f:7,c:7}]],
  japanese: [['Smashed cucumber (sunomono)',{p:2,f:1,c:6}],['Sesame spinach',{p:5,f:6,c:6}],['Quick-pickled veg',{p:1,f:0,c:8}]],
  korean:   [['Quick cucumber muchim',{p:2,f:4,c:6}],['Sesame spinach',{p:5,f:6,c:6}]],
  french:   [['Green salad, dijon vin.',{p:2,f:10,c:5}],['Haricots verts',{p:3,f:7,c:9}],['Roasted carrots',{p:2,f:6,c:14}]],
  greek_med:[['Greek-ish chopped salad',{p:4,f:11,c:8}],['Charred broccolini',{p:4,f:7,c:8}],['Lemony haricots verts',{p:3,f:7,c:9}]],
  american: [['Green salad',{p:2,f:9,c:5}],['Roasted broccoli',{p:4,f:7,c:8}],['Charred green beans',{p:3,f:7,c:9}]],
  other:    [['Green salad',{p:2,f:9,c:5}],['Charred broccolini',{p:4,f:7,c:8}],['Roasted seasonal veg',{p:3,f:7,c:12}]],
};
const CONDIMENT = {
  indian:   [['Cucumber raita',{p:3,f:2,c:5}],['Kachumber',{p:2,f:4,c:8}],['Mango chutney',{p:0,f:0,c:14}]],
  mexican:  [['Pico de gallo',{p:1,f:0,c:5}],['Guacamole',{p:2,f:12,c:6}],['Pickled jalapeños',{p:0,f:0,c:3}]],
  se_asian: [['Herb & pickle plate',{p:1,f:1,c:6}],['Nuoc cham',{p:1,f:0,c:6}],['Chili-lime cucumbers',{p:1,f:0,c:5}]],
  italian:  [['Arugula salad',{p:2,f:10,c:5}],['Shaved parm & lemon',{p:6,f:8,c:2}]],
  other:    [['Simple green salad',{p:2,f:9,c:5}],['Herb & lemon dressing',{p:0,f:8,c:1}]],
};
const cuisineOr = (map,c) => map[c] || map.other;

/* which side-shape does an archetype get */
function sideShape(r){
  const a = r.archetype;
  if (a === 'soup') return [];
  if (a === 'stew')   return ['carb','veg'];       // stew + mash/bread + green
  if (a === 'curry')  return ['carb','condiment']; // rice + raita/pickle
  if (a === 'protein')return ['veg','carb'];        // meat + two
  if (a === 'traybake')return r.macros && r.macros.c >= 40 ? [] : ['carb'];
  if (a === 'salad')  return ['carb'];              // bread on the side, optional
  if (a === 'complete'){
    const n = r.name.toLowerCase();
    if (/biryani|pilau|pulao/.test(n)) return ['condiment'];  // raita
    if (/jambalaya|paella|risotto|fried rice|congee/.test(n)) return [];
    if (/taco|burrito|quesadilla|fajita|enchilada/.test(n)) return ['veg','condiment'];
    if (/pasta|linguine|penne|spaghetti|orzo|carbonara|rigatoni|noodle|udon|lo mein|singapore|pad|drunken/.test(n)) return ['veg'];
    return [];
  }
  return ['veg','carb'];
}
function pick3(pool, seed){ // deterministic-ish 3 options ordered by seed offset
  const out = []; const n = pool.length;
  for (let i=0;i<Math.min(3,n);i++) out.push(pool[(seed+i)%n]);
  return out;
}
function buildSides(r, seed){
  const shape = sideShape(r); const sides = [];
  for (const kind of shape){
    let pool;
    if (kind==='carb') pool = cuisineOr(CARB, r.cuisine);
    else if (kind==='veg') pool = cuisineOr(VEG, r.cuisine);
    else pool = cuisineOr(CONDIMENT, r.cuisine);
    const opts = pick3(pool, seed).map(([name,m])=>({name,m}));
    sides.push({kind, i:0, options:opts});
  }
  return sides;
}

/* ---- transforms ---- */
function transformsFor(r){
  const p=r.protein, n=r.name.toLowerCase(), c=r.cuisine;
  const T=[];
  if (/taco|chipotle|tinga|carnitas|barbacoa/.test(n) || (p==='Beef'&&c==='mexican'))
    T.push('Nachos','Burrito bowls','Quesadillas');
  else if (p==='Beef')
    T.push('Ragù over pappardelle','Shepherd’s pie','Beef & rice bowls');
  else if (p==='Pork' && c==='se_asian')
    T.push('Bánh mi','Fried rice','Ramen topping');
  else if (p==='Pork')
    T.push('Fried rice','Cuban-style sandwiches','Ramen topping');
  else if (p==='Chicken' && c==='indian')
    T.push('Kathi rolls','Over jeera rice','Curry toasties');
  else if (p==='Chicken' && (c==='mexican'))
    T.push('Tacos','Tostadas','Enchiladas');
  else if (p==='Chicken' && (c==='chinese'||c==='se_asian'))
    T.push('Fried rice','Noodle stir-fry','Lettuce cups');
  else if (p==='Chicken')
    T.push('Chicken noodle soup','Chicken pie','Chicken sandwiches','Fried rice');
  else if (p==='Lamb')
    T.push('Kathi rolls','Shepherd’s pie','Over couscous');
  else if (r.archetype==='curry'||r.archetype==='stew')
    T.push('Over rice','With flatbread','Baked into a pie');
  else
    T.push('Grain bowls','Loaded wraps','Fried rice');
  return T;
}
function transformObj(r){ const opts=transformsFor(r); return {name:opts[0], i:0, options:opts, note:'lands as the weekend meal'}; }

/* ---- deployment scaling for batch (2x, three lives) ---- */
function estMacros(r){
  // rough per-serving estimate keyed on protein + archetype when no nutrition block exists
  const p=r.protein, a=r.archetype;
  let P=30,F=20,C=35;
  if(p==='Chicken'){P=48;F=22;C=12;}
  else if(p==='Beef'){P=44;F=30;C=14;}
  else if(p==='Pork'){P=42;F=30;C=16;}
  else if(p==='Lamb'){P=40;F=32;C=14;}
  else if(p==='Fish'){P=40;F=20;C=10;}
  else if(p==='Seafood'){P=34;F=16;C=18;}
  else if(p==='Eggs'){P=22;F=22;C=14;}
  else {P=18;F=16;C=42;} // veg-forward default
  const nm=r.name.toLowerCase(); const ing=r.ingredients.join(' ').toLowerCase();
  if(/chili|chilli con|bean|lentil|dal|chickpea|tofu|paneer/.test(nm) || /\b(beans?|lentils?|chickpeas?)\b/.test(ing)){
    if(/beef|mince|pork|turkey|chicken|lamb/.test(ing)){P=38;F=24;C=40;} else {P=24;F=12;C=48;}
  }
  if(a==='complete'){C+=45;P+=6;} // rice/pasta/noodles built in
  else if(a==='curry'||a==='stew'){C+=14;}
  else if(a==='soup'){P=Math.max(10,P-14);F=Math.max(6,F-6);C+=6;}
  else if(a==='salad'){F+=10;C+=8;}
  return {p:P,f:F,c:C};
}
function batchMacros(r){
  if (r.macros && (r.macros.p||r.macros.c)) return {p:r.macros.p||0,f:r.macros.f||0,c:r.macros.c||0};
  return estMacros(r);
}

/* ---- planner ---- */
function scoreMain(r, hist, invSet, jitter){
  let s = jitter;
  if (r.favourite) s += 2.2;
  if (r.tags.includes('Untested')) s -= 2.5;
  if (hist.includes(r.id)) s -= 7;
  if (invSet.size){
    const hay = (r.name+' '+r.ingredients.join(' ')).toLowerCase();
    for (const w of invSet) if (hay.includes(w)) { s += 3.5; }
  }
  return s;
}
function slotMake(r, key){
  const seed = Math.abs(hashStr(r.id+key)) % 7;
  const o = { recipeId:r.id, name:r.name, macros:batchMacros(r), target:false,
    lead_h:r.lead_h||0, minutes:r.minutes||null, sides:buildSides(r,seed) };
  return o;
}
function hashStr(s){ let h=0; for (let i=0;i<s.length;i++){ h=(h*31 + s.charCodeAt(i))|0; } return h; }

function isTargetHit(slotMacrosTotal){
  const {p,c}=slotMacrosTotal;
  return p>=72 && c>=95; // near the 80/120 line
}
function totalMacros(slot){
  const m={...slot.macros};
  for (const sd of slot.sides){ const o=sd.options[sd.i]; m.p+=o.m.p; m.f+=o.m.f; m.c+=o.m.c; }
  return m;
}

function leadNote(r){
  if(r.lead_h>=24) return `${r.minutes||'?'}′ active · start the day before`;
  if(r.lead_h>=8)  return `${r.minutes||'?'}′ active · start ~${r.lead_h}h ahead (or overnight)`;
  if(r.lead_h>=2)  return `${r.minutes||'?'}′ active · start ~${r.lead_h}h ahead`;
  if(r.lead_h>0)   return `${r.minutes||'?'}′ active · quick head-start`;
  return `${r.minutes||'?'}′`;
}
function detailLine(r,slot){
  const base = leadNote(r);
  return r.lead_h>0 ? base : `${base} · ${slot}`;
}
function generate(recipes, opts){
  opts = opts||{};
  const hist = opts.history || [];
  const invSet = new Set((opts.inventory||[]).map(x=>x.trim().toLowerCase()).filter(Boolean));
  const jit = () => (Math.random()*3.2);
  const mains = recipes.filter(r=>r.isMain);
  const usedProteins = {};
  const chosen = new Set();

  function best(filterFn, avoidProteinRepeat){
    let pool = mains.filter(r=>!chosen.has(r.id) && filterFn(r));
    if (avoidProteinRepeat){
      const over = Object.entries(usedProteins).filter(([,n])=>n>=2).map(([p])=>p);
      const trimmed = pool.filter(r=>!over.includes(r.protein));
      if (trimmed.length>=3) pool = trimmed;
    }
    if (!pool.length) return null;
    pool.sort((a,b)=>scoreMain(b,hist,invSet,jit())-scoreMain(a,hist,invSet,jit()));
    const r = pool[0];
    chosen.add(r.id); usedProteins[r.protein]=(usedProteins[r.protein]||0)+1;
    return r;
  }

  // batch: bias toward dishes that genuinely reheat/transform (braise, stew, curry, roast, ragù, chili)
  const batchBonus = r => {
    let b=0; const n=r.name.toLowerCase();
    if (['stew','curry'].includes(r.archetype)) b+=3;
    if (/brais|roast|ragu|ragù|chili|shredded|tinga|carnitas|jambalaya|biryani|bolognese|meatball|pie\b|casserole|bo ssam|pulled/.test(n)) b+=3;
    if (/stir.?fry|kra pao|drunken|udon|lo mein|noodle|caesar|salad|omelet|scramble|toastie|wrap\b/.test(n)) b-=4;
    if (r.serves.n>=6) b+=1;
    return b;
  };
  const bestBatch = () => {
    let pool = mains.filter(r=>!chosen.has(r.id) && r.batchable);
    if(!pool.length) pool = mains.filter(r=>!chosen.has(r.id) && r.archetype==='protein');
    const sc=r=>Math.min(scoreMain(r,hist,invSet,0)+batchBonus(r),6)+jit();
    pool.sort((a,b)=>sc(b)-sc(a));
    const r=pool[0]; if(r){ chosen.add(r.id); usedProteins[r.protein]=(usedProteins[r.protein]||0)+1; } return r;
  };
  const batchR = bestBatch();
  const quickR = best(r=>r.under30 && (r.archetype==='protein'||r.archetype==='complete'||r.archetype==='traybake'), true)
              || best(r=>r.minutes<=35, true);
  const relaxedR = best(r=>r.minutes>=35 && r.minutes<=75 && r.archetype!=='soup', true)
                || best(r=>r.minutes>=35, true);
  const lunchR = best(r=>r.archetype==='salad'||r.archetype==='soup'||(r.archetype==='complete'&&r.minutes<=40), true)
              || best(()=>true, true);

  const batch = slotMake(batchR,'batch');
  batch.detail = leadNote(batchR);
  batch.transform = transformObj(batchR);
  const d1 = slotMake(quickR,'d0'); d1.detail = detailLine(quickR,'quick');
  const d2 = slotMake(relaxedR,'d1'); d2.detail = detailLine(relaxedR,'relaxed');
  const weekend = slotMake(lunchR,'we'); weekend.detail = detailLine(lunchR,'weekend lunch');

  // flag up to 3 clean-hit days: strong protein AND carbs once sides are counted
  const slots = [batch,d1,d2,weekend];
  slots.map(s=>({s,m:totalMacros(s)}))
       .filter(x=>x.m.p>=65 && x.m.c>=85)
       .sort((a,b)=>(b.m.p+b.m.c)-(a.m.p+a.m.c))
       .slice(0,3).forEach(x=>{ x.s.target=true; });

  const prep = buildPrep(batch, [d1,d2], weekend, recipes);
  const week = weekLabel();
  return { week, generated:true, inventory:[...invSet], batch, dinners:[d1,d2], weekend, prep };
}

function buildPrep(batch, dinners, weekend, recipes){
  const byId=Object.fromEntries(recipes.map(r=>[r.id,r]));
  const ahead=[]; const dayof=[];
  const slots=[['Batch',batch],['',dinners[0]],['',dinners[1]],['Weekend',weekend]];
  // 1) recipe-specific make-ahead (proves, marinades, brines, soaks) — the real companion logic
  for(const [tag,s] of slots){
    const r=byId[s.recipeId]; if(!r) continue;
    for(const ma of (r.make_ahead||[])){
      ahead.push(`${s.name}: ${ma.task}`);
    }
  }
  // 2) batch cook itself (no day assumption)
  ahead.push(`Cook the batch — ${batch.name}`);
  // 3) reusable components from sides
  const veg=new Set(), condiments=[];
  for(const [,s] of slots){ for(const sd of (s.sides||[])){
    if(sd.kind==='veg') veg.add(sd.options[sd.i||0].name);
    if(sd.kind==='condiment') condiments.push(sd.options[sd.i||0].name);
  }}
  if(condiments.length) ahead.push(`Make ahead: ${[...new Set(condiments)].join(', ')} — holds all week`);
  ahead.push('Wash & spin herbs, roll in paper towel');
  if(veg.size) ahead.push(`Trim & store veg: ${[...veg].slice(0,4).join(', ')}`);
  // 4) day-of
  dinners.forEach(d=>{ const r=byId[d.recipeId];
    if(r&&r.lead_h>0) dayof.push(`${d.name}: finish & cook (make-ahead already started)`);
    else dayof.push(`${d.name}: prep aromatics, start the carb first`);
  });
  dayof.push(`Weekend — ${weekend.name}: assemble or reheat`);
  return { ahead, dayof };
}

function weekLabel(){
  const d=new Date(); const day=d.getDay(); const diff=(day===0?0:7-day); // next Sunday-ish
  const s=new Date(d); s.setDate(d.getDate()+ (day===0?0:(1-day+7)%7)); // upcoming Monday-ish start
  const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `Week of ${mon[s.getMonth()]} ${s.getDate()}`;
}

/* ---- swap alternatives (3) for a slot ---- */
function alternatives(recipes, slotKind, currentId, history){
  const hist = history||[];
  let pool = recipes.filter(r=>r.isMain && r.id!==currentId);
  if (slotKind==='batch') pool = pool.filter(r=>r.batchable);
  else if (slotKind==='quick') pool = pool.filter(r=>r.under30);
  else if (slotKind==='relaxed') pool = pool.filter(r=>r.minutes>=35 && r.minutes<=75);
  else if (slotKind==='lunch') pool = pool.filter(r=>r.archetype==='salad'||r.archetype==='soup'||r.archetype==='complete');
  pool.sort((a,b)=>scoreMain(b,hist,new Set(),Math.random())-scoreMain(a,hist,new Set(),Math.random()));
  return pool.slice(0,3);
}

/* ---- shopping list ---- */
const COSTCO_UNAVAIL = ['romaine','cilantro','parsley','basil','mint','dill','holy basil','ground pork','shredded carrot','persian cucumber','jalapeño','jalapeno','shredded cheddar','tortilla','shiitake','tofu','fresh ginger','scallion','green onion'];
const FREEZER = /\b(chicken|thigh|thighs|breast|drumstick|beef|ground (beef|lamb|turkey|pork)|pork\b|pork shoulder|pork butt|bacon|pancetta|sausage|chorizo|lamb|salmon|\bcod\b|halibut|sea bass|branzino|shrimp|prawn|whole fish|fish fillet|fillet|steak|ribs|brisket|oxtail|short rib)\b/i;
const PANTRY = /\b(salt|black pepper|white pepper|peppercorn|olive oil|neutral oil|sesame oil|vegetable oil|canola|soy sauce|light soy|dark soy|fish sauce|oyster sauce|hoisin|shaoxing|black bean sauce|doubanjiang|gochujang|vinegar|sugar|brown sugar|molasses|maltose|flour|cornstarch|corn starch|stock|broth|\brice\b|basmati|jasmine rice|pasta|spaghetti|penne|noodle|lentil|\bdal\b|chickpea|canned|crushed tomato|diced tomato|tomato paste|tomato sauce|passata|cumin|coriander|turmeric|paprika|chili powder|red pepper flake|garam masala|curry powder|five-spice|five spice|bay leaf|oregano|thyme|baking powder|baking soda|honey|sesame|tamarind|coconut milk|dijon|mustard|worcester|ketchup|adobo|kosher salt|caster sugar|vanilla|yeast|panko|breadcrumb)\b/i;
const SKIP = /^(a |an |the |of |or |plus|for (braising|serving|the|garnish|dusting)|to (taste|serve|garnish|finish)|see notes|optional|as needed|freshly|good |extra )/i;
const HEADER = /^(for the|for chili|filling|topping|dipping sauce|pancake batter|marinade|sauce|garnish|to serve|to garnish|to finish|assembly|special equipment|equipment)\b/i;
function coreNoun(line){
  let s=line.toLowerCase().trim();
  if (HEADER.test(s)) return '';
  s=s.replace(/^[\d¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞\/.\s×x-]+/,'');           // leading amount
  s=s.replace(/^(g|kg|ml|l|oz|lb|lbs)\b\s*(of\s+)?/,'');       // metric unit that survived (e.g. "100g of garlic")
  s=s.replace(/\([^)]*\)/g,' ');
  s=s.replace(/,.*$/,'');
  s=s.replace(/\b\d+[\d¼½¾⅓⅔.\/\s]*\s?(g|kg|ml|l|oz|lb|lbs|cups?|tbsp|tsp)\b/g,' '); // inline "1 1/2 lb"
  s=s.replace(/\b(tablespoons?|tbsp|teaspoons?|tsp|cups?|ml|milliliters?|liters?|grams?|kg|kilograms?|ounces?|oz|pounds?|lbs?|lb|pints?|quarts?|cans?|jars?|cloves?|pieces?|sprigs?|stalks?|ribs?|heads?|handful of|handful|bunch of|bunch|large|small|medium|finely|roughly|freshly|thinly|plus more|plus|optional|divided|chopped|minced|sliced|grated|drained|rinsed|trimmed|halved|cubed|packed|ground|whole|fresh|dried|good|extra-virgin|extra virgin|about|approximately|inch|inch-piece|piece of|piece|of)\b/g,' ');
  s=s.replace(/^\s*(a|an|the|or|of)\s+/,'');
  s=s.replace(/[^a-zàâçéèêëîïôûùüÿñæœ '&-]/g,' ');
  s=s.replace(/\s+/g,' ').trim();
  if (SKIP.test(s) || HEADER.test(s) || s.length<3) return '';
  return s;
}
function shopping(plan, recipes){
  const byId=Object.fromEntries(recipes.map(r=>[r.id,r]));
  const lines=[];
  const add=(rid,mult)=>{ const r=byId[rid]; if(!r)return; for(const ing of r.ingredients){ if(/^(for the|to serve|to garnish)/i.test(ing.trim())) continue; lines.push([ing,mult]); } };
  add(plan.batch.recipeId,2);
  plan.dinners.forEach(d=>add(d.recipeId,1));
  if(plan.weekend.recipeId && plan.weekend.recipeId!==plan.batch.recipeId) add(plan.weekend.recipeId,1);
  const seen=new Set(); const buckets={costco:[],other:[],pantry:[],freezer:[]};
  const PANTRY2=/\b(stock|broth|bouillon|cube|dried .*chil|ancho|cascabel|guajillo|chipotle in adobo|arbol|pasilla|chile|saffron|star anise|cinnamon|clove|cardamom|nutmeg|curry leaf|kasuri|fenugreek|asafoetida|garlic powder|onion powder|smoked paprika|cayenne|allspice|coriander seed|cumin seed|mustard seed)\b/i;
  for(const [ing] of lines){
    const noun=coreNoun(ing); if(!noun||noun.length<2) continue;
    const key=noun.replace(/s\b/,''); if(seen.has(key)) continue; seen.add(key);
    const label=noun.replace(/\b\w/,c=>c.toUpperCase());
    if(PANTRY.test(ing)||PANTRY2.test(ing)) buckets.pantry.push(label);
    else if(FREEZER.test(ing)||FREEZER.test(noun)) buckets.freezer.push(label);
    else if(COSTCO_UNAVAIL.some(x=>noun.includes(x))) buckets.other.push(label);
    else buckets.costco.push(label);
  }
  for(const k in buckets) buckets[k]=[...new Set(buckets[k])].sort();
  return buckets;
}

return { generate, alternatives, buildSides, transformObj, transformsFor, sideShape, totalMacros, shopping, slotMake, weekLabel };
})();
