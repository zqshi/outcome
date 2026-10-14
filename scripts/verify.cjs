const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements=new Map(),timers=new Map(),storage=new Map();let next=0;
const el=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',classList:{remove(){},toggle(){}},focus(){},setSelectionRange(){}});return elements.get(id);};
const ctx=vm.createContext({console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:el,body:{style:{}},querySelector:()=>null,addEventListener(){},createElement:()=>({click(){}})},window:{addEventListener(){},scrollTo(){}},history:{replaceState(){}},location:{hash:''},setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),URL:{createObjectURL:()=>'',revokeObjectURL(){}},Blob,Set,Date,Math});
// Legacy engine contract checks; installed governance has its own stricter flow suite.
vm.runInContext(source.split('/* Load after the host')[0]+'\nrender();',ctx);const run=code=>vm.runInContext(code,ctx);const set=(id,v)=>el(id).value=v;
assert.match(el('content').innerHTML,/生产力/);
assert.equal(run('quality.sets.length'),3);
assert.ok(run('quality.sets.every(d=>d.samples.length>=5&&d.samples.length<=8&&d.versions.length===1)'));
assert.equal(run('new Set(quality.evaluators.map(e=>e.type)).size'),4);
assert.equal(run("quality.experiments.filter(e=>e.state==='已完成').length"),2);
assert.equal(run("quality.experiments.filter(e=>e.state==='失败').length"),1);
assert.ok(run("quality.sets.every(d=>d.samples.every(s=>s.source.includes('人工构造')))"));
run("experimentDetail('X2')");assert.match(el('overlay').innerHTML,/混淆矩阵/);assert.match(el('overlay').innerHTML,/Wilson/);assert.match(el('overlay').innerHTML,/运行时间线/);
const cal=run("summarize(findExp('X2'))");assert.equal(cal.negative,3);assert.equal(cal.positive,3);assert.equal(cal.falseAcceptRate,cal.falseAccept/3);assert.equal(cal.falseRejectRate,cal.falseReject/3);assert.ok(cal.falseAcceptCI[0]>=0&&cal.falseAcceptCI[1]<=1);
assert.equal(run('wilson(0,0)'),null);assert.ok(run('wilson(0,3)[1]')>0);
run("openSet('D1');sampleSearch='不存在';openSet('D1')");assert.match(el('overlay').innerHTML,/没有匹配样本/);
run("sampleSearch='';sampleVersion='1';openSet('D1')");assert.match(el('overlay').innerHTML,/只读发布快照/);assert.ok(!el('overlay').innerHTML.includes('deleteSample('));
run("sampleVersion='草稿';sampleBucket='校准';openSet('D1')");assert.match(el('overlay').innerHTML,/没有匹配样本/);run("sampleBucket='全部'");
run("evalType='模型';evalSearch='完整';navigate('evaluators')");assert.ok(el('content').innerHTML.includes('完整性模拟模型'));assert.ok(!el('content').innerHTML.includes('<h2>证据完整性规则'));
run("editEvaluator('E3')");assert.ok(!el('overlay').innerHTML.includes('id="e-keyword"'));assert.ok(!el('overlay').innerHTML.includes('id="e-threshold"'));
set('e-name','只需标签');set('e-type','人工参考');set('e-scope','全部');set('e-keyword','');set('e-threshold','');set('e-model','');set('e-prompt','');run("saveEvaluator('E3',true)");assert.equal(run("findEval('E3').versions.length"),2,'不校验无关字段');
run("editEvaluator('E4')");el('e-members').selectedOptions=[{value:'E1:1'}];set('e-name','冻结组合');set('e-type','组合');set('e-scope','全部');set('e-threshold','0.6');run("saveEvaluator('E4',true)");
const frozen=run("JSON.stringify(findEval('E4').versions[1])");run("findEval('E1').versions[0].config.keyword='永不匹配'");assert.equal(run("JSON.stringify(findEval('E4').versions[1])"),frozen);assert.equal(run("scoreSample(findSet('D1').samples[0],findEval('E4').versions[1]).score"),1);
run("quality=seedQuality();quality.experiments.forEach(e=>{if(e.state==='已完成')e.summary=summarize(e)});comparison.clear();comparison.add('X1');comparison.add('X2');compareExperiments()");assert.ok(!el('overlay').innerHTML.includes('完成实验比较'));assert.match(el('toast').innerHTML,/同类型/);
run("quality.experiments.push({...clone(findExp('X1')),id:'X4',name:'同标准候选对照'});comparison.delete('X2');comparison.add('X4');compareExperiments()");assert.match(el('overlay').innerHTML,/完成实验比较/);
run("findExp('X4').evaluator.config.threshold=0.9");assert.notEqual(run("comparisonKey(findExp('X1'))"),run("comparisonKey(findExp('X4'))"));
run("closeModal();compareExperiments()");assert.match(el('toast').innerHTML,/同类型/);assert.equal(el('overlay').innerHTML,'');
run("quality=seedQuality();const x=clone(findExp('X2'));x.rows=x.rows.filter(r=>r.reference==='通过');const a=summarize(x);if(a.falseAcceptRate!==null||a.falseAcceptCI!==null)throw Error('零分母处理失败');");
const experimentFrozen=run("JSON.stringify(findExp('X1').evaluator)");run("findEval('E1').versions[0].config.threshold=0.99");assert.equal(run("JSON.stringify(findExp('X1').evaluator)"),experimentFrozen,'实验评估标准冻结');
run("navigate('overview')");assert.match(el('content').innerHTML,/实时本地摘要/);assert.ok(!el('content').innerHTML.includes('18.4%'));

