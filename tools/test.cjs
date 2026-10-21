'use strict';
const {readdirSync}=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=readdirSync(path.join(root,'test')).filter(name=>name.endsWith('.test.cjs')).sort().map(name=>path.join('test',name));
const result=spawnSync(process.execPath,['--test','--test-timeout=30000',...files],{cwd:root,stdio:'inherit'});
if (result.error) console.error(result.error.message);
process.exitCode=result.status??1;
