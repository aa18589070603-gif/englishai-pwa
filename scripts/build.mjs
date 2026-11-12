import{copyFile,mkdir,rm}from'node:fs/promises';
import{dirname,resolve}from'node:path';
import{fileURLToPath}from'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'dist');
const files=['index.html','styles.css','core.js','vocab.js','media-store.js','cloud-sync.js','app.js','dialogue.js','manifest.webmanifest','sw.js','icon-192.png','icon-512.png'];
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await Promise.all(files.map(name=>copyFile(resolve(root,name),resolve(out,name))));
