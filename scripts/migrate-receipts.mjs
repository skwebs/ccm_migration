import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
const {Pool}=pg;
const [exportFile='sqlite-export.json',storageRoot]=process.argv.slice(2);
if(!process.env.DATABASE_URL||!process.env.R2_ACCOUNT_ID||!process.env.R2_ACCESS_KEY_ID||!process.env.R2_SECRET_ACCESS_KEY||!process.env.R2_BUCKET_NAME){console.error('Set DATABASE_URL and the private R2 credentials in your environment.');process.exit(1);}
if(!storageRoot){console.error('Usage: node scripts/migrate-receipts.mjs sqlite-export.json PATH_TO_LEGACY_STORAGE_DIRECTORY');process.exit(2);}
const data=JSON.parse(await fs.readFile(exportFile,'utf8'));const txns=data.tables?.transactions||[];const needing=txns.filter(t=>t.attachment_path);if(!needing.length){console.log('No legacy receipts were found in the export.');process.exit(0);}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}});
const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT||`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
const mimeByExt={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
try{
  const missing=[];let migrated=0;
  for(const t of needing){const rel=String(t.attachment_path).replace(/^[/\\]+/,'');if(rel.split(/[\\/]/).includes('..'))throw new Error(`Unsafe attachment path for transaction ${t.id}`);const full=path.resolve(storageRoot,rel);const root=path.resolve(storageRoot)+path.sep;if(!full.startsWith(root))throw new Error(`Attachment path escaped storage root for transaction ${t.id}`);let buffer;try{buffer=await fs.readFile(full)}catch{missing.push({id:t.id,path:rel});continue;}if(buffer.length>5*1024*1024)throw new Error(`Receipt for transaction ${t.id} exceeds the supported 5 MB limit.`);const ext=path.extname(full).slice(1).toLowerCase();const mime=mimeByExt[ext];if(!mime)throw new Error(`Unsupported receipt file type for transaction ${t.id}: .${ext}`);const key=`receipts/${t.id}/${crypto.randomUUID()}.${ext}`;await s3.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:key,Body:buffer,ContentType:mime,CacheControl:'private, no-store',Metadata:{transactionid:String(t.id)}}));const result=await pool.query('UPDATE transactions SET attachment_key=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2',[key,t.id]);if(!result.rowCount)throw new Error(`No imported transaction ${t.id} exists in Neon.`);migrated++;}
  console.log(`Migrated ${migrated}/${needing.length} receipts to private R2.`);if(missing.length){console.error('Missing local files (not migrated):');for(const m of missing)console.error(`  transaction ${m.id}: ${m.path}`);process.exitCode=1;}
}catch(e){console.error('Receipt migration failed:',e.message);process.exitCode=1;}finally{await pool.end();s3.destroy();}
