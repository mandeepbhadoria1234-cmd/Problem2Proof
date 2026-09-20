const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const UPLOADS = path.join(ROOT, "uploads");

fs.mkdirSync(UPLOADS, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(UPLOADS));
app.use(express.static(PUBLIC));

/* ================= DATABASE ================= */

const db = new Database(path.join(ROOT, "problem2proof.db"));

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    department TEXT,
    severity TEXT,
    priority TEXT,
    location TEXT,
    image TEXT,
    status TEXT DEFAULT 'Submitted',
    admin_note TEXT,
    proof_image TEXT,
    proof_note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

/* ================= ADMIN ================= */

const ADMIN_EMAIL = "admin@problem2proof.com";
const ADMIN_PASSWORD = "admin123";

const existingAdmin = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(ADMIN_EMAIL);

if (!existingAdmin) {
    db.prepare(`
        INSERT INTO users
        (name, email, password, role)
        VALUES (?, ?, ?, ?)
    `).run(
        "Problem2Proof Admin",
        ADMIN_EMAIL,
        bcrypt.hashSync(ADMIN_PASSWORD, 10),
        "admin"
    );
}

/* ================= FILE UPLOAD ================= */

const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, UPLOADS);
        },

        filename: function (req, file, cb) {
            const safeName = file.originalname
                .replace(/[^a-zA-Z0-9._-]/g, "_");

            cb(null, Date.now() + "-" + safeName);
        }
    }),

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

/* ================= AI CLASSIFICATION ================= */

function classifyProblem(title, description) {

    const text = `${title} ${description}`.toLowerCase();

    let category = "Other";
    let department = "Administration";
    let severity = "Medium";

    if (
        /water|ro|tap|leak|toilet|washroom|pipeline/.test(text)
    ) {
        category = "Water & Sanitation";
        department = "Hostel / Maintenance";
    }

    else if (
        /electric|light|fan|ac|power|socket|current/.test(text)
    ) {
        category = "Electrical";
        department = "Electrical / Maintenance";
    }

    else if (
        /wifi|internet|network|computer|lab|portal|website/.test(text)
    ) {
        category = "IT & Network";
        department = "IT Cell";
    }

    else if (
        /class|teacher|faculty|exam|assignment|attendance|academic/.test(text)
    ) {
        category = "Academic";
        department = "Academic Office";
    }

    else if (
        /road|parking|drain|building|chair|bench|room|hostel/.test(text)
    ) {
        category = "Infrastructure";
        department = "Maintenance";
    }

    if (
        /danger|unsafe|fire|shock|flood|broken|emergency|urgent/.test(text)
    ) {
        severity = "High";
    }

    if (
        /minor|small|cosmetic|suggestion/.test(text)
    ) {
        severity = "Low";
    }

    return {
        category,
        department,
        severity
    };
}

/* ================= PRIORITY ================= */

function calculatePriority(severity, reach, evidence) {

    const severityScore = {
        Low: 1,
        Medium: 2,
        High: 3
    };

    const reachScore = {
        Low: 1,
        Medium: 2,
        High: 3
    };

    const score =
        (severityScore[severity] || 2) +
        (reachScore[reach] || 1) +
        (evidence ? 1 : 0);

    if (score >= 7) return "Critical";
    if (score >= 5) return "High";
    if (score >= 3) return "Medium";

    return "Low";
}

/* ================= JWT ================= */

const JWT_SECRET =
    process.env.JWT_SECRET || "problem2proof-development-secret";

function createToken(user) {

    return jwt.sign(
        {
            id: user.id,
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}

/* ================= AUTH ================= */

function authenticate(req, res, next) {

    try {

        const header = req.headers.authorization || "";

        if (!header.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Login required"
            });
        }

        const token = header.substring(7);

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        const user = db
            .prepare(`
                SELECT id, name, email, role
                FROM users
                WHERE id = ?
            `)
            .get(decoded.id);

        if (!user) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        req.user = user;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid or expired login"
        });
    }
}

function adminOnly(req, res, next) {

    if (req.user.role !== "admin") {

        return res.status(403).json({
            message: "Admin access required"
        });
    }

    next();
}

/* ================= HEALTH ================= */

app.get("/api/health", function (req, res) {

    res.json({
        success: true,
        message: "Problem2Proof backend is running"
    });
});

/* ================= REGISTER ================= */

