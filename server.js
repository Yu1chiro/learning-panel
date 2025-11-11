require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Koneksi Neon DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Inisialisasi Tabel
// Inisialisasi Tabel
(async () => {
  let client; // Definisikan di luar try
  try {
    client = await pool.connect();
    
    // --- BAGIAN 1: CREATE TABLES (Aman di dalam Transaksi) ---
    await client.query("BEGIN");

    // 1. Tabel Chapters
    await client.query(`
      CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT
      )
    `);

    // 2. Tabel Vocabularies
    await client.query(`
      CREATE TABLE IF NOT EXISTS vocabularies (
        id SERIAL PRIMARY KEY,
        bab_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
        kosakata TEXT NOT NULL,
        arti TEXT NOT NULL,
        image_url TEXT
      )
    `);

    // 3. Tabel Grammar Patterns
    await client.query(`
      CREATE TABLE IF NOT EXISTS grammar_patterns (
        id SERIAL PRIMARY KEY,
        bab_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
        pattern TEXT,
        explanation TEXT,
        example TEXT,
        image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
        sort_order INTEGER
      )
    `);

    // 4. Tabel Quizzes
    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        bab_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
        question TEXT,
        option_a TEXT,
        option_b TEXT,
        option_c TEXT,
        option_d TEXT,
        correct_answer VARCHAR(1)
      )
    `);

    // 5. Tabel Reading Passages
    await client.query(`
      CREATE TABLE IF NOT EXISTS reading_passages (
        id SERIAL PRIMARY KEY,
        bab_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
        passage_content TEXT
      )
    `);

    // 6. Tabel Reading Questions
    await client.query(`
      CREATE TABLE IF NOT EXISTS reading_questions (
        id SERIAL PRIMARY KEY,
        passage_id INTEGER REFERENCES reading_passages(id) ON DELETE CASCADE,
        question_text TEXT,
        option_a TEXT,
        option_b TEXT,
        option_c TEXT,
        option_d TEXT,
        correct_answer VARCHAR(1)
      )
    `);

    // 7. Tabel Listening Exercises
    await client.query(`
      CREATE TABLE IF NOT EXISTS listening_exercises (
        id SERIAL PRIMARY KEY,
        bab_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
        title TEXT,
        description TEXT,
        image_url TEXT,
        audio_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
        script TEXT 
      )
    `);
    
    await client.query("COMMIT");
    console.log("Semua tabel (CREATE IF NOT EXISTS) berhasil dieksekusi.");

    // --- BAGIAN 2: ALTER TABLES (Dijalankan di luar transaksi untuk debugging) ---
    // Kita tidak menggunakan BEGIN/COMMIT di sini agar error-nya spesifik
    
    console.log("Memulai validasi kolom (ALTER)...");

    // Listening
    await client.query(`ALTER TABLE listening_exercises ADD COLUMN IF NOT EXISTS description TEXT;`);
    await client.query(`ALTER TABLE listening_exercises ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE listening_exercises ADD COLUMN IF NOT EXISTS script TEXT;`);
    await client.query(`ALTER TABLE listening_exercises ADD COLUMN IF NOT EXISTS audio_urls TEXT[] DEFAULT ARRAY[]::TEXT[];`);
    await client.query(`ALTER TABLE listening_exercises DROP COLUMN IF EXISTS audio_url;`);
    await client.query(`ALTER TABLE listening_exercises DROP COLUMN IF EXISTS audio_url_1;`);
    await client.query(`ALTER TABLE listening_exercises DROP COLUMN IF EXISTS audio_url_2;`);
    console.log("Validasi kolom 'listening_exercises' selesai.");

    // Vocabularies
    try {
      await client.query(`ALTER TABLE vocabularies RENAME COLUMN content TO kosakata;`);
    } catch (renameErr) {
      if (renameErr.code !== '42701' && renameErr.code !== '42703') { 
        throw renameErr; 
      }
    }
    await client.query(`ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS arti TEXT;`);
    await client.query(`ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    console.log("Validasi kolom 'vocabularies' selesai.");

    // Grammar Patterns
    await client.query(`ALTER TABLE grammar_patterns DROP COLUMN IF EXISTS image_url;`); 
    await client.query(`ALTER TABLE grammar_patterns ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT ARRAY[]::TEXT[];`); 
    await client.query(`ALTER TABLE grammar_patterns ADD COLUMN IF NOT EXISTS sort_order INTEGER;`);
    console.log("Validasi kolom 'grammar_patterns' selesai.");

    console.log("Semua validasi kolom (ALTER) berhasil.");
    
  } catch (err) {
    // [PENTING] Error yang asli SEKARANG akan ditangkap di sini
    console.error("Error saat inisialisasi tabel:", err); // <-- PERHATIKAN INI
    if (client) {
        // Jika error terjadi di dalam transaksi (Bagian 1), rollback
        try { await client.query("ROLLBACK"); } catch (rbErr) { console.error("Error saat rollback:", rbErr); }
    }
  } finally {
    if (client) {
      client.release();
      console.log("Koneksi database dilepas.");
    }
  }
})();
// Middleware
// Middleware
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// === Middleware Autentikasi ===
function authPageMiddleware(req, res, next) {
  if (req.cookies.auth === "true") {
    next();
  } else {
    res.redirect("/login");
  }
}
function authApiMiddleware(req, res, next) {
  if (req.cookies.auth === "true") {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// === Routing Halaman ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/quiz", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "quiz.html"));
});
app.get("/study", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "study.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/dashboard", authPageMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});
app.get("/panel-kosakata", authPageMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panel-kosakata.html"));
});
app.get("/panel-polakalimat", authPageMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panel-polakalimat.html"));
});
app.get("/create-quiz", authPageMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "create-quiz.html"));
});
app.get("/panel-dokkai", authPageMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panel-dokkai.html"));
});
app.get("/panel-choukai", authPageMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panel-choukai.html"));
});

