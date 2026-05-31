const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const { Pool } = require('pg');
const cors = require('cors')({ origin: true });

// 1. Inicializácia Firebase Admin SDK
// V prostredí Google Cloud sa automaticky načíta predvolený servisný účet projektu.
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT
});

// 2. Nastavenie databázového Pool-u pre PostgreSQL
const isLocal = process.env.NODE_ENV === 'development';
const connectionConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'atelierinak',
  port: 5432,
};

// Pripojenie v GCP cez Unix socket (rýchlejšie a bezpečnejšie) alebo lokálne cez TCP
if (process.env.INSTANCE_CONNECTION_NAME) {
  connectionConfig.host = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
} else {
  connectionConfig.host = process.env.DB_HOST || '127.0.0.1';
}

const pool = new Pool(connectionConfig);

// 3. Inicializácia Google Cloud Storage
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

// 4. Pomocná funkcia: Overenie JWT tokenu administrátora z Firebase
async function verifyAdmin(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Chýba autorizačná hlavička (Bearer)' });
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // Overenie v databáze, či je používateľ admin
    const client = await pool.connect();
    try {
      const dbRes = await client.query('SELECT is_admin FROM profiles WHERE id = $1', [userId]);
      if (dbRes.rows.length === 0 || !dbRes.rows[0].is_admin) {
        res.status(403).json({ error: 'Nedostatočné práva (is_admin = false)' });
        return null;
      }
      return userId;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Chyba verifikácie tokenu:', err);
    res.status(401).json({ error: 'Neplatný prihlasovací token', details: err.message });
    return null;
  }
}

/**
 * Hlavný vstupný bod pre HTTP Cloud Function
 */
