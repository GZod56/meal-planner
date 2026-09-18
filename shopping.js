/* Conservative quantity aggregation: ambiguous lines remain visible verbatim. */
window.Shopping=(()=>{
 const fractions={'¼':.25,'½':.5,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};
 const units={
  teaspoon:['ml',5],teaspoons:['ml',5],tsp:['ml',5],tablespoon:['ml',15],tablespoons:['ml',15],tbsp:['ml',15],
  cup:['ml',240],cups:['ml',240],ml:['ml',1],milliliter:['ml',1],milliliters:['ml',1],l:['ml',1000],liter:['ml',1000],liters:['ml',1000],
  g:['g',1],gram:['g',1],grams:['g',1],kg:['g',1000],kilogram:['g',1000],kilograms:['g',1000],
  oz:['g',28.3495],ounce:['g',28.3495],ounces:['g',28.3495],lb:['g',453.592],lbs:['g',453.592],pound:['g',453.592],pounds:['g',453.592],
  clove:['clove',1],cloves:['clove',1],can:['can',1],cans:['can',1],bunch:['bunch',1],bunches:['bunch',1],sprig:['sprig',1],sprigs:['sprig',1]
 };
 const round=n=>String(Number(n.toFixed(2)));
 function amount(s){let n=0;for(const part of s.trim().split(/\s+/)){if(part.includes('/')){const[a,b]=part.split('/').map(Number);n+=a/b;}else n+=Number(part);}return n;}
 function parse(line,multiplier=1){
  const raw=String(line).trim();
  if(!raw||/^\(|^(for the|for serving|to serve|to garnish|special equipment)\b/i.test(raw)||/:$/.test(raw)||/^(marinade|sauce|filling|topping|garnish|assembly|equipment)$/i.test(raw))return null;
  let s=raw.replace(/(\d)?([¼½¾⅓⅔⅛⅜⅝⅞])/g,(_,w,f)=>String((Number(w)||0)+fractions[f]));
  if(/^\d[\d\s./]*(?:[–—-]\s*\d|\s+to\s+\d)/.test(s)||/\b(or|plus)\b/i.test(s))return {raw,multiplier,ambiguous:true};
  const m=s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*/);
  let qty=m?amount(m[1])*multiplier:null,unit='',size='';
  if(m)s=s.slice(m[0].length);
  const packageSize=s.match(/^\(([^)]+)\)\s*(cans?|jars?|packages?)\s+/i);
  if(packageSize){size=' ('+packageSize[1].toLowerCase()+')';unit=packageSize[2].replace(/s$/,'')+size;s=s.slice(packageSize[0].length);}
  else{
    const u=s.match(/^([a-z]+)\.?\b\s*/i);
    if(u&&units[u[1].toLowerCase()]){const [base,factor]=units[u[1].toLowerCase()];unit=base;if(qty!==null)qty*=factor;s=s.slice(u[0].length);}
  }
  // Never discard descriptors such as ground, dried, fresh, or boneless.
  let name=s.replace(/^of\s+/i,'').replace(/\s*\([^)]*\)/g,'').split(',')[0]
    .replace(/\s+(to taste|for serving|for garnish|as needed).*$/i,'')
    .replace(/^(large|medium|small|finely chopped|chopped|minced|grated|sliced|diced)\s+/i,'')
    .replace(/\s+/g,' ').trim().toLowerCase();
  if(!name||/^(deseeded|leaves|stems|optional|divided|see notes|select a|cut into)\b/i.test(name))return {raw,multiplier,ambiguous:true};
  name=name.replace(/\b(onions|carrots|lemons|limes|eggs|potatoes|tomatoes)\b/g,x=>({potatoes:'potato',tomatoes:'tomato'}[x]||x.slice(0,-1)));
  return {name,unit,qty,raw,multiplier};
 }
 function display(qty,unit){
  if(qty===null)return '';
  if(unit==='g')return qty>=1000?round(qty/1000)+' kg':round(qty)+' g';
  if(unit==='ml'){
    if(qty>=1000)return round(qty/1000)+' l';
    if(qty>=240&&Math.abs(qty/240-Math.round(qty/240))<.001)return round(qty/240)+' cup'+(qty===240?'':'s');
    if(qty>=15&&qty<=120&&Math.abs(qty/15-Math.round(qty/15))<.001)return round(qty/15)+' tbsp';
    if(qty<15)return round(qty/5)+' tsp';return round(qty)+' ml';
  }
  return round(qty)+(unit?' '+unit:'');
 }
 function build(plan,recipes,options={}){
  const byId=Object.fromEntries(recipes.map(r=>[r.id,r])),items=new Map(),buckets={costco:[],other:[],pantry:[],freezer:[],check:[]};
  const add=(id,multiplier)=>{
    const r=byId[id];if(!r)return;
    for(const line of r.ingredients){
      const p=parse(line,multiplier);if(!p)continue;
      const key=p.ambiguous?'check:'+r.id+':'+line:[p.name,p.unit,p.qty===null?'unspecified':'measured'].join('|');
      const prev=items.get(key);
      if(prev&&p.qty!==null&&!p.ambiguous)prev.qty+=p.qty;
      else if(!prev)items.set(key,{...p,key,sources:[r.name]});
      if(prev&&!prev.sources.includes(r.name))prev.sources.push(r.name);
    }
  };
  if(plan.batch)add(plan.batch.recipeId,Number(options.batchScale)||2);
  for(const dinner of plan.dinners||[])add(dinner.recipeId,1);
  if(plan.weekend&&plan.weekend.recipeId!==plan.batch?.recipeId)add(plan.weekend.recipeId,1);
  for(const p of items.values()){
    if(p.ambiguous){buckets.check.push({key:p.key,label:p.raw+(p.multiplier!==1?' — ×'+p.multiplier:''),sources:p.sources});continue;}
    const name=p.name,measurement=display(p.qty,p.unit),label=name[0].toUpperCase()+name.slice(1)+(measurement?' — '+measurement:'');
    const pantry=/\b(salt|pepper|oil|vinegar|sugar|flour|stock|broth|soy sauce|fish sauce|oyster sauce|hoisin|shaoxing|mirin|rice|pasta|noodles?|lentils?|canned|crushed tomato|tomato paste|spices?|cumin|paprika|turmeric|cinnamon|coriander seed|chili powder|coconut milk|honey|mustard|cornstarch|baking|yeast)\b/i.test(name);
    const protein=/\b(chicken|beef|pork|lamb|turkey|bacon|sausage|salmon|shrimp|prawn|fish|cod|halibut|tuna|branzino|sea bass|crab|steak|ribs)\b/i.test(name);
    const other=/\b(cilantro|parsley|basil|mint|dill|romaine|scallion|jalapeño|tofu|shiitake)\b/i.test(name);
    buckets[pantry?'pantry':protein?'freezer':other?'other':'costco'].push({key:p.key,label,sources:p.sources});
  }
  for(const key in buckets)buckets[key].sort((a,b)=>a.label.localeCompare(b.label));
  return buckets;
 }
 return {parse,build};
})();
