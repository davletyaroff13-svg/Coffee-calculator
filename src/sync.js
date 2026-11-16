import {id,validateWorkspace} from './workspace.js';
import {encryptWorkspace,decryptWorkspace} from './transfer.js';
export const SYNC_KEY='coffee-control-sync-v1';
export function serverOrigin(value){
 const url=new URL(value);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Для сервера нужен HTTPS');
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Укажи только адрес сервера без пути, ключей и параметров');return url.origin;
}
export function validatePairing(pairing){
 if(pairing?.format!=='coffee-control-pairing'||!/^[a-f0-9-]{36}$/.test(pairing.spaceId)||typeof pairing.secret!=='string'||!/^[a-f0-9]{64}$/.test(pairing.secret))throw Error('Некорректный код сопряжения');
 return {format:pairing.format,origin:serverOrigin(pairing.origin),spaceId:pairing.spaceId,secret:pairing.secret};
}
async function bearer(pairing){const value=new TextEncoder().encode('coffee-control-sync:'+pairing.secret);const hash=await crypto.subtle.digest('SHA-256',value);return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function request(pairing,path,options={},fetcher=fetch){
 const p=validatePairing(pairing),token=await bearer(p);let response;
 try{response=await fetcher(p.origin+'/v1/spaces/'+p.spaceId+path,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...options.headers},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});}catch{throw Error('Сервер недоступен. Локальные данные сохранены.');}
 let result;try{result=await response.json();}catch{throw Error('Неверный ответ сервера');}
 if(!response.ok)throw Object.assign(Error(result.error||'Ошибка сервера'),{status:response.status});return result;
}
export async function createRemote(workspace,origin,setupToken,fetcher=fetch){
 const secret=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const pairing={format:'coffee-control-pairing',origin:serverOrigin(origin),spaceId:id(),secret};
 const envelope=await encryptWorkspace(workspace,secret),result=await request(pairing,'',{method:'PUT',headers:{'If-None-Match':'*','X-Setup-Token':setupToken},body:JSON.stringify({envelope})},fetcher);
 return {pairing,remoteRevision:result.revision,localRevision:workspace.revision,workspaceId:workspace.id};
}
export async function readRemote(config,fetcher=fetch){const result=await request(config.pairing,'',{},fetcher);if(!Number.isSafeInteger(result.revision)||result.revision<1)throw Error('Неверная версия сервера');return result;}
export async function openRemote(config,result){return validateWorkspace(await decryptWorkspace(result.envelope,config.pairing.secret));}
export async function pushRemote(config,workspace,fetcher=fetch){const envelope=await encryptWorkspace(workspace,config.pairing.secret);return request(config.pairing,'',{method:'PUT',headers:{'If-Match':'"'+config.remoteRevision+'"'},body:JSON.stringify({envelope})},fetcher);}
export function syncDecision(config,workspace,remoteRevision){
 const local=workspace.revision!==config.localRevision||workspace.id!==config.workspaceId,remote=remoteRevision!==config.remoteRevision;
 return local&&remote?'conflict':remote?'pull':local?'push':'idle';
}
export async function backendStatus(config,fetcher=fetch){const response=await fetcher(serverOrigin(config.pairing.origin)+'/v1/status',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Не удалось проверить сервер');return response.json();}
export async function askAI(config,prompt,fetcher=fetch){return request(config.pairing,'/assist',{method:'POST',body:JSON.stringify({prompt})},fetcher);}

export class SyncController {
 constructor({store,storage,onChange=()=>{},onStatus=()=>{},fetcher=fetch}){
  Object.assign(this,{store,storage,onChange,onStatus,fetcher,config:null,running:false,status:'Не подключено'});
  try{const value=JSON.parse(storage.getItem(SYNC_KEY));if(value){validatePairing(value.pairing);if(!Number.isSafeInteger(value.remoteRevision)||!Number.isSafeInteger(value.localRevision))throw Error();this.config=value;this.status=value.paused?'Приостановлено':'Подключено';}}catch{this.status='Не удалось прочитать настройки синхронизации';}
 }
 reload(){const value=JSON.parse(this.storage.getItem(SYNC_KEY));if(value)validatePairing(value.pairing);this.config=value;this.setStatus(value?(value.paused?'Приостановлено':'Подключено'):'Отключено');}
 save(config){this.storage.setItem(SYNC_KEY,JSON.stringify(config));this.config=config;}
 setStatus(text){this.status=text;this.onStatus(text);}
 async create(origin,setupToken){const config=await createRemote(this.store.get(),origin,setupToken,this.fetcher);this.save(config);this.setStatus('Подключено: зашифрованная копия создана');return config;}
 async preview(pairing){const config={pairing:validatePairing(pairing)},remote=await readRemote(config,this.fetcher);return {value:await openRemote(config,remote),syncCandidate:{...config,remoteRevision:remote.revision}};}
 adopt(candidate){const current=this.store.get();this.save({...candidate,paused:false,localRevision:current.revision,workspaceId:current.id});this.setStatus('Синхронизация подключена');}
 pause(reason){if(this.config){this.config={...this.config,paused:true};try{this.storage.setItem(SYNC_KEY,JSON.stringify(this.config));}catch{reason+=' Настройка паузы сохранена только до закрытия страницы.';}}this.setStatus(reason);}
 disconnect(){this.storage.removeItem(SYNC_KEY);this.config=null;this.setStatus('Отключено. Локальные данные сохранены.');}
 async tick(){
  if(this.running||!this.config||this.config.paused)return;
  this.running=true;const config=this.config,snapshot=this.store.get();
  try{
   const remote=await readRemote(config,this.fetcher);if(this.config!==config)return;
   const decision=syncDecision(config,snapshot,remote.revision);
   if(decision==='conflict'){this.pause('Конфликт: оба устройства изменили данные. Открой удалённую копию для сравнения. Автозапись остановлена.');return;}
   if(decision==='pull'){
    const value=await openRemote(config,remote);if(this.config!==config)return;
    const current=this.store.get();if(current.id!==snapshot.id||current.revision!==snapshot.revision){this.pause('Данные изменились во время синхронизации. Автозапись остановлена.');return;}
    const next=this.store.replace(value);this.adopt({...config,remoteRevision:remote.revision});this.onChange(next);
   }else if(decision==='push'){
    const next=await pushRemote(config,snapshot,this.fetcher);if(this.config!==config)return;
    this.save({...config,remoteRevision:next.revision,localRevision:snapshot.revision,workspaceId:snapshot.id});
   }
   this.setStatus('Синхронизировано '+new Date().toLocaleTimeString('ru-RU'));
  }catch(error){if(this.config===config){if(error.status===409)this.pause('Конфликт версий. Автозапись остановлена: открой удалённую копию.');else this.setStatus(error.message);}}
  finally{this.running=false;}
 }
}
