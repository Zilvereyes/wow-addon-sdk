import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const runner=path.resolve('scripts/inspect-addon-corpus.mjs');
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function fixture(language, phase, fifo=false) {
  const temporary=path.resolve(os.tmpdir());
  const workspace=fs.mkdtempSync(path.join(temporary,'wow-sdk-corpus-read-race-'));
  try {
    const root=path.join(workspace,'corpus'); fs.mkdirSync(root);
    fs.writeFileSync(path.join(root,'Seed.toc'),'#');
    const target=path.join(root,'Authored.'+language), replacement=path.join(workspace,'authored-replacement.txt');
    fs.writeFileSync(target,language==='lua'?'Out=1':'<Ui/>');
    fs.writeFileSync(replacement,language==='lua'?'New=2':'<r />');
    fs.utimesSync(target,1710000000,1710000000);fs.utimesSync(replacement,1710000000,1710000000);
    const replacedHash=hash(replacement), preload=path.join(workspace,'authored-race.mjs');
    const preloadLines=[
      "import assert from 'node:assert/strict';",
      "import fs from 'node:fs';",
      "import os from 'node:os';",
      "import path from 'node:path';",
      "import {spawnSync} from 'node:child_process';",
      "const workspace="+JSON.stringify(workspace)+", target="+JSON.stringify(target)+", replacement="+JSON.stringify(replacement)+";",
      "assert.equal(path.dirname(workspace),path.resolve(os.tmpdir()));",
      "assert.ok(path.basename(workspace).startsWith('wow-sdk-corpus-read-race-'));",
      "assert.equal(path.dirname(target),path.join(workspace,'corpus'));",
      "assert.equal(path.basename(target),"+JSON.stringify('Authored.'+language)+");",
      "assert.equal(path.dirname(replacement),workspace);",
      "let replaced=false, descriptor=null, observed=0;",
      "const open=fs.openSync, stat=fs.fstatSync;",
      "function replace(){if(replaced)return;replaced=true;fs.unlinkSync(target);",
      fifo ? "const made=spawnSync('mkfifo',[target],{shell:false,encoding:'utf8',timeout:2000,killSignal:'SIGKILL'});assert.equal(made.error,undefined);assert.equal(made.status,0,made.stderr);" : "fs.renameSync(replacement,target);",
      "}",
      "fs.openSync=function(filename,flags,...rest){",
      "if(filename===target){if("+JSON.stringify(phase)+"==='before-open')replace();descriptor=open.call(this,filename,flags,...rest);return descriptor;}",
      "return open.call(this,filename,flags,...rest);};",
      "fs.fstatSync=function(fd,...options){const result=stat.call(this,fd,...options);",
      "if(fd===descriptor&&++observed===2&&"+JSON.stringify(phase)+"==='after-final-stat')replace();return result;};",
    ];
    fs.writeFileSync(preload,preloadLines.join('\n'));
    const result=spawnSync(process.execPath,['--import',pathToFileURL(preload).href,runner,root,language==='lua'?'--lua-analysis':'--xml-analysis'],{
      encoding:'utf8',windowsHide:true,timeout:5000,killSignal:'SIGKILL',
    });
    assert.equal(result.error,undefined,'bounded read must not hang at a raced open');
    assert.equal(result.signal,null,'native read must not need forced termination');
    assert.equal(result.status,1,'a raced source is an incomplete read, not a successful parser input');
    const report=JSON.parse(result.stdout), counts=language==='lua'?report.luaAnalysis:report.xmlAnalysis;
    assert.equal(report.parsed[language],0,'unstable input must never reach its parser');
    assert.equal(counts.readFailures,1);
    assert.equal(counts.submitted,0);assert.equal(counts.completed,0);
    assert.equal(counts.complete,false);
    assert.ok(report.failures.includes(language+'-read-failure'));
    assert.equal((result.stdout+result.stderr).includes(workspace),false);
    if(!fifo)assert.equal(hash(target),replacedHash,'the SDK must not alter replacement bytes');
  }finally{
    assert.equal(path.dirname(path.resolve(workspace)),temporary);
    assert.ok(path.basename(workspace).startsWith('wow-sdk-corpus-read-race-'));
    fs.rmSync(workspace,{recursive:true,force:true});
  }
}
test('Lua corpus rejects same-size same-mtime inode replacement before source open',()=>fixture('lua','before-open'));
test('XML corpus rejects pathname replacement after its final descriptor stat before syntax credit',()=>fixture('xml','after-final-stat'));
for(const language of ['lua','xml'])test(language+' corpus cannot block on a FIFO substituted before open',{
  skip:process.platform!=='linux'?'native FIFO race requires Linux; no host setup is performed':false,
},()=>fixture(language,'before-open',true));
