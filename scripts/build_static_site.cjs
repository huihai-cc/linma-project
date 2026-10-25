'use strict';
// 正式静态输出：只接受固定白名单和逐文件 SHA256，不遍历复制仓库。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const allowed = /^(?:[^/]+\.(?:html|js|css|png)|assets\/brand\/huihai-logo\.png)$/;
const forbidden = /(?:candidate|\.sealed|(?:^|\/)(?:docs|tests|scripts|data|plans|gas_candidate|node_modules|public|\.git)(?:\/|$))/i;
function filesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir,entry.name);
    if (entry.isSymbolicLink()) throw new Error('output symlink 不允许: ' + full);
    if (entry.isDirectory()) result.push(...filesIn(full));
    else result.push(full);
  }
  return result;
}
function build({root, manifest, output}) {
  root = fs.realpathSync(root);
  output = path.resolve(output);
  if(output !== path.join(root, 'public')) throw new Error('output 输出必须为项目内 public');
  if(fs.existsSync(output) && (fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output) !== output)) {
    throw new Error('output 输出路径重定向不允许');
  }
  if(manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('invalid manifest');
  const planned = new Map();
  // 先全部校验，失败时不修改已有输出。
  for(const item of manifest.files) {
    const rel = item.path;
    if(typeof rel !== 'string' || !allowed.test(rel) || forbidden.test(rel) || rel.includes('..') || rel.includes('\\')) {
      throw new Error('forbidden path 不允许: ' + rel);
    }
    if(planned.has(rel) || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('invalid path/SHA256: ' + rel);
    let bytes;
    if(item.source === 'git') {
      if(!/^[a-f0-9]{40}$/.test(item.revision)) throw new Error('invalid git revision');
      bytes = execFileSync('git', ['show', item.revision + ':' + rel], {cwd:root, maxBuffer:16*1024*1024});
    } else if(item.source === 'workspace') {
      const source = path.join(root,rel);
      if(fs.realpathSync(source) !== source) throw new Error('source symlink 不允许: ' + rel);
      bytes = fs.readFileSync(source);
    } else throw new Error('invalid source: ' + rel);
    if(sha256(bytes) !== item.sha256) throw new Error('SHA256 mismatch: ' + rel);
    planned.set(rel, {bytes, sha256:item.sha256, source:item.source, ...(item.revision ? {revision:item.revision} : {})});
  }
  for(const full of filesIn(output)) {
    const rel = path.relative(output,full).split(path.sep).join('/');
    if(!planned.has(rel)) throw new Error('unexpected 未知输出文件，保留并停止: ' + rel);
    if(sha256(fs.readFileSync(full)) !== planned.get(rel).sha256) throw new Error('unexpected 输出字节变化，保留并停止: ' + rel);
  }
  for(const [rel, item] of planned) {
    const dest = path.join(output,rel);
    fs.mkdirSync(path.dirname(dest), {recursive:true});
    if(!fs.existsSync(dest)) fs.writeFileSync(dest,item.bytes,{flag:'wx'});
    if(sha256(fs.readFileSync(dest)) !== item.sha256) throw new Error('SHA256 output mismatch: ' + rel);
  }
  return [...planned].map(([rel,item]) => ({path:rel, bytes:item.bytes.length, sha256:item.sha256, source:item.source,
    ...(item.revision ? {revision:item.revision} : {})})).sort((a,b) => a.path.localeCompare(b.path));
}
if(require.main === module) {
  const root = path.resolve(__dirname,'..');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'static-site-manifest.json'),'utf8'));
  const results = build({root, manifest, output:path.join(root,'public')});
  // 证据输出至 stdout，由调用者存入内部报告；不在 public 放内部 manifest。
  process.stdout.write(JSON.stringify({schemaVersion:1, files:results}, null, 2)+'\n');
}
module.exports = {build};