exports.api = (req, res) => {
  // Povolíme CORS pre všetky požiadavky
  cors(req, res, async () => {
    const method = req.method;
    // Očistíme cestu (napr. /gallery?param -> /gallery)
    const path = req.path.replace(/\/$/, '') || '/';

    try {
      // ==========================================
      // VEREJNÉ ENDPOINTY (Nevyžadujú prihlásenie)
      // ==========================================

      // 1. Načítanie Galérie
      if (path === '/gallery' && method === 'GET') {
        const dbRes = await pool.query(
          'SELECT * FROM gallery_items WHERE is_active = true ORDER BY sort_order ASC, created_at DESC'
        );
        return res.json(dbRes.rows);
      }

      // 2. Načítanie Noviniek
      if (path === '/news' && method === 'GET') {
        const dbRes = await pool.query(
          'SELECT * FROM news_items WHERE is_active = true ORDER BY sort_order ASC, created_at DESC'
        );
        return res.json(dbRes.rows);
      }

      // ==========================================
      // CHRÁNENÉ ENDPOINTY (Vyžadujú Admin Auth)
      // ==========================================

      // Overíme administrátora pre všetky zapisovacie/mazacie akcie
      const adminUid = await verifyAdmin(req, res);
      if (!adminUid) return; // verifyAdmin už poslal chybovú odpoveď

      // 2.5 Overenie, či je používateľ admin (pre frontend)
      if (path === '/check-admin' && method === 'GET') {
        return res.json({ is_admin: true });
      }

      // 3. Generovanie Signed URL pre nahrávanie do GCS
      if (path === '/get-upload-url' && method === 'POST') {
        const { fileName, contentType, folder } = req.body;
        if (!fileName || !contentType) {
          return res.status(400).json({ error: 'Chýba fileName alebo contentType' });
        }

        const targetFolder = folder || 'gallery';
        // Vyčistenie názvu súboru (odstránenie diakritiky, špeciálnych znakov)
        const sanitizedName = fileName.replace(/[^a-z0-9.-]/gi, '_');
        const fileKey = `${targetFolder}/${Date.now()}-${sanitizedName}`;

        const file = storage.bucket(bucketName).file(fileKey);
        
        // Vygenerovanie URL na PUT požiadavku platnú 2 minúty
        const [uploadUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'write',
          expires: Date.now() + 2 * 60 * 1000, // 2 minúty
          contentType: contentType,
        });

        return res.json({ uploadUrl, key: fileKey });
      }

      // 4. Pridanie fotky do Galérie
      if (path === '/gallery' && method === 'POST') {
        const { s3_key, alt_text, category, mime_type, file_size, sort_order } = req.body;
        if (!s3_key) return res.status(400).json({ error: 'Chýba s3_key súboru' });

        const query = `
          INSERT INTO gallery_items (s3_key, alt_text, category, mime_type, file_size, sort_order, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        const values = [
          s3_key,
          alt_text || '',
          category || 'hlina',
          mime_type,
          file_size || 0,
          sort_order || 0,
          adminUid
        ];

        const dbRes = await pool.query(query, values);
        return res.status(201).json(dbRes.rows[0]);
      }

      // 5. Pridanie článku do Noviniek
      if (path === '/news' && method === 'POST') {
        const { s3_key, title, description, mime_type, file_size, sort_order } = req.body;
        if (!s3_key || !title) return res.status(400).json({ error: 'Chýba s3_key alebo title' });

        const query = `
          INSERT INTO news_items (s3_key, title, description, mime_type, file_size, sort_order, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        const values = [
          s3_key,
          title,
          description || '',
          mime_type,
          file_size || 0,
          sort_order || 0,
          adminUid
        ];

        const dbRes = await pool.query(query, values);
        return res.status(201).json(dbRes.rows[0]);
      }

      // 6. Úprava/Uloženie všetkých zmien v Galérii (hromadné ukladanie zmien a triedenia)
      if (path === '/gallery/batch' && method === 'PUT') {
        const { updates } = req.body; // updates = [{ id, alt_text, category, sort_order }, ...]
        if (!Array.isArray(updates)) return res.status(400).json({ error: 'Updates musí byť pole' });

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (const item of updates) {
            await client.query(
              'UPDATE gallery_items SET alt_text = $1, category = $2, sort_order = $3 WHERE id = $4',
              [item.alt_text, item.category, item.sort_order, item.id]
            );
          }
          await client.query('COMMIT');
          return res.json({ success: true, count: updates.length });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }

      // 7. Úprava/Uloženie všetkých zmien v Novinkách
      if (path === '/news/batch' && method === 'PUT') {
        const { updates } = req.body; // updates = [{ id, title, description, sort_order }, ...]
        if (!Array.isArray(updates)) return res.status(400).json({ error: 'Updates musí byť pole' });

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (const item of updates) {
            await client.query(
              'UPDATE news_items SET title = $1, description = $2, sort_order = $3 WHERE id = $4',
              [item.title, item.description, item.sort_order, item.id]
            );
          }
          await client.query('COMMIT');
          return res.json({ success: true, count: updates.length });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }

      // 8. Vymazanie fotky z Galérie
      if (path === '/gallery' && method === 'DELETE') {
        const { id, s3Key } = req.body;
        if (!id || !s3Key) return res.status(400).json({ error: 'Chýba id alebo s3Key' });

        // 1. Zmažeme súbor z Google Cloud Storage
        try {
          await storage.bucket(bucketName).file(s3Key).delete();
        } catch (storageErr) {
          // Ak súbor na úložisku neexistuje, logujeme to, ale pokračujeme s vymazaním z DB
          console.warn(`Súbor ${s3Key} sa nepodarilo zmazať z GCS:`, storageErr.message);
        }

        // 2. Vymažeme riadok z databázy
        await pool.query('DELETE FROM gallery_items WHERE id = $1', [id]);
        return res.json({ success: true });
      }

      // 9. Vymazanie článku z Noviniek
      if (path === '/news' && method === 'DELETE') {
        const { id, s3Key } = req.body;
        if (!id || !s3Key) return res.status(400).json({ error: 'Chýba id alebo s3Key' });

        // 1. Zmažeme súbor z Google Cloud Storage
        try {
          await storage.bucket(bucketName).file(s3Key).delete();
        } catch (storageErr) {
          console.warn(`Súbor ${s3Key} sa nepodarilo zmazať z GCS:`, storageErr.message);
        }

        // 2. Vymažeme riadok z databázy
        await pool.query('DELETE FROM news_items WHERE id = $1', [id]);
        return res.json({ success: true });
      }

      // Žiadna zhoda
      return res.status(404).json({ error: 'Tento endpoint neexistuje alebo táto HTTP metóda nie je povolená.' });

    } catch (error) {
      console.error('Kritická chyba servera:', error);
      return res.status(500).json({ error: 'Chyba servera', details: error.message });
    }
  });
};
