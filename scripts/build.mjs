import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
const destination=new URL('../public/',import.meta.url);
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
for(const file of ['index.html','engine.js','shopping.js','sync.js','recipes-ui.js','recipes.json','manifest.webmanifest','sw.js']){
 await copyFile(new URL('../'+file,import.meta.url),new URL(file,destination));
}
await cp(new URL('../icons/',import.meta.url),new URL('icons/',destination),{recursive:true});
