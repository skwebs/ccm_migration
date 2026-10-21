import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const { Pool } = pg;
if(!process.env.DATABASE_URL){console.error('Set DATABASE_URL in .env.local or the environment.');process.exit(1);}
const here=path.dirname(fileURLToPath(import.meta.url));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}});
try{
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const files=(await fs.readdir(path.join(here,'..','db','migrations'))).filter(f=>/^\d+.*\.sql$/.test(f)).sort();
  for(const file of files){const version=file.split('_')[0];if((await pool.query('SELECT 1 FROM schema_migrations WHERE version=$1',[version])).rowCount)continue;const sql=await fs.readFile(path.join(here,'..','db','migrations',file),'utf8');const client=await pool.connect();try{await client.query('BEGIN');await client.query(sql);await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);await client.query('COMMIT');console.log(`Applied ${file}`);}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
  console.log('Database migrations complete.');
}catch(e){console.error('Migration failed:',e.message);process.exitCode=1;}finally{await pool.end();}
