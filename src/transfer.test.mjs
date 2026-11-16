import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newWorkspace,clone,validateWorkspace} from './workspace.js';
import {encryptWorkspace,decryptWorkspace} from './transfer.js';
import {parseCSV,matchCSV} from './csv.js';
test('encrypted transfer roundtrips all cafes, rejects wrong password and tampering',async()=>{
 const w=newWorkspace(),password='coffee-password-123';const envelope=await encryptWorkspace(w,password);assert.equal(envelope.cipher.includes('Капучино'),false);assert.deepEqual(await decryptWorkspace(envelope,password),w);
 await assert.rejects(decryptWorkspace(envelope,'wrong-password-123'));const broken=clone(envelope);broken.cipher='AAAA'+broken.cipher.slice(4);await assert.rejects(decryptWorkspace(broken,password));await assert.rejects(encryptWorkspace(w,'short'));
});
test('quoted CSV supports embedded delimiters, newlines and escaped quotes',()=>{
 const rows=parseCSV('\uFEFFНазвание;Количество\r\n"Латте; большой";"2,5"\r\n"Кофе ""дня""";3\r\n"Чай\nягодный";4');assert.equal(rows[0].name,'Латте; большой');assert.equal(rows[0].quantity,2.5);assert.equal(rows[1].name,'Кофе "дня"');assert.equal(rows[2].name,'Чай\nягодный');
});
test('CSV duplicates aggregate and unknown positions stay separate',()=>{
 const r=matchCSV(parseCSV('name,qty\nКапучино,2\nкапучино,3\nНет,4'),[{id:'r1',name:'Капучино'}]);assert.equal(r.matched[0].quantity,5);assert.deepEqual(r.unknown,['Нет']);
});
test('CSV malformed or empty quantities fail before any mutation',()=>{
 for(const text of ['name,qty\nКофе,','name,qty\nКофе,-1','name,qty\nКофе,NaN','name,qty\n"Кофе,2','name,qty\nКофе,2,лишнее','wrong,headers\nКофе,1'])assert.throws(()=>parseCSV(text));
});
