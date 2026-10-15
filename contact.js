'use strict';
(async()=>{
 const form=document.getElementById('contact-form'),section=document.getElementById('mensagem'),privacy=document.getElementById('contact-privacy'),status=document.getElementById('contact-status'),submit=document.getElementById('contact-submit'),config=window.DONA_FLOR_CONTACT;
 if(!form&&!privacy)return;
 // Only offer messaging when the configured backend confirms it is ready.
 try{
  const url=new URL(config.endpoint);if(url.protocol!=='https:'||url.username||url.password||!config.siteKey)return;
  const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!r.ok||(await r.json()).available!==true)return;
 }catch{return;}
 if(privacy)privacy.hidden=false;
 if(!form)return;
 section.hidden=false;
 const channels=document.querySelector('#contato .closing-actions');
 if(channels){const link=document.createElement('a');link.href='#mensagem';link.className='btn btn-outline';link.textContent='Enviar mensagem';channels.append(link);}
 let widget=null,sending=false;
 status.textContent='Carregando a verificação de segurança…';
 window.donaFlorContactReady=()=>{
  widget=window.turnstile.render('#contact-challenge',{sitekey:config.siteKey,action:'contact',callback:()=>{submit.disabled=false;status.textContent='Pronto para enviar.';},'expired-callback':()=>{submit.disabled=true;status.textContent='A verificação expirou. Confirme novamente.';},'error-callback':()=>{submit.disabled=true;status.textContent='Não foi possível verificar a conexão. Tente novamente ou ligue para a unidade.';}});
 };
 const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=donaFlorContactReady&render=explicit';script.async=true;script.onerror=()=>{submit.disabled=true;status.textContent='Verificação indisponível. Utilize os telefones das unidades.';};document.head.append(script);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(sending||!form.reportValidity())return;
  const fields=new FormData(form),token=window.turnstile.getResponse(widget);if(!token)return;
  sending=true;submit.disabled=true;status.textContent='Enviando…';
  try{
   const body=Object.fromEntries(fields);body.consentimento=fields.get('consentimento')==='on';body.token=token;
   const r=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const receipt=await r.json();
   if(!r.ok||receipt.accepted!==true||!receipt.id)throw Error(receipt.error||'O servidor não confirmou o envio.');
   status.textContent='Mensagem encaminhada. Protocolo: '+receipt.id+'.';form.reset();
  }catch(e){status.textContent='Envio não confirmado: '+e.message+' Seu texto foi preservado.';}
  finally{sending=false;submit.disabled=true;window.turnstile.reset(widget);}
 });
})();
