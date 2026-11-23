
const CompanyXML=(()=>{
 const MAX_BYTES=750000;
 const encode=new TextEncoder();
 const decode=new TextDecoder('utf-8',{fatal:true});
 function write(model) {
  const doc=document.implementation.createDocument('','mercenaryCompany');
  const root=doc.documentElement;
  root.setAttribute('version','1');
  function add(parent,key,value) {
   if(value===undefined)return;
   const node=doc.createElement('value');
   if(key!==null)node.setAttribute('name',key);
   const type=Array.isArray(value)?'array':value===null?'null':typeof value;
   if(type==='string'&&/[\u0000-\u0008\u000b-\u001f\ufffe\uffff]/.test(value)){node.setAttribute('type','string64');node.textContent=toBase64(encode.encode(value));parent.append(node);return;}
   node.setAttribute('type',type);
   if(type==='array')for(const item of value)add(node,null,item);
   else if(type==='object')for(const key of Object.keys(value).sort())add(node,key,value[key]);
   else if(type!=='null')node.textContent=String(value);
   parent.append(node);
  }
  add(root,null,model);
  const bytes=encode.encode('<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(doc));
  if(bytes.length>MAX_BYTES)throw Error('Company XML exceeds 750 KB. Export a JSON backup to keep this copy.');
  return bytes;
 }
 function read(bytes) {
  if(bytes.length>MAX_BYTES)throw Error('Company XML exceeds 750 KB.');
  const xml=decode.decode(bytes);
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Company XML cannot contain a document type or entities.');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  const root=doc.documentElement;
  if(doc.querySelector('parsererror')||root?.tagName!=='mercenaryCompany'||root.getAttribute('version')!=='1'||root.children.length!==1)throw Error('Choose a Mercenaries company XML backup.');
  function value(node,depth) {
   if(depth>20||node.tagName!=='value')throw Error('Invalid company XML.');
   const children=[...node.children];
   const content=node.textContent;
   switch(node.getAttribute('type')){
    case 'array':return children.map(child=>value(child,depth+1));
    case 'object':{
     const names=children.map(child=>child.getAttribute('name'));
     if(names.some(name=>!name)||new Set(names).size!==names.length)throw Error('Invalid company XML fields.');
     return Object.fromEntries(children.map((child,index)=>[names[index],value(child,depth+1)]));
    }
    case 'string':if(!children.length)return content;break;
    case 'string64':if(!children.length)return decode.decode(fromBase64(content));break;
    case 'number':if(!children.length&&content.trim()&&Number.isFinite(Number(content)))return Number(content);break;
    case 'boolean':if(!children.length&&['true','false'].includes(content))return content==='true';break;
    case 'null':if(!children.length&&!content)return null;
   }
   throw Error('Invalid company XML field value.');
  }
  return value(root.firstElementChild,0);
 }
 function toBase64(bytes){
  let raw='';
  for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(raw);
 }
 const fromBase64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 return {MAX_BYTES,write,read,toBase64,fromBase64,hash};
})();
class PrivateCompanyRepository {
 constructor(repository,token,request=(...args)=>fetch(...args)){
  const name=repository.trim().replace(/^https:\/\/github\.com\//i,'').replace(/\/$/,'');
  if(!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(name)||name.endsWith('/.')||name.endsWith('/..'))throw Error('Use a GitHub repository in owner/repository form.');
  if(!token.trim())throw Error('Enter a GitHub token with Contents read and write access.');
  this.name=name;this.token=token.trim();this.request=request;
 }
 async api(path, options={}){
  const response=await this.request('https://api.github.com/repos/'+this.name+path,{...options,cache:'no-store',redirect:'error',
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+this.token,'X-GitHub-Api-Version':'2022-11-28',...(options.body?{'Content-Type':'application/json'}:{})}});
  if(!response.ok){
   const messages={401:'GitHub session expired. Connect again.',403:'GitHub denied access. Check repository and token permissions.',409:'The GitHub copy changed. Local edits are safe.',422:'GitHub rejected the update. Check the branch or reload the company.'};
   const error=Error(messages[response.status]||'GitHub request failed ('+response.status+'). The local company is safe.');
   error.status=response.status;throw error;
  }
  return response.json();
 }
 async verify(){
  const info=await this.api('');
  if(!info.private)throw Error('Choose a private GitHub repository.');
  if(info.archived||info.permissions?.push===false)throw Error('This repository does not allow saves.');
  this.id=info.id;this.branch=info.default_branch;
 }
 path(path){return path.split('/').map(encodeURIComponent).join('/');}
 async list(){
  const root=await this.api('/git/trees/'+encodeURIComponent(this.branch));
  const companies=root.tree.find(item=>item.type==='tree'&&item.path==='companies');
  if(!companies)return [];
  const listing=await this.api('/git/trees/'+companies.sha+'?recursive=1');
  if(listing.truncated)throw Error('GitHub returned an incomplete company list.');
  return listing.tree.flatMap(item=>{
   const match=item.type==='blob'&&/^([^/]+)\/company\.xml$/i.exec(item.path);
   if(!match)return [];
   const folder=match[1];
   const name=folder.replace(/-[a-f0-9]{8}$/i,'').replace(/[-_]+/g,' ')||folder;
   return [{path:'companies/'+item.path,name,folder}];
  }).sort((a,b)=>a.name.localeCompare(b.name)||a.folder.localeCompare(b.folder));
 }
 async read(path){
  if(!/^companies\/([^/]+)\/company\.xml$/i.test(path))throw Error('Choose an XML company file.');
  try{
   const file=await this.api('/contents/'+this.path(path));
   if(file.type!=='file'||file.encoding!=='base64'||file.size>CompanyXML.MAX_BYTES)throw Error('Choose a company XML file up to 750 KB.');
   return {sha:file.sha,bytes:CompanyXML.fromBase64(file.content)};
  }catch(error){if(error.status===404)return null;throw error;}
 }
 async exchange(base,path,bytes,allowCreate){
  await this.verify();
  if(base&&base.repoId!==this.id)throw Error('This company is linked to another repository. Use Load or disconnect its link first.');
  const localHash=await CompanyXML.hash(bytes);
  const current=await this.read(path);
  if(!current&&base)throw Error('The GitHub company was removed. Your local copy is safe.');
  if(!current&&!allowCreate)throw Error('Use Save once to create the GitHub company file.');
  const remote=(sha,hash)=>({repoId:this.id,path,sha,hash});
  if(current){
   const remoteHash=await CompanyXML.hash(current.bytes);
   if(remoteHash===localHash)return {remote:remote(current.sha,localHash)};
   if(!base||current.sha!==base.sha){
    if(base&&localHash===base.hash)return {pull:current.bytes,remote:remote(current.sha,remoteHash)};
    const conflict=Error('Both copies changed. Local edits are safe. Export a backup before loading the GitHub copy.');
    conflict.conflict=true;throw conflict;
   }
   if(localHash===base.hash)return {remote:base};
  }
  await this.verify();
  const saved=await this.api('/contents/'+this.path(path),{method:'PUT',body:JSON.stringify({
   message:'Save Mercenaries company snapshot',branch:this.branch,content:CompanyXML.toBase64(bytes),...(current?{sha:current.sha}:{})})});
  return {remote:remote(saved.content.sha,localHash)};
 }
}
