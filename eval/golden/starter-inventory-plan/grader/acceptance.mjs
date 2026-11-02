export default async function acceptance({probe,state}) {
 const checks=[];
 const run=(id,source,expected)=>{const r=probe(source);const pass=r.ok&&JSON.stringify(r.value)===JSON.stringify(expected);checks.push({id,pass,detail:pass?"independent cases passed":r.ok?JSON.stringify(r.value):r.error});};
 run("catalog-validation","import {createCatalog} from \"./src/catalog.mjs\";const code=rows=>{try{createCatalog(rows);return \"ok\"}catch(e){return e.code??\"error\"}};const source=[{sku:\"z\",quantity:3,reorderAt:1},{sku:\"a\",quantity:0,reorderAt:0}];const c=createCatalog(source);source[0].quantity=999;console.log(JSON.stringify([c,[ [{sku:\"x\",quantity:-1,reorderAt:0}], [{sku:\"x\",quantity:0.5,reorderAt:0}], [{sku:\"x\",quantity:1,reorderAt:0},{sku:\"x\",quantity:2,reorderAt:0}] ].map(code)]));",[[{"sku": "a", "quantity": 0, "reorderAt": 0}, {"sku": "z", "quantity": 3, "reorderAt": 1}], ["invalid", "invalid", "invalid"]]);
 run("atomic-movements","import {applyMovements} from \"./src/movements.mjs\";const c=[{sku:\"x\",quantity:2,reorderAt:1}];const code=m=>{try{applyMovements(c,m);return \"ok\"}catch(e){return e.code??\"error\"}};console.log(JSON.stringify([applyMovements(c,[{sku:\"x\",delta:-1},{sku:\"x\",delta:3}]),code([{sku:\"x\",delta:1},{sku:\"x\",delta:-4}]),code([{sku:\"missing\",delta:1}]),code([{sku:\"x\",delta:0.5}]),c]));",[[{"sku": "x", "quantity": 4, "reorderAt": 1}], "invalid", "not-found", "invalid", [{"sku": "x", "quantity": 2, "reorderAt": 1}]]);
 run("reorder-journey","import {createCatalog} from \"./src/catalog.mjs\";import {applyMovements} from \"./src/movements.mjs\";import {reorderReport} from \"./src/report.mjs\";const c=createCatalog([{sku:\"b\",quantity:2,reorderAt:2},{sku:\"a\",quantity:5,reorderAt:1}]);const moved=applyMovements(c,[{sku:\"a\",delta:-4}]);console.log(JSON.stringify([reorderReport(moved),reorderReport(c)]));",[[{"sku": "a", "quantity": 1, "needed": 1}, {"sku": "b", "quantity": 2, "needed": 1}], [{"sku": "b", "quantity": 2, "needed": 1}]]);
 const plan=state?.project?.intent?.plan??[];
 const stages=[/catalog/i,/movement/i,/report/i].map(pattern=>plan.filter(p=>pattern.test(p.outcome)));
 const ids=new Set(plan.map(p=>p.id));
 const reaches=(from,target,seen=new Set())=>{if(from===target)return true;if(seen.has(from))return false;seen.add(from);return (plan.find(p=>p.id===from)?.dependsOn??[]).some(id=>reaches(id,target,seen));};
 const visiting=new Set(),visited=new Set();
 const acyclic=id=>{if(visiting.has(id))return false;if(visited.has(id))return true;visiting.add(id);if(!(plan.find(p=>p.id===id)?.dependsOn??[]).every(acyclic))return false;visiting.delete(id);visited.add(id);return true;};
 const distinct=stages.every(s=>s.length===1)&&new Set(stages.map(s=>s[0]?.id)).size===3;
 const dependencies=distinct&&reaches(stages[1][0].id,stages[0][0].id)&&reaches(stages[2][0].id,stages[1][0].id);
 const pass=plan.length>=3&&distinct&&dependencies&&ids.size===plan.length&&plan.every(p=>p.state==='done'&&p.check.trim()&&p.dependsOn.every(id=>ids.has(id)))&&plan.every(p=>acyclic(p.id));
 checks.push({id:'plan-decomposed',pass,detail:pass?'three distinct completed increments with valid dependency order':'catalog, movements and report need distinct done plan items, checks, and ordered acyclic dependencies'});

 return checks;
}
