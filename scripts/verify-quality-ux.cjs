const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function harness(saved=[]){const slots=new Map(saved),nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},focus(){}});return nodes.get(id);};const sandbox={console,localStorage:{getItem:k=>slots.get(k)??null,setItem:(k,v)=>slots.set(k,v),removeItem:k=>slots.delete(k)},document:{getElementById:el,querySelector:()=>null,createElement:()=>({click(){}}),body:{style:{},classList:{add(){},remove(){}}},addEventListener(){}},window:{addEventListener(){},scrollTo(){},print(){}},history:{replaceState(){}},location:{hash:''},setTimeout:()=>1,clearTimeout(){},URL:{createObjectURL:()=>'',revokeObjectURL(){}},Blob,Date,Math};const context=vm.createContext(sandbox),run=s=>vm.runInContext(s,context);for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))run(script[1]);return {run,slots,el,sandbox};}
const {run,el}=harness();
run("globalThis.detailPage=(title,body,foot)=>{globalThis.detailMarkup=title+body+foot}");
run(html.split('// BEGIN QUALITY UX\n')[1].split('// END QUALITY UX')[0]);
assert.match(run('pages.qualityReview()'),/开始复核/);
assert.ok(!run('pages.qualityReview()').includes('选择样本提交标注'));
assert.match(run('pages.online()'),/运行队列/);
run("comparison.add('X1');comparison.add('X2');compareExperiments()");
assert.match(run('detailMarkup'),/描述性比较/);
assert.match(run('detailMarkup'),/实验类型/);
assert.match(run('detailMarkup'),/创建匹配实验/);
run("QualityUX.selectCompatible('X1')");assert.equal(run('comparison.size'),1);
run("quality.experiments.push({...clone(findExp('X1')),id:'X4',name:'同标准对照'});comparison.add('X4');compareExperiments()");
assert.match(run('detailMarkup'),/公平比较/);
assert.match(run('detailMarkup'),/冻结样本/);
run("QualityUX.labelSample('D1','S1')");assert.match(run('detailMarkup'),/实际成果/);
run("mSelectActor('质量标注员');globalThis.r=QualityGovernance.submitLabel('D1','S1','通过','核对引用');QualityUX.reviewDetail(r)");
assert.match(run('detailMarkup'),/冻结成果/);
assert.ok(!run('detailMarkup').includes('提交复核'));
run("QualityGovernance.assign(r,'独立复核员');mSelectActor('独立复核员');QualityUX.reviewDetail(r)");
assert.match(run('detailMarkup'),/提交复核/);
for(const tab of ['规则','告警','回流与抽样审计']) {run(`QualityUX.onlineTab(${JSON.stringify(tab)})`);assert.match(run('pages.online()'),new RegExp(tab==='规则'?'抽样规则':tab==='告警'?'质量告警':'抽样决策'));}
for(const markup of [run('pages.qualityReview()'),run('pages.online()'),run('detailMarkup')])for(const m of markup.matchAll(/(?:onclick|onchange)="([^"]*)"/g)){const code=m[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');new vm.Script('(function(){'+code+'})');}
console.log('PASS quality UX: incompatible descriptive comparison, compatible paired comparison, sample labeling, independent review actions, online workflow tabs, handler syntax');
