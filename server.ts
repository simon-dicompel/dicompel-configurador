import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Configuração do Banco de Dados Azure
  const hasDbConfig = process.env.DB_HOST && process.env.DB_HOST !== 'seu_servidor.postgres.database.azure.com';
  
  const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  // --- API ROUTES ---

  app.get("/api/products", async (req, res) => {
    if (!hasDbConfig) {
      return res.status(503).json({ error: "Banco de dados não configurado. Use .env para configurar a Azure." });
    }
    try {
      const result = await pool.query('SELECT * FROM products ORDER BY description');
      res.json(result.rows);
    } catch (err) {
      console.error("DB Error:", err);
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!hasDbConfig) {
      return res.status(503).json({ error: "Serviço de autenticação em banco de dados indisponível." });
    }
    try {
      const result = await pool.query('SELECT * FROM profiles WHERE email = $1 AND password = $2', [email, password]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
      } else {
        res.status(401).json({ error: "Credenciais inválidas" });
      }
    } catch (err) {
      res.status(500).json({ error: "Erro interno no servidor" });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Conectado ao Azure DB: ${process.env.DB_HOST || 'Aguardando config'}`);
  });
}

startServer();