// === API Routes ===

// 1. Auth API (Tidak Berubah)
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    res.cookie("auth", "true", { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Username atau password salah" });
  }
});
app.get("/api/logout", (req, res) => {
  res.cookie("auth", "", { expires: new Date(0) });
  res.redirect("/login");
});

// 2. Chapters API (Tidak Berubah)
app.get("/api/chapters", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM chapters ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/chapters", authApiMiddleware, async (req, res) => {
  const { title, description } = req.body;
  try {
    const { rows } = await pool.query("INSERT INTO chapters (title, description) VALUES ($1, $2) RETURNING *", [title, description]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/chapters/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  try {
    const { rows } = await pool.query("UPDATE chapters SET title = $1, description = $2 WHERE id = $3 RETURNING *", [title, description, id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/chapters/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM chapters WHERE id = $1", [id]);
    res.json({ success: true, message: "Bab berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Vocabularies API (Tidak Berubah)
app.get("/api/vocabulary/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query("SELECT id, kosakata, arti, image_url FROM vocabularies WHERE id = $1", [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/vocabularies/:babId", async (req, res) => {
  const { babId } = req.params;
  try {
    const { rows } = await pool.query("SELECT id, kosakata, arti, image_url FROM vocabularies WHERE bab_id = $1 ORDER BY id ASC", [babId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/vocabularies", authApiMiddleware, async (req, res) => {
  const { bab_id, kosakata, arti, image_url } = req.body;
  try {
    const { rows } = await pool.query(
      "INSERT INTO vocabularies (bab_id, kosakata, arti, image_url) VALUES ($1, $2, $3, $4) RETURNING *",
      [bab_id, kosakata, arti, image_url || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/vocabularies/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  const { kosakata, arti, image_url } = req.body;
  try {
    const { rows } = await pool.query(
      "UPDATE vocabularies SET kosakata = $1, arti = $2, image_url = $3 WHERE id = $4 RETURNING *",
      [kosakata, arti, image_url || null, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/vocabularies/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM vocabularies WHERE id = $1", [id]);
    res.json({ success: true, message: "Kosakata berhasil dihapus" });
  } catch (err)
    {
    res.status(500).json({ error: err.message });
  }
});

// 4. Grammar Patterns API [MODIFIKASI URUTAN]

// [MODIFIKASI URUTAN] POST /api/grammar (Menambah sort_order saat insert)
app.post("/api/grammar", authApiMiddleware, async (req, res) => {
  const { bab_id, pattern, explanation, example, image_urls } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO grammar_patterns (
        bab_id, pattern, explanation, example, image_urls, sort_order
      ) VALUES (
        $1, $2, $3, $4, $5, 
        (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM grammar_patterns WHERE bab_id = $1)
      ) RETURNING *`,
      [bab_id, pattern, explanation, example, image_urls || []]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error di POST /api/grammar:", err);
    res.status(500).json({ error: err.message });
  }
});

// [MODIFIKASI URUTAN] Endpoint BARU untuk menyimpan urutan
app.post("/api/grammar/reorder", authApiMiddleware, async (req, res) => {
  const { babId, orderedIds } = req.body; // orderedIds adalah array [id1, id2, id3, ...]

  if (!babId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: "Data tidak valid" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Loop melalui array ID dan update sort_order berdasarkan indeksnya
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const sortOrder = i;
      await client.query(
        "UPDATE grammar_patterns SET sort_order = $1 WHERE id = $2 AND bab_id = $3",
        [sortOrder, id, babId]
      );
    }
    
    await client.query("COMMIT");
    res.json({ success: true, message: "Urutan berhasil disimpan" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error reordering grammar:", err);
    res.status(500).json({ error: "Gagal menyimpan urutan" });
  } finally {
    client.release();
  }
});


app.get("/api/grammar/entry/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query("SELECT * FROM grammar_patterns WHERE id = $1", [id]);
    res.json(rows[0]); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [MODIFIKASI URUTAN] GET /api/grammar/:babId (Menambah ORDER BY)
// Ini akan otomatis memperbaiki `study.html` juga
app.get("/api/grammar/:babId", async (req, res) => {
  const { babId } = req.params;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM grammar_patterns WHERE bab_id = $1 ORDER BY sort_order ASC, id ASC", 
      [babId]
    );
    res.json(rows); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [MODIFIKASI URUTAN] PUT /api/grammar/:id (Tidak perlu mengubah sort_order saat update)
app.put("/api/grammar/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  const { pattern, explanation, example, image_urls } = req.body;
  try {
    const { rows } = await pool.query(
      "UPDATE grammar_patterns SET pattern = $1, explanation = $2, example = $3, image_urls = $4 WHERE id = $5 RETURNING *",
      [pattern, explanation, example, image_urls || [], id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/grammar/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM grammar_patterns WHERE id = $1", [id]);
    res.json({ success: true, message: "Pola kalimat berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// [AKHIR MODIFIKASI API GRAMMAR]

// 5. Quizzes API (Tidak Berubah)
app.get("/api/quizzes/:babId", async (req, res) => {
  const { babId } = req.params;
  try {
    const { rows } = await pool.query("SELECT id, bab_id, question, option_a, option_b, option_c, option_d FROM quizzes WHERE bab_id = $1", [babId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/quiz/entry/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query("SELECT * FROM quizzes WHERE id = $1", [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/quizzes/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  const { question, option_a, option_b, option_c, option_d, correct_answer } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE quizzes SET 
       question = $1, option_a = $2, option_b = $3, option_c = $4, option_d = $5, correct_answer = $6
       WHERE id = $7 RETURNING *`,
      [question, option_a, option_b, option_c, option_d, correct_answer, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/quizzes/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM quizzes WHERE id = $1", [id]);
    res.json({ success: true, message: "Soal berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/admin/quizzes/:babId", authApiMiddleware, async (req, res) => {
  const { babId } = req.params;
  try {
    const { rows } = await pool.query("SELECT * FROM quizzes WHERE bab_id = $1", [babId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/quizzes", authApiMiddleware, async (req, res) => {
  const { bab_id, question, option_a, option_b, option_c, option_d, correct_answer } = req.body;
  try {
    const { rows } = await pool.query("INSERT INTO quizzes (bab_id, question, option_a, option_b, option_c, option_d, correct_answer) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *", [
      bab_id,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/submit-quiz/:babId", async (req, res) => {
  const { babId } = req.params;
  const userAnswers = req.body.answers;
  try {
    const { rows: correctAnswers } = await pool.query("SELECT id, correct_answer FROM quizzes WHERE bab_id = $1", [babId]);
    let score = 0;
    const totalQuestions = correctAnswers.length;
    const results = [];
    userAnswers.forEach((userAns) => {
      const question = correctAnswers.find((q) => q.id === userAns.questionId);
      if (question) {
        const isCorrect = question.correct_answer === userAns.answer;
        if (isCorrect) {
          score++;
        }
        results.push({
          questionId: userAns.questionId,
          isCorrect: isCorrect,
          correctAnswer: question.correct_answer,
        });
      }
    });
    res.json({
      score: score,
      total: totalQuestions,
      results: results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Reading (Dokkai) API (Tidak Berubah)
// 6. Reading (Dokkai) API (PERBAIKAN)
app.get("/api/reading/:babId", async (req, res) => {
  const { babId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.bab_id, p.passage_content, (
        SELECT json_agg(json_build_object(
          'id', q.id, 
          'question_text', q.question_text, 
          'option_a', q.option_a, 
          'option_b', q.option_b, 
          'option_c', q.option_c, 
          'option_d', q.option_d
        ))
        FROM reading_questions q 
        WHERE q.passage_id = p.id
      ) as questions 
      FROM reading_passages p
      WHERE p.bab_id = $1 
      GROUP BY p.id -- [PERBAIKAN] GROUP BY DITAMBAHKAN
      ORDER BY p.id ASC`,
      [babId]
    );
    const filteredRows = rows.map((row) => {
      if (row.questions && row.questions.length === 1 && row.questions[0].id === null) {
        row.questions = [];
      }
      return row;
    });
    res.json(filteredRows);
  } catch (err) {
    // Tambahkan log ini untuk melihat error di konsol server
    console.error(`Error di /api/reading/${babId}:`, err); 
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/reading/:babId", authApiMiddleware, async (req, res) => {
  const { babId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.bab_id, p.passage_content, (
        SELECT json_agg(json_build_object(
          'id', q.id,
          'passage_id', q.passage_id,
          'question_text', q.question_text,
          'option_a', q.option_a,
          'option_b', q.option_b,
          'option_c', q.option_c,
          'option_d', q.option_d,
          'correct_answer', q.correct_answer -- [PERBAIKAN] SIMBOL 'S' ANEH DIHAPUS DARI SINI
        ) ORDER BY q.id ASC)
        FROM reading_questions q 
        WHERE q.passage_id = p.id
      ) as questions 
      FROM reading_passages p
      WHERE p.bab_id = $1 
      GROUP BY p.id -- [PERBAIKAN] GROUP BY DITAMBAHKAN
      ORDER BY p.id ASC`,
      [babId]
    );
    const filteredRows = rows.map((row) => {
      if (row.questions && row.questions.length === 1 && row.questions[0] === null) {
        row.questions = [];
      }
      return row;
    });
    res.json(filteredRows);
  } catch (err) {
    console.error("Error di /api/admin/reading/:babId:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/reading/passage", authApiMiddleware, async (req, res) => {
  const { bab_id, passage_content, questions } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const passageRes = await client.query("INSERT INTO reading_passages (bab_id, passage_content) VALUES ($1, $2) RETURNING id", [bab_id, passage_content]);
    const passageId = passageRes.rows[0].id;

    if (questions && questions.length > 0) {
      for (const q of questions) {
        await client.query(
          `INSERT INTO reading_questions 
     (passage_id, question_text, option_a, option_b, option_c, option_d, correct_answer) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [passageId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer]
        );
      }
    }
    await client.query("COMMIT");
    res.status(201).json({ success: true, passageId: passageId });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
app.get("/api/reading/passage/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT p.*, (
 SELECT json_agg(q.* ORDER BY q.id ASC)
 FROM reading_questions q 
 WHERE q.passage_id = p.id
) as questions 
FROM reading_passages p
WHERE p.id = $1 
GROUP BY p.id`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Wacana tidak ditemukan" });
    }
    if (rows[0].questions && rows[0].questions.length === 1 && rows[0].questions[0].id === null) {
      rows[0].questions = [];
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/reading/passage/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  const { passage_content, questions } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE reading_passages SET passage_content = $1 WHERE id = $2", [passage_content, id]);
    await client.query("DELETE FROM reading_questions WHERE passage_id = $1", [id]);
    if (questions && questions.length > 0) {
      for (const q of questions) {
        await client.query(
          `INSERT INTO reading_questions 
 (passage_id, question_text, option_a, option_b, option_c, option_d, correct_answer) 
 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer]
        );
      }
    }
    await client.query("COMMIT");
    res.json({ success: true, message: "Wacana berhasil diperbarui" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
app.delete("/api/reading/passage/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM reading_passages WHERE id = $1", [id]);
    res.json({ success: true, message: "Wacana dan pertanyaannya berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/submit-reading/:babId", async (req, res) => {
  const { babId } = req.params;
  const userAnswers = req.body.answers;
  try {
    const { rows: correctAnswers } = await pool.query(
      `SELECT q.id, q.correct_answer 
       FROM reading_questions q
       JOIN reading_passages p ON q.passage_id = p.id
       WHERE p.bab_id = $1`,
      [babId]
    );
    let score = 0;
    const totalQuestions = correctAnswers.length;
    const results = [];
    userAnswers.forEach((userAns) => {
      const question = correctAnswers.find((q) => q.id === userAns.questionId);
      if (question) {
        const isCorrect = question.correct_answer === userAns.answer;
        if (isCorrect) {
          score++;
        }
        results.push({
          questionId: userAns.questionId,
          isCorrect: isCorrect,
          correctAnswer: question.correct_answer,
        });
      }
    });
    res.json({
      score: score,
      total: totalQuestions,
      results: results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Listening (Choukai) API (Tidak Berubah)
app.post("/api/listening", authApiMiddleware, async (req, res) => {
  const { bab_id, title, description, image_url, audio_urls, script } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO listening_exercises 
(bab_id, title, description, image_url, audio_urls, script) 
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [bab_id, title, description, image_url, audio_urls, script]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error di POST /api/listening:", err);
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/listening/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, description, image_url, audio_urls, script } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE listening_exercises 
SET title = $1, description = $2, image_url = $3, audio_urls = $4, script = $5 
WHERE id = $6 RETURNING *`,
      [title, description, image_url, audio_urls, script, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("Error di PUT /api/listening:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/listening/:babId", async (req, res) => {
  const { babId } = req.params;
  try {
    const { rows } = await pool.query("SELECT * FROM listening_exercises WHERE bab_id = $1 ORDER BY id ASC", [babId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/admin/listening/:babId", authApiMiddleware, async (req, res) => {
  const { babId } = req.params;
  try {
    const { rows } = await pool.query("SELECT * FROM listening_exercises WHERE bab_id = $1 ORDER BY id ASC", [babId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/listening/entry/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query("SELECT * FROM listening_exercises WHERE id = $1", [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/listening/:id", authApiMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM listening_exercises WHERE id = $1", [id]);
    res.json({ success: true, message: "Latihan mendengar berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});