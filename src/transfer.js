import {validateWorkspace} from './workspace.js';
const encode=new TextEncoder(),decode=new TextDecoder();
const base64=bytes=>{let result='';for(const byte of bytes)result+=String.fromCharCode(byte);return btoa(result);};
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function derive(password,salt,usages){
  if(typeof password!=='string'||password.length<12||password.length>1000)throw Error('Пароль: от 12 до 1000 символов');
  const material=await crypto.subtle.importKey('raw',encode.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usages);
}
export async function encryptWorkspace(workspace,password){
  validateWorkspace(workspace);
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await derive(password,salt,['encrypt']);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encode.encode('coffee-control:5')},key,encode.encode(JSON.stringify(workspace)));
  return {format:'coffee-control-encrypted',version:1,salt:base64(salt),iv:base64(iv),cipher:base64(new Uint8Array(cipher))};
}
export async function decryptWorkspace(envelope,password){
  if(envelope?.format!=='coffee-control-encrypted'||envelope.version!==1||typeof envelope.cipher!=='string'||envelope.cipher.length>2e7||typeof envelope.salt!=='string'||envelope.salt.length>30||typeof envelope.iv!=='string'||envelope.iv.length>24)throw Error('Неверный формат зашифрованной копии');
  try{
    const salt=bytes(envelope.salt),iv=bytes(envelope.iv);if(salt.length!==16||iv.length!==12)throw Error();
    const key=await derive(password,salt,['decrypt']);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encode.encode('coffee-control:5')},key,bytes(envelope.cipher));
    return validateWorkspace(JSON.parse(decode.decode(plain)));
  }catch{throw Error('Не удалось открыть: неверный пароль или повреждённый файл');}
}
