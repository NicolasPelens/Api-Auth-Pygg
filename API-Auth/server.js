import express from "express";
import cors from "cors";
import axios from "axios";
import qs from "qs";
import jwt from "jsonwebtoken";
import { withConnection } from "./db.js";

const app = express();
app.use(cors({
    origin: [
        "https://pygg.com.br",
        "https://incatex.pygg.com.br",
        "http://localhost:5173",
        "http://127.0.0.1:5500"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use(express.json());

const RECAPTCHA_SECRET = "6LdfzugrAAAAAKeFvDiRBj33-XPDS8c33HAoXFAi";
const JWT_SECRET = "segredo123"; // trocar por .env em produção

app.post("/app/login", async (req, res) => {
    const { email: LOGIN, senha: SENHA, captcha } = req.body;

    if (!captcha) {
        return res.status(400).json({ error: "Captcha não enviado" });
    }

    try {
        const googleResponse = await axios.post(
            "https://www.google.com/recaptcha/api/siteverify",
            qs.stringify({ secret: RECAPTCHA_SECRET, response: captcha }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        if (!googleResponse.data.success) {
            return res.status(400).json({ error: "Falha na verificação do captcha" });
        }

        // --- conexão com banco ---
        withConnection((err, db) => {
            if (err) {
                console.error("Falha na conexão com o banco:", err);
                return res.status(500).json({ error: "Falha na conexão com o banco" });
            }

            const sql = `
                SELECT E.*, U.ID_USU AS ID_USU
                FROM USUARIO U
                JOIN EMPRESA E ON U.ID_EMP = E.ID_EMP
                WHERE U.LOGIN = ? AND U.SENHA = ?
            `;

            db.query(sql, [LOGIN, SENHA], (err, result) => {
                db.detach();

                if (err) {
                    console.error("Erro no login:", err);
                    return res.status(500).json({ error: "Erro no servidor" });
                }

                if (!result || result.length === 0) {
                    return res.status(401).json({ error: "Usuário ou senha inválidos" });
                }
                const empresa = result[0];

                const urlTrust = empresa.URL_TRUST || null;
                const token = jwt.sign({ empresaId: empresa.ID_EMP }, JWT_SECRET, {
                    expiresIn: "1h",
                });

                // Retorna o token, dados da empresa e URL_TRUST
                res.json({
                    token,
                    empresa: {
                        id: empresa.ID_EMP,
                        nome: empresa.NM_EMP,
                    },
                    urlTrust,
                });
            });
        });
    } catch (error) {
        console.error("Erro ao validar captcha ou processar login:", error);
        return res
            .status(500)
            .json({ error: "Erro no servidor (captcha ou banco)" });
    }
});

app.get("/get/usuario", (req, res) => {

    const SQL_GET_USERS = "SELECT ID_USU, NM_USU, LOGIN, SENHA, NM_EMP FROM USUARIO JOIN EMPRESA ON USUARIO.ID_EMP = EMPRESA.ID_EMP ORDER BY ID_USU"; 

    withConnection((err, db) => {

        if (err) {
            console.error("❌ Erro ao conectar ao Firebird:", err);
            return;
        }
        db.query(SQL_GET_USERS, (err, result) => {
            db.detach();
            if (err) {
                console.error("Erro ao buscar dados:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }
            return res.json({ users: result });
        });
    });
});

app.get("/get/empresa", (req, res) => {

    const SQL_GET_USERS = "SELECT * FROM EMPRESA";

    withConnection((err, db) => {

        if (err) {
            console.error("❌ Erro ao conectar ao Firebird:", err);
            return;
        }
        db.query(SQL_GET_USERS, (err, result) => {
            db.detach();
            if (err) {
                console.error("Erro ao buscar dados:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }
            return res.json({ empresas: result });
        });
    });
});

app.post("/insert/usuario", (req, res) => {

    const SQL_INSERT_USUARIO = "INSERT INTO USUARIO (NM_USU, LOGIN, SENHA, ID_EMP) VALUES (?, ?, ?, ?)";
    const { nm_usu, login, senha, id_emp } = req.body;

    withConnection((err, db) => {
        if (err) {
            console.error("❌ Erro ao conectar ao Firebird:", err);
            return res.status(500).json({ error: "Erro ao conectar ao banco" });
        }

        db.query(SQL_INSERT_USUARIO, [nm_usu, login, senha, id_emp], (err, result) => {
            db.detach();

            if (err) {
                console.error("Erro ao inserir dados:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }

            return res.json({ message: "Usuário inserido com sucesso!", usuario: result });
        });
    });
});

app.post("/insert/empresa", (req, res) => {

    const SQL_INSERT_EMPRESA = "INSERT INTO EMPRESA (NM_EMP, URL_TRUST) VALUES (?, ?)";
    const { nm_emp, url_trust } = req.body;

    withConnection((err, db) => {
        if (err) {
            console.error("❌ Erro ao conectar ao Firebird:", err);
            return res.status(500).json({ error: "Erro ao conectar ao banco" });
        }

        db.query(SQL_INSERT_EMPRESA, [nm_emp, url_trust], (err, result) => {
            db.detach();

            if (err) {
                console.error("Erro ao inserir dados:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }

            return res.json({ message: "Empresa inserido com sucesso!", usuario: result });
        });
    });
});

app.delete("/delete/usuario/:id", (req, res) => {
    const SQL_DELETE_USUARIO = "DELETE FROM USUARIO WHERE ID_USU = ?";
    const { id } = req.params;

    withConnection((err, db) => {
        if (err) {
            console.error("❌ Erro ao conectar ao Firebird:", err);
            return res.status(500).json({ error: "Erro ao conectar ao banco" });
        }

        db.query(SQL_DELETE_USUARIO, [id], (err, result) => {
            db.detach();

            if (err) {
                console.error("Erro ao deletar dados:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }

            return res.json({ message: "Usuário deletado com sucesso!" });
        });
    });
})

app.delete("/delete/empresa/:id", (req, res) => {
    const SQL_DELETE_EMPRESA = "DELETE FROM EMPRESA WHERE ID_EMP = ?";
    const { id } = req.params;

    withConnection((err, db) => {
        if (err) {
            console.error("❌ Erro ao conectar ao Firebird:", err);
            return res.status(500).json({ error: "Erro ao conectar ao banco" });
        }

        db.query(SQL_DELETE_EMPRESA, [id], (err, result) => {
            db.detach();

            if (err) {
                console.error("Erro ao deletar dados:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }

            return res.json({ message: "Empresa deletada com sucesso!" });
        });
    });
})

app.put("/update/usuario/:id", (req, res) => {
    const SQL_UPDATE_USUARIO = "UPDATE USUARIO SET NM_USU = ?, LOGIN = ?, SENHA = ?, ID_EMP = ? WHERE ID_USU = ?";
    const { id } = req.params;
    const { nm_usu, login, senha, id_emp } = req.body;

    withConnection((err, db) => {
        if (err) {
            console.error("❌ Erro ao conectar ao Firebird:", err);
            return res.status(500).json({ error: "Erro ao conectar ao banco" });
        }

        db.query(SQL_UPDATE_USUARIO, [nm_usu, login, senha, id_emp, id], (err, result) => {
            db.detach();

            if (err) {
                console.error("Erro ao atualizar dados:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }

            return res.json({ message: "Usuário atualizado com sucesso!" });
        });
    });
});

app.put("/update/empresa/:id", (req, res) => {
    const SQL_UPDATE_EMPRESA = "UPDATE EMPRESA SET NM_EMP = ?, URL_TRUST = ? WHERE ID_EMP = ?";
    const { id } = req.params;
    const { nm_emp, url_trust } = req.body;

    withConnection((err, db) => {
        if (err) {
            console.error("❌ Erro ao conectar ao Firebird:", err);
            return res.status(500).json({ error: "Erro ao conectar ao banco" });
        }

        db.query(SQL_UPDATE_EMPRESA, [nm_emp, url_trust, id], (err, result) => {
            db.detach();

            if (err) {
                console.error("Erro ao atualizar dados:", err);
                return res.status(500).json({ error: "Erro no servidor" });
            }

            return res.json({ message: "Empresa atualizada com sucesso!" });
        });
    });
});

app.listen(3001, () =>
    console.log("🔥 Servidor rodando em http://localhost:3001")
);
