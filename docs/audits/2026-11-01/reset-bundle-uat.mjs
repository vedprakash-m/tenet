// Run from the repository root; optional arguments are additional Node executables.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const bundle=resolve('plugin/kernel/tenet.mjs');
const runtimes=[process.execPath,...process.argv.slice(2)];
const env={...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'};
delete env.NODE_OPTIONS;
const observations=[];
for(const runtime of runtimes){
 const root=mkdtempSync(join(tmpdir(),'tenet-reset-bundle-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,env,encoding:'utf8'}).trim();
 const call=(verb,body)=>{
  const result=spawnSync(runtime,[bundle,verb],{cwd:root,env,input:JSON.stringify(body),encoding:'utf8'});
  assert.equal(result.signal,null,result.stderr);
  const response=JSON.parse(result.stdout); assert.equal(result.status,response.exit,result.stderr); return response;
 };
 const config=()=>JSON.parse(readFileSync(join(root,'.tenet/state'),'utf8')).config;
 try{
  git('init','-q','-b','main'); git('config','user.name','Test'); git('config','user.email','test@example.com'); git('config','commit.gpgsign','false');
  mkdirSync(join(root,'src')); writeFileSync(join(root,'src/a.ts'),'export const a = 1;\n');
  writeFileSync(join(root,'package.json'),'{"name":"reset-uat","private":true,"type":"module"}\n'); writeFileSync(join(root,'.gitignore'),'.tenet/\n');
  git('add','-A'); git('commit','-qm','fixture');
  const opened=call('open',{profile:'feature',request:'Preserve project protection',lane:'quick'}); assert.equal(opened.exit,0,JSON.stringify(opened)); const h=opened.handle;
  assert.equal(call('decide',{h,kind:'config',target:'style',propose:{value:'concise',scope:'project'}}).exit,0);
  assert.equal(call('decide',{h,kind:'config',target:'protected_paths',propose:{value:['db/**']}}).exit,0);
  const before=config();
  const cases=[{reset:true,scope:'global'},{reset:true,scope:'task'},...['false','true',1,{},[]].map(reset=>({reset}))];
  for(const propose of cases){
   const response=call('decide',{h,kind:'config',target:'protected_paths',propose});
   assert.equal(response.exit,2,JSON.stringify(response)); assert.equal(response.reasons[0].code,'restriction-key-unknown'); assert.deepEqual(config(),before);
  }
  const reset=call('decide',{h,kind:'config',target:'protected_paths',propose:{reset:true}}); assert.equal(reset.exit,0,JSON.stringify(reset));
  assert.deepEqual(config(),{revision:before.revision+1,local:{style:'concise'}});
  const after=config(); const repeat=call('decide',{h,kind:'config',target:'protected_paths',propose:{reset:true},again:true}); assert.equal(repeat.exit,0); assert.equal(repeat.data.changed,false); assert.deepEqual(config(),after);
  observations.push({runtime:execFileSync(runtime,['--version'],{encoding:'utf8'}).trim(),invalidCases:cases.length,configurationPreserved:true,literalTrueReset:true,unrelatedPreferencePreserved:true,repeatedResetNoop:true});
 }finally{rmSync(root,{recursive:true,force:true});}
}
const bytes=readFileSync(bundle);
console.log(JSON.stringify({bundle:{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},observations},null,2));