app.post("/api/register", function (req, res) {

    try {

        const {
            name,
            email,
            password
        } = req.body;

        if (!name || !email || !password) {

            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        if (password.length < 6) {

            return res.status(400).json({
                message: "Password must contain at least 6 characters"
            });
        }

        const cleanEmail =
            email.trim().toLowerCase();

        const existing = db
            .prepare("SELECT id FROM users WHERE email = ?")
            .get(cleanEmail);

        if (existing) {

            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const result = db
            .prepare(`
                INSERT INTO users
                (name, email, password, role)
                VALUES (?, ?, ?, ?)
            `)
            .run(
                name.trim(),
                cleanEmail,
                bcrypt.hashSync(password, 10),
                "student"
            );

        const user = db
            .prepare(`
                SELECT id, name, email, role
                FROM users
                WHERE id = ?
            `)
            .get(result.lastInsertRowid);

        res.json({
            token: createToken(user),
            user: user
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});

/* ================= LOGIN ================= */

app.post("/api/login", function (req, res) {

    try {

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");

        const user = db
            .prepare("SELECT * FROM users WHERE email = ?")
            .get(email);

        if (
            !user ||
            !bcrypt.compareSync(password, user.password)
        ) {

            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const safeUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.json({
            token: createToken(safeUser),
            user: safeUser
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Login failed"
        });
    }
});

/* ================= CURRENT USER ================= */

app.get("/api/me", authenticate, function (req, res) {

    res.json({
        user: req.user
    });
});

/* ================= CREATE REPORT ================= */

app.post(
    "/api/reports",
    authenticate,
    upload.single("image"),
    function (req, res) {

        try {

            const {
                title,
                description,
                location,
                reach
            } = req.body;

            if (!title || !description) {

                return res.status(400).json({
                    message: "Title and description are required"
                });
            }

            const ai = classifyProblem(
                title,
                description
            );

            const evidence = !!req.file;

            const priority = calculatePriority(
                ai.severity,
                reach || "Low",
                evidence
            );

            const image =
                req.file
                    ? `/uploads/${req.file.filename}`
                    : null;

            const result = db
                .prepare(`
                    INSERT INTO reports
                    (
                        user_id,
                        title,
                        description,
                        category,
                        department,
                        severity,
                        priority,
                        location,
                        image
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `)
                .run(
                    req.user.id,
                    title,
                    description,
                    ai.category,
                    ai.department,
                    ai.severity,
                    priority,
                    location || "",
                    image
                );

            const report = db
                .prepare("SELECT * FROM reports WHERE id = ?")
                .get(result.lastInsertRowid);

            res.json({
                message: "Report submitted successfully",
                report: report
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Could not submit report"
            });
        }
    }
);

/* ================= MY REPORTS ================= */

app.get(
    "/api/reports/mine",
    authenticate,
    function (req, res) {

        const reports = db
            .prepare(`
                SELECT *
                FROM reports
                WHERE user_id = ?
                ORDER BY id DESC
            `)
            .all(req.user.id);

        res.json({
            reports: reports
        });
    }
);

/* ================= NOTIFICATIONS ================= */

app.get(
    "/api/notifications",
    authenticate,
    function (req, res) {

        const notifications = db
            .prepare(`
                SELECT *
                FROM notifications
                WHERE user_id = ?
                ORDER BY id DESC
            `)
            .all(req.user.id);

        res.json({
            notifications: notifications
        });
    }
);

/* ================= ADMIN STATS ================= */

app.get(
    "/api/admin/stats",
    authenticate,
    adminOnly,
    function (req, res) {

        const total =
            db.prepare(
                "SELECT COUNT(*) AS count FROM reports"
            ).get().count;

        const resolved =
            db.prepare(
                "SELECT COUNT(*) AS count FROM reports WHERE status = 'Resolved'"
            ).get().count;

        const critical =
            db.prepare(
                "SELECT COUNT(*) AS count FROM reports WHERE priority = 'Critical'"
            ).get().count;

        const high =
            db.prepare(
                "SELECT COUNT(*) AS count FROM reports WHERE priority = 'High'"
            ).get().count;

        res.json({
            stats: {
                total,
                resolved,
                critical,
                high,
                open: total - resolved
            }
        });
    }
);

/* ================= ALL REPORTS ================= */

app.get(
    "/api/admin/reports",
    authenticate,
    adminOnly,
    function (req, res) {

        const reports = db
            .prepare(`
                SELECT
                    reports.*,
                    users.name AS user_name,
                    users.email AS user_email
                FROM reports
                JOIN users
                ON users.id = reports.user_id
                ORDER BY reports.id DESC
            `)
            .all();

        res.json({
            reports: reports
        });
    }
);

/* ================= UPDATE STATUS ================= */

app.patch(
    "/api/admin/reports/:id",
    authenticate,
    adminOnly,
    function (req, res) {

        const id = Number(req.params.id);

        const allowedStatuses = [
            "Submitted",
            "Under Review",
            "In Progress",
            "Resolved"
        ];

        const {
            status,
            admin_note
        } = req.body;

        if (!allowedStatuses.includes(status)) {

            return res.status(400).json({
                message: "Invalid status"
            });
        }

        const report = db
            .prepare("SELECT * FROM reports WHERE id = ?")
            .get(id);

        if (!report) {

            return res.status(404).json({
                message: "Report not found"
            });
        }

        db.prepare(`
            UPDATE reports
            SET
                status = ?,
                admin_note = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            status,
            admin_note || "",
            id
        );

        db.prepare(`
            INSERT INTO notifications
            (user_id, message)
            VALUES (?, ?)
        `).run(
            report.user_id,
            `Report #${id} status changed to ${status}.`
        );

        res.json({
            message: "Report updated"
        });
    }
);

/* ================= RESOLUTION PROOF ================= */

app.post(
    "/api/admin/reports/:id/proof",
    authenticate,
    adminOnly,
    upload.single("proof"),
    function (req, res) {

        const id = Number(req.params.id);

        const report = db
            .prepare("SELECT * FROM reports WHERE id = ?")
            .get(id);

        if (!report) {

            return res.status(404).json({
                message: "Report not found"
            });
        }

        const proofImage =
            req.file
                ? `/uploads/${req.file.filename}`
                : null;

        const proofNote =
            req.body.proof_note || "";

        db.prepare(`
            UPDATE reports
            SET
                proof_image = ?,
                proof_note = ?,
                status = 'Resolved',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            proofImage,
            proofNote,
            id
        );

        db.prepare(`
            INSERT INTO notifications
            (user_id, message)
            VALUES (?, ?)
        `).run(
            report.user_id,
            `Report #${id} has been resolved.`
        );

        res.json({
            message: "Resolution proof added"
        });
    }
);

/* ================= FRONTEND ================= */

app.get("*", function (req, res) {

    res.sendFile(
        path.join(PUBLIC, "index.html")
    );
});

/* ================= SERVER ================= */

app.listen(
    PORT,
    HOST,
    function () {

        console.log(
            `Problem2Proof running on port ${PORT}`
        );
    }
);