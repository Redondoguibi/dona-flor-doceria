/* Contrato único: copiado pelo build para site e editor. */
(function(root){
 'use strict';
 const zone='America/Sao_Paulo';
 function today(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');}
 function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s&&s>='1900-01-01'&&s<='2199-12-31';}
 function price(v){if(v===null||v===undefined||v==='')return null;if(!/^\d+(?:[.,]\d{1,2})?$/.test(String(v).trim()))return NaN;return Number(String(v).trim().replace(',','.'));}
 function validate(raw,{draft=false}={}){
  const errors=[],warnings=[];const fail=m=>errors.push(m);
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.dias))return {errors:['Estrutura: informe um objeto com a lista dias.'],warnings};
  if(!draft&&(!validDate(raw.atualizado_em)||raw.atualizado_em>today()))fail('atualizado_em: data válida de confirmação, sem estar no futuro, é obrigatória.');
  if(raw.historico!==undefined&&!Array.isArray(raw.historico))fail('historico deve ser uma lista.');
  if(raw.pendencias!==undefined&&!Array.isArray(raw.pendencias))fail('pendencias deve ser uma lista.');
  if(raw.versao!==undefined&&raw.versao!==null&&(typeof raw.versao!=='string'||raw.versao.length>100))fail('versao deve ser texto com até 100 caracteres.');
  const all=[...raw.dias,...(Array.isArray(raw.historico)?raw.historico:[])];
  if(all.length>3660)fail('Limite de 3.660 dias excedido.');
  const dates=new Set();
  for(const [i,d] of all.entries()){
   const at='Dia '+(i+1)+' ('+(d?.data||'sem data')+')';
   if(!d||!validDate(d.data)){fail(at+': data inválida.');continue;}
   if(dates.has(d.data))fail(at+': data duplicada.');dates.add(d.data);
   if(d.titulo!==undefined&&(typeof d.titulo!=='string'||d.titulo.length>70))fail(at+': título inválido (máximo 70 caracteres).');
   if(d.aviso!==undefined&&(typeof d.aviso!=='string'||d.aviso.length>200))fail(at+': aviso inválido (máximo 200 caracteres).');
   if(!Array.isArray(d.pratos)||d.pratos.length>40){fail(at+': lista de pratos inválida (máximo 40).');continue;}
   if(((typeof d.aviso==='string'&&d.aviso.trim())||d._fechado)&&d.pratos.length&&!draft)fail(at+': fechamento e pratos não podem coexistir.');
   if(d._fechado&&!(typeof d.aviso==='string'&&d.aviso.trim())&&!draft)fail(at+': informe o aviso de fechamento.');
   const names=new Set();
   for(const [j,m] of d.pratos.entries()){
    const key=at+', prato '+(j+1);if(!m||typeof m.nome!=='string'||(!draft&&!m.nome.trim())||m.nome.length>180){fail(key+': nome inválido.');continue;}
    const name=m.nome.trim().toLocaleLowerCase('pt-BR');if(names.has(name)&&!draft)fail(key+': nome repetido.');names.add(name);
    const n=price(m.preco);if(!draft&&(Number.isNaN(n)||n!==null&&(n<=0||n>9999)))fail(key+': preço inválido (0,01 a 9.999,00).');
    if(n===null)warnings.push(key+': preço ausente; será exibido “Consulte o preço”.');
   }
  }
  const active=raw.dias.filter(d=>validDate(d?.data)&&d.data>=today()&&(d.pratos?.length||(typeof d.aviso==='string'&&d.aviso.trim())));
  const visible=active.filter(d=>d.data<=new Date(Date.parse(today()+'T12:00Z')+6*86400000).toISOString().slice(0,10));
  if(!visible.length&&active.length)warnings.push('Há planejamento futuro, mas nenhum cardápio para os próximos sete dias.');
  if(!active.length)warnings.push('Programação vencida ou ainda não cadastrada: nenhum dia atual ou futuro.');
  else{const last=active.map(d=>d.data).sort().at(-1);if((new Date(last+'T12:00Z')-new Date(today()+'T12:00Z'))/86400000<=2)warnings.push('Programação vence em até dois dias ('+last+').');}
  if(active.some(d=>(new Date(d.data+'T12:00Z')-new Date(today()+'T12:00Z'))/86400000>21))warnings.push('Há planejamento além de 21 dias. Confira cada data; a exportação preservará esses dias.');
  if(raw.pendencias?.length)warnings.push(raw.pendencias.length+' dia(s) com data inválida preservados em pendencias, fora da programação pública.');
  return {errors,warnings};
 }
 function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
 function identity(v){return stable({atualizado_em:v?.atualizado_em||null,dias:[...(v?.dias||[]),...(v?.historico||[])].sort((a,b)=>a.data.localeCompare(b.data)),pendencias:v?.pendencias||[]});}
 const api={today,validDate,price,validate,stable,identity,zone};if(typeof module!=='undefined')module.exports=api;else root.MenuCore=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
