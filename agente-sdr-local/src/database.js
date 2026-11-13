const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agente_sdr.sqlite');
const db = new sqlite3.Database(dbPath);

// Inicializa e migra as tabelas do banco local
function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabela de Configurações
      db.run(`
        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY,
          work_start TEXT DEFAULT '09:00',
          work_end TEXT DEFAULT '18:00',
          work_days TEXT DEFAULT '1,2,3,4,5',
          min_delay_seconds INTEGER DEFAULT 240,
          max_delay_seconds INTEGER DEFAULT 480,
          daily_limit INTEGER DEFAULT 40,
          auto_pilot INTEGER DEFAULT 1,
          personal_whatsapp TEXT DEFAULT '',
          portfolio_base_url TEXT DEFAULT 'http://localhost:3001/vitrine/',
          target_niches TEXT DEFAULT 'Odontologia, Restaurantes, Hamburguerias, Clinicas Esteticas, Barbearias, Autopecas, Imobiliarias, Advocacia',
          target_cities TEXT DEFAULT 'Campinas, Sorocaba, Santos, Ribeirão Preto, São José dos Campos',
          custom_pitch_no_site TEXT DEFAULT '',
          custom_pitch_bad_site TEXT DEFAULT '',
          custom_pitch_has_site TEXT DEFAULT ''
        )
      `);

      // Tabela de Leads
      db.run(`
        CREATE TABLE IF NOT EXISTS leads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT NOT NULL UNIQUE,
          normalized_phone TEXT,
          niche TEXT,
          city TEXT,
          address TEXT,
          website TEXT,
          has_website INTEGER DEFAULT 0,
          website_status TEXT DEFAULT 'UNKNOWN',
          pitch_type TEXT,
          priority_score INTEGER DEFAULT 50,
          priority_tier TEXT DEFAULT 'BRONZE',
          pricing_tier TEXT DEFAULT 'MEDIO',
          price_setup INTEGER DEFAULT 150,
          price_monthly INTEGER DEFAULT 35,
          showcase_url TEXT,
          generated_message TEXT,
          status TEXT DEFAULT 'PENDENTE',
          dispatch_error TEXT,
          times_contacted INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sent_at DATETIME,
          replied_at DATETIME,
          last_reply_text TEXT
        )
      `);

      // Migração de colunas caso o banco já existisse
      const leadColumns = [
        ['normalized_phone', 'TEXT'],
        ['priority_score', 'INTEGER DEFAULT 50'],
        ['priority_tier', 'TEXT DEFAULT "BRONZE"'],
        ['pricing_tier', 'TEXT DEFAULT "MEDIO"'],
        ['price_setup', 'INTEGER DEFAULT 150'],
        ['price_monthly', 'INTEGER DEFAULT 35'],
        ['showcase_url', 'TEXT'],
        ['times_contacted', 'INTEGER DEFAULT 0']
      ];

      leadColumns.forEach(([col, type]) => {
        db.run(`ALTER TABLE leads ADD COLUMN ${col} ${type}`, (err) => {
          // Ignora se coluna já existir
        });
      });

      db.run(`ALTER TABLE config ADD COLUMN portfolio_base_url TEXT DEFAULT "http://localhost:3001/vitrine/"`, (err) => {
        // Ignora se já existir
      });

      // Tabela de Logs de Atividades
      db.run(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          level TEXT DEFAULT 'INFO',
          message TEXT NOT NULL
        )
      `);

      // Garante que exista pelo menos 1 registro padrão de config
      // resolve() DEVE ficar dentro deste callback para só disparar após
      // todas as migrations e o INSERT inicial estarem concluídos de fato.
      db.get('SELECT id FROM config WHERE id = 1', (err, row) => {
        if (err) {
          return reject(err);
        }
        if (!row) {
          db.run(`INSERT INTO config (id) VALUES (1)`, (insertErr) => {
            if (insertErr) return reject(insertErr);
            resolve(db);
          });
        } else {
          resolve(db);
        }
      });
    });
  });
}

// Helpers para Promise no SQLite
const dbAsync = {
  get: (sql, params = []) => new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row))),
  all: (sql, params = []) => new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows))),
  run: (sql, params = []) => new Promise((res, rej) => db.run(sql, params, function(err) { err ? rej(err) : res(this); }))
};

// Log helper
async function addLog(message, level = 'INFO') {
  console.log(`[${level}] ${message}`);
  try {
    await dbAsync.run('INSERT INTO logs (level, message) VALUES (?, ?)', [level, message]);
    // Mantém no máximo 500 logs recentes
    await dbAsync.run('DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 500)');
  } catch (e) {
    console.error('Erro ao gravar log:', e);
  }
}

module.exports = {
  db,
  dbAsync,
  initDb,
  addLog
};