// Existing legacy fixture: preserve all prior behavioral regression checks.
run("quality={schema:1,sets:[{id:'D1',name:'旧评测集',description:'旧存储',samples:[{id:'S1',input:'经营报告',expected:'证据',actual:'附证据',reference:'通过',bucket:'方案对照',source:'人工'},{id:'S2',input:'反馈分类',expected:'证据',actual:'分类完成',reference:'不通过',bucket:'校准',source:'人工'},{id:'S3',input:'留出',expected:'完整',actual:'完整',reference:'通过',bucket:'保留测试',source:'人工'}],versions:[]}],evaluators:[{id:'E1',name:'旧规则',type:'规则',scope:'全部',config:{threshold:0.6,keyword:'证据',model:'模拟',prompt:'依据预期',members:[]},versions:[]}],experiments:[]};activeSet='D1'");

run("activeSet='D1';publishSet()");const snapshot=run('JSON.stringify(findSet(activeSet).versions[0])');
run("findSet(activeSet).samples[0].actual='修改草稿';deleteSample('S3')");assert.equal(run('JSON.stringify(findSet(activeSet).versions[0])'),snapshot,'发布版本不受草稿编辑删除影响');
const before=run('findSet(activeSet).samples.length');set('import-json',JSON.stringify([{input:'ok',expected:'ok',actual:'ok',source:'ok',reference:'通过',bucket:'方案对照'},{input:''}]));run('importSamples()');assert.equal(run('findSet(activeSet).samples.length'),before,'混合非法导入必须原子拒绝');
set('import-json',JSON.stringify([{input:'<img src=x onerror=alert(1)>',expected:'结果',actual:'证据',source:'人工',reference:'通过',bucket:'方案对照'}]));run('importSamples()');assert.equal(run('findSet(activeSet).samples.length'),before+1);assert.ok(!el('overlay').innerHTML.includes('<img src=x'));assert.ok(el('overlay').innerHTML.includes('&lt;img'));
run("selected.add('TSK-1028');batchSamples()");set('target-set','D1');set('task-bucket','方案对照');run('commitTasks()');assert.ok(run("findSet('D1').samples.some(s=>s.source.startsWith('TSK-1028 / Attempt-'))"));const taskSnapshot=run('JSON.stringify(tasks)');run("selected.add('TSK-1028');commitTasks()");assert.equal(run('JSON.stringify(tasks)'),taskSnapshot,'不得改变任务业务状态');run("navigate('review')");assert.match(el('content').innerHTML,/不代替用户通过或驳回任务/);
run("quality.evaluators[0].versions.push({...clone(quality.evaluators[0]),number:1});");
set('x-name','测试方案对照');set('x-kind','方案对照');set('x-data','D1:1');set('x-eval','E1:1');set('x-bucket','方案对照');set('x-base','v1');set('x-candidate','v2');set('x-fail','本次运行失败');run('saveExperiment()');assert.equal(run('quality.experiments.length'),1);const id=run('quality.experiments[0].id');run(`transitionExperiment('${id}','运行中');finishExperiment('${id}')`);assert.equal(run('quality.experiments[0].state'),'失败');run(`retryExperiment('${id}');transitionExperiment('${id}','运行中');finishExperiment('${id}')`);assert.equal(run('quality.experiments[0].state'),'已完成');assert.equal(run('quality.experiments[0].attempt'),2);assert.equal(run('quality.experiments[0].summary.samples'),run('quality.experiments[0].rows.length'));assert.equal(run('quality.experiments[0].summary.baselineCost'),run('quality.experiments[0].rows.reduce((a,r)=>a+r.baseline.cost,0)'));
set('x-name','校准');set('x-kind','判定校准');set('x-bucket','方案对照');run('saveExperiment()');assert.equal(run('quality.experiments.length'),1,'校准禁止使用对照桶');set('x-bucket','校准');set('x-fail','正常');run('saveExperiment()');const calId=run('quality.experiments[1].id');run(`transitionExperiment('${calId}','运行中');finishExperiment('${calId}')`);assert.equal(run('quality.experiments[1].summary.falseReject'),0);assert.equal(run('quality.experiments[1].summary.agreement'),1);
set('x-name','取消测试');run('saveExperiment()');const cancelId=run('quality.experiments[2].id');run(`transitionExperiment('${cancelId}','已取消');transitionExperiment('${cancelId}','运行中')`);assert.equal(run('quality.experiments[2].state'),'已取消');
assert.equal(run("scoreSample(quality.sets[0].samples[0],{...quality.evaluators[0],scope:'不匹配'}).score"),null);assert.equal(run("scoreSample(quality.sets[0].samples[0],{...quality.evaluators[0],type:'模型'}).score"),run("scoreSample(quality.sets[0].samples[0],{...quality.evaluators[0],type:'模型'}).score"));
run("quality.evaluators.push({id:'E2',name:'组合',type:'组合',scope:'全部',config:{threshold:0.5,members:['E1:1']},versions:[]})");assert.equal(run("scoreSample(quality.sets[0].versions[0].samples[0],findEval('E2')).score"),1);
run('saveQuality()');const serialized=storage.get('task-quality-v1');assert.ok(JSON.parse(serialized).experiments.length===3);run("quality=validateStore(JSON.parse(localStorage.getItem(STORE)))");assert.equal(run('quality.experiments[0].state'),'已完成');

