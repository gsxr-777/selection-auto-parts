async function upsert(client,table,rows){
 if(!rows.length)return;
 const columns=Object.keys(rows[0]),quote=name=>'"'+name+'"';
 for(let offset=0;offset<rows.length;offset+=500){
  await client.query(`INSERT INTO ${quote(table)} (${columns.map(quote)}) SELECT ${columns.map(quote)} FROM jsonb_populate_recordset(NULL::${quote(table)}, $1::jsonb) ON CONFLICT (id) DO UPDATE SET ${columns.filter(c=>c!=='id').map(c=>`${quote(c)}=EXCLUDED.${quote(c)}`).join(',')} WHERE (${columns.map(c=>`${quote(table)}.${quote(c)}`).join(',')}) IS DISTINCT FROM (${columns.map(c=>`EXCLUDED.${quote(c)}`).join(',')})`,[JSON.stringify(rows.slice(offset,offset+500))]);
 }
 console.log(table,rows.length);
}
module.exports={upsert};
