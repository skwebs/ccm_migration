import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import fs from 'node:fs/promises';
import pg from 'pg';
const {Pool}=pg;
const file=process.argv[2]||'sqlite-export.json';
if(!process.env.DATABASE_URL){console.error('Set DATABASE_URL first.');process.exit(1);}
const data=JSON.parse(await fs.readFile(file,'utf8'));
if(data.format!=='card-ledger-sqlite-export-v1'||!data.tables){console.error('Unsupported export format.');process.exit(1);}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false},max:1});
const order=['app_user','remember_tokens','app_settings','credit_cards','upi_apps','transactions','statements','bill_payments','payment_allocations'];
const targets={app_user:['id','username','password_hash','created_at'],remember_tokens:['id','token_hash','expires_at','created_at'],app_settings:['setting_key','setting_value','updated_at'],credit_cards:['id','name','bank_name','last4','credit_limit_minor','billing_day','billing_rule','due_days','active','created_at'],upi_apps:['id','name','active','created_at'],transactions:['id','card_id','particular','category','tags','amount_minor','txn_at','settlement_date','payment_method','upi_app_id','upi_app_name','notes','attachment_key','created_at','updated_at'],statements:['id','card_id','cycle_start','cycle_end','statement_date','due_date','amount_minor','bank_amount_minor','confirmed_at','is_locked','created_at'],bill_payments:['id','card_id','amount_minor','paid_at','reference','notes','created_at'],payment_allocations:['id','payment_id','statement_id','amount_minor']};
try{
  await pool.query('BEGIN');
  const existing=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1)",[order]);
  if(existing.rows.length!==order.length){throw new Error('Target schema is incomplete. Run npm run db:migrate first.');}
  const counts={};for(const t of order){const r=await pool.query(`SELECT COUNT(*)::int n FROM "${t}"`);counts[t]=r.rows[0].n;}
  if(Object.values(counts).some(n=>n!==0))throw new Error('Import refused: one or more target tables are not empty. This prevents accidental duplicate financial records. Use a fresh Neon database.');
  for(const table of order){const records=data.tables[table]||[];for(const rec of records){const cols=targets[table].filter(c=>Object.hasOwn(rec,c));const values=cols.map(c=>{if(table==='credit_cards'&&c==='active')return !!Number(rec[c]);if(table==='upi_apps'&&c==='active')return !!Number(rec[c]);if(table==='statements'&&c==='is_locked')return !!Number(rec[c]);if(table==='transactions'&&c==='attachment_key')return '';return rec[c]??null;});if(!cols.length)continue;const qcols=cols.map(c=>`"${c}"`).join(',');const slots=cols.map((_,i)=>`$${i+1}`).join(',');await pool.query(`INSERT INTO "${table}" (${qcols}) VALUES (${slots})`,values);}}
  for(const t of ['credit_cards','upi_apps','transactions','statements','bill_payments','payment_allocations','remember_tokens']){const idCol=t==='app_user'?'id':'id';await pool.query(`SELECT setval(pg_get_serial_sequence($1,$2), GREATEST(COALESCE((SELECT MAX(id) FROM "${t}"),1),1), (SELECT COUNT(*)>0 FROM "${t}"))`,[t,idCol]);}
  await pool.query('COMMIT');
  console.log('Import completed. Imported row counts:');for(const t of order)console.log(`  ${t}: ${(data.tables[t]||[]).length}`);
  const totals=await pool.query("SELECT (SELECT COUNT(*) FROM transactions)::int transaction_count, (SELECT COALESCE(SUM(amount_minor),0)::bigint FROM transactions)::text transaction_total_minor, (SELECT COUNT(*) FROM bill_payments)::int payment_count, (SELECT COALESCE(SUM(amount_minor),0)::bigint FROM bill_payments)::text payment_total_minor, (SELECT COALESCE(SUM(amount_minor),0)::bigint FROM payment_allocations)::text allocated_total_minor");
  console.log('Neon totals:',totals.rows[0]);
  if(data.warnings?.length)console.warn('\nMigration warnings:\n- '+data.warnings.join('\n- '));
  console.log('\nCompare these counts/totals with the SQLite export and test login, cycle totals, statements and payments before switching production.');
}catch(e){try{await pool.query('ROLLBACK')}catch{}console.error('Import failed:',e.message);process.exitCode=1;}finally{await pool.end();}
