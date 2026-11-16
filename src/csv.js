export function parseCSV(text){
  if(typeof text!=='string'||text.length>5e6)throw Error('CSV должен быть меньше 5 МБ');
  text=text.replace(/^\uFEFF/,'');
  // Detect delimiter only outside quoted cells in the first record.
  let quoted=false,semi=0,comma=0;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}if(!quoted){if(c==='\n'||c==='\r')break;if(c===';')semi++;if(c===',')comma++;}}
  const delimiter=semi>comma?';':',',rows=[];let row=[],cell='',inside=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inside){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{inside=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'){if(cell.trim()||closed)throw Error('Некорректные кавычки CSV');inside=true;cell='';continue;}
    if(c===delimiter){row.push(cell.trim());cell='';closed=false;continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';closed=false;continue;}
    if(closed&&c.trim())throw Error('Лишний текст после кавычек CSV');cell+=c;
  }
  if(inside)throw Error('Незакрытая кавычка CSV');row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  if(rows.length<2)throw Error('В CSV нужны заголовок и строки продаж');
  if(rows.length>50000)throw Error('Слишком много строк CSV');
  const header=rows.shift().map(s=>s.toLocaleLowerCase('ru'));
  const name=header.findIndex(s=>['название','наименование','name','товар','блюдо'].includes(s));
  const quantity=header.findIndex(s=>['количество','qty','quantity','продажи'].includes(s));
  if(name<0||quantity<0)throw Error('Нужны колонки «Название» и «Количество»');
  return rows.map((r,i)=>{const qty=Number((r[quantity]||'').replace(',','.'));if(r.length!==header.length||!r[name]||!r[quantity]||!Number.isFinite(qty)||qty<0)throw Error('Проверь строку '+(i+2));return {name:r[name],quantity:qty,row:i+2};});
}
export function matchCSV(rows,recipes){
  const totals=new Map(),unknown=[];
  for(const row of rows){const recipe=recipes.find(r=>r.name.trim().toLocaleLowerCase('ru')===row.name.trim().toLocaleLowerCase('ru'));if(!recipe){unknown.push(row.name);continue;}const previous=totals.get(recipe.id)||{recipeId:recipe.id,name:recipe.name,quantity:0};previous.quantity+=row.quantity;totals.set(recipe.id,previous);}
  return {matched:[...totals.values()],unknown};
}