assert.equal(run("findSet('D1').samples.find(s=>s.source.startsWith('TSK-1028')).reference"),'待标注');
run("quality.evaluators[0].versions.push({...clone(quality.evaluators[0]),type:'人工参考',number:2})");set('x-eval','E1:2');set('x-name','不得自证');run('saveExperiment()');assert.equal(run('quality.experiments.length'),3);
set('x-eval','E1:1');set('x-name','自动状态机');run('saveExperiment()');const autoId=run('quality.experiments[3].id');const tick=()=>{const id=run(`runTimers.get('${autoId}')`),fn=timers.get(id);timers.delete(id);fn();};tick();assert.equal(run('quality.experiments[3].state'),'运行中');tick();assert.equal(run('quality.experiments[3].state'),'已完成');
const old=run('JSON.stringify(quality)');ctx.localStorage.setItem=()=>{throw Error('quota');};run("change(()=>quality.sets[0].name='不能保存')");assert.equal(run('JSON.stringify(quality)'),old,'保存失败应回滚本地模型');ctx.localStorage.setItem=(k,v)=>storage.set(k,v);
for(const page of ['datasets','evaluators','experiments','tasks','settings','review']){run(`navigate('${page}')`);assert.ok(el('content').innerHTML.length>100);}
assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/.test(html),'不得依赖在线资源');

const reboot=raw=>{const slots=new Map(raw===null?[]:[[STORE_KEY,raw]]),nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{remove(){},toggle(){}}});return nodes.get(id);};const sandbox={...ctx,localStorage:{getItem:k=>slots.get(k)||null,setItem:(k,v)=>slots.set(k,v)},document:{...ctx.document,getElementById:get},setTimeout:()=>0};const c=vm.createContext(sandbox);vm.runInContext(source,c);return {c,slots,get};};
const STORE_KEY='task-quality-v1';
const legacy=JSON.stringify({schema:1,sets:[],evaluators:[],experiments:[]});const oldBoot=reboot(legacy);assert.equal(vm.runInContext('quality.sets.length',oldBoot.c),0,'旧数据不补样例、不覆盖');assert.equal(oldBoot.slots.get(STORE_KEY),legacy);
const damaged=reboot('{bad');vm.runInContext('saveQuality()',damaged.c);assert.equal(damaged.slots.get(STORE_KEY),'{bad','损坏数据也不覆盖');
const restart=reboot(serialized);assert.equal(vm.runInContext('quality.experiments.length',restart.c),3);assert.equal(vm.runInContext("quality.experiments[0].state",restart.c),'已完成');
const fresh=reboot(null);vm.runInContext('saveQuality()',fresh.c);const freshAgain=reboot(fresh.slots.get(STORE_KEY));assert.equal(vm.runInContext('quality.sets.length',freshAgain.c),3);assert.equal(vm.runInContext("quality.experiments[0].summary.baselineCost",freshAgain.c),vm.runInContext("quality.experiments[0].rows.reduce((n,r)=>n+r.baseline.cost,0)",freshAgain.c));
console.log('PASS: 完整预置数据、样本搜索用途版本、动态配置与无关字段、组合冻结、完成实验比较、混淆矩阵及Wilson区间、 发布快照隔离、原子导入、XSS 转义、任务真实导入与业务只读、实验失败重试取消、校准桶隔离、逐样本汇总、模型模拟、组合、持久化和六个页面渲染');
