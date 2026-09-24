/* In-app recipe authoring. Imported recipes are always reviewed before saving. */
function safeRecipeURL(value){
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
function normalizeRecipe(r){
 if(!r||typeof r.id!=='string'||!r.name||!Array.isArray(r.ingredients)||!Array.isArray(r.directions))return null;
 const n=Number(r.serves?.n)||4,minutes=Number(r.minutes)||30;
 const section=['main','side','sauce','baking'].includes(r.section)?r.section:'main';
 return {...r,name:String(r.name).slice(0,180),serves:{n:Math.max(1,Math.min(100,n)),text:'Serves: '+n},
   ingredients:r.ingredients.filter(x=>typeof x==='string'),directions:r.directions.filter(x=>typeof x==='string'),
   notes:Array.isArray(r.notes)?r.notes.filter(x=>typeof x==='string'):[],tags:Array.isArray(r.tags)?r.tags:[],
   minutes,under30:minutes<=30,section,isMain:section==='main',batch:!!r.batchable,
   protein:r.protein||'Vegetarian',cuisine:r.cuisine||'other',archetype:r.archetype||'complete',
   source:{name:String(r.source?.name||''),url:safeRecipeURL(r.source?.url)},image:safeRecipeURL(r.image),
   lead_h:Number(r.lead_h)||0,favourite:!!r.favourite};
}
function applyRecipeOverrides(){
 const overrides=lsGet('mp.recipes',{});
 BYID=Object.fromEntries(BASE_RECIPES.map(r=>[r.id,r]));
 for(const [id,value]of Object.entries(overrides||{})){const r=normalizeRecipe({...value,id});if(r)BYID[id]=r;}
 refreshLibrary();
}
function openRecipeEditor(recipe={}){
 const sh=$('#sheet');sh.classList.add('open');
 const r=recipe,editing=!!r.id;
 const input=(id,label,value,type='text')=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value??'')}" ${type==='number'?'min="1" max="10000"':''}></div>`;
 const area=(id,label,values)=>`<div class="field"><label for="${id}">${label}</label><textarea class="sheet-area" id="${id}">${esc((values||[]).join('\n'))}</textarea></div>`;
 const select=(id,label,options,value)=>`<div class="field"><label for="${id}">${label}</label><select id="${id}">${options.map(([v,t])=>`<option value="${v}" ${v===value?'selected':''}>${t}</option>`).join('')}</select></div>`;
 sh.innerHTML=`<div class="sheet-inner"><h2 class="rname">${editing?'Edit recipe':'New recipe'}</h2>
   <form id="recipeForm">
   ${input('recipeName','Recipe name',r.name)}
   <div class="edit-grid">${input('recipeMinutes','Minutes',r.minutes||30,'number')}${input('recipeServes','Servings',r.serves?.n||4,'number')}</div>
   ${select('recipeSection','Section',SECTIONS,r.section||'main')}
   ${select('recipeProtein','Main protein',['Vegetarian','Chicken','Beef','Pork','Lamb','Fish','Seafood','Eggs'].map(x=>[x,x]),r.protein||'Vegetarian')}
   ${select('recipeCuisine','Cuisine',[['other','Other'],['indian','Indian'],['mexican','Mexican'],['italian','Italian'],['se_asian','Southeast Asian'],['chinese','Chinese'],['japanese','Japanese'],['korean','Korean'],['french','French'],['greek_med','Mediterranean'],['american','American']],r.cuisine||'other')}
   ${select('recipeType','Dish type',[['complete','Complete meal'],['protein','Protein with sides'],['stew','Stew'],['curry','Curry'],['soup','Soup'],['salad','Salad'],['traybake','Traybake']],r.archetype||'complete')}
   <div class="field"><label><input type="checkbox" id="recipeBatch" ${r.batchable?'checked':''}> Good for batch cooking</label><label><input type="checkbox" id="recipeFavourite" ${r.favourite?'checked':''}> Favourite</label></div>
   ${area('recipeIngredients','Ingredients — one per line',r.ingredients)}
   ${area('recipeDirections','Directions — one step per line',r.directions)}
   ${area('recipeNotes','Notes — one per line',r.notes)}
   ${input('recipeURL','Source URL (optional)',r.source?.url,'url')}
   <p id="recipeError" role="alert"></p><div class="save-row"><button type="button" data-editor-cancel>Cancel</button><button class="primary" type="submit">Save recipe</button></div></form></div>`;
 sh.querySelector('#recipeName').required=true;sh.querySelector('#recipeName').maxLength=180;
 sh.querySelector('#recipeIngredients').required=true;sh.querySelector('#recipeDirections').required=true;
 const close=()=>{sh.classList.remove('open');};
 sh.onclick=e=>{if(e.target.closest('[data-editor-cancel]'))close();};
 sh.querySelector('form').onsubmit=async e=>{
   e.preventDefault();
   const val=id=>sh.querySelector('#'+id).value.trim();
   const lines=id=>val(id).split('\n').map(s=>s.trim()).filter(Boolean);
   const ingredients=lines('recipeIngredients'),directions=lines('recipeDirections');
   if(!val('recipeName')||!ingredients.length||!directions.length||ingredients.length>150||directions.length>150){
     sh.querySelector('#recipeError').textContent='Add a name, ingredients, and directions (up to 150 lines each).';return;
   }
   const id=r.id||'recipe-'+crypto.randomUUID();
   const sourceURL=safeRecipeURL(val('recipeURL'));
   let sourceImage=safeRecipeURL(r.image);
   if(sourceURL&&(!sourceImage||safeRecipeURL(r.source?.url)!==sourceURL)){
     try{
       const imported=await Household.api('import-recipe',{method:'POST',body:JSON.stringify({url:sourceURL})});
       sourceImage=safeRecipeURL(imported?.recipe?.image)||sourceImage;
     }catch(_err){/* A manual recipe can still be saved when a source blocks imports. */}
   }
   const saved=normalizeRecipe({...r,id,name:val('recipeName'),minutes:+val('recipeMinutes'),serves:{n:+val('recipeServes')},
     section:val('recipeSection'),protein:val('recipeProtein'),cuisine:val('recipeCuisine'),archetype:val('recipeType'),
     ingredients,directions,notes:lines('recipeNotes'),batchable:sh.querySelector('#recipeBatch').checked,
     favourite:sh.querySelector('#recipeFavourite').checked,image:sourceImage,source:{url:sourceURL,name:sourceURL?new URL(sourceURL).hostname:''}});
   const overrides=lsGet('mp.recipes',{});overrides[id]=saved;
   if(!lsSet('mp.recipes',overrides)){sh.querySelector('#recipeError').textContent='Could not save. Free up browser storage and try again.';return;}
   applyRecipeOverrides();close();closeRecipe();tab='library';filt.sec=saved.section;filt.q='';render();openRecipe(id);
 };
 sh.querySelector('#recipeName').focus();
}
function openRecipeImport(){
 const sh=$('#sheet');sh.classList.add('open');
 sh.innerHTML=`<div class="sheet-inner"><h2 class="rname">Import a recipe</h2>
 <p class="sheet-note">Paste a public recipe link. You can review and edit everything before saving.</p>
 <form id="importRecipeForm"><div class="field"><label for="importURL">Recipe URL</label><input id="importURL" type="url" required placeholder="https://…"></div>
 <p id="importError" role="alert"></p><div class="save-row"><button type="button" data-import-cancel>Cancel</button><button class="primary" type="submit">Import</button></div></form>
 <button class="sheet-btn" data-import-manual>Enter recipe manually</button></div>`;
 sh.onclick=e=>{if(e.target.closest('[data-import-cancel]'))sh.classList.remove('open');if(e.target.closest('[data-import-manual]'))openRecipeEditor();};
 sh.querySelector('form').onsubmit=async e=>{
   e.preventDefault();const button=sh.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Importing…';
   try{const result=await Household.api('import-recipe',{method:'POST',body:JSON.stringify({url:sh.querySelector('#importURL').value.trim()})});
     const canonical=url=>safeRecipeURL(url).replace(/\/$/,'');
     const existing=Object.values(BYID).find(r=>r.source?.url&&canonical(r.source.url)===canonical(result.recipe.source.url));
     openRecipeEditor(existing?{...existing,...result.recipe,id:existing.id}:result.recipe);}
   catch(err){sh.querySelector('#importError').textContent=err.message;button.disabled=false;button.textContent='Import';}
 };
 sh.querySelector('#importURL').focus();
}
