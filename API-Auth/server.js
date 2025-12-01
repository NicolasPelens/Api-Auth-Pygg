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
                SELECT E.*, U.ID AS ID_USU
                FROM USUARIO U
                JOIN EMPRESA E ON U.EMPRESA_ID = E.ID
                WHERE U.NOME = ? AND U.SENHA = ?
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
                const token = jwt.sign({ empresaId: empresa.ID }, JWT_SECRET, {
                    expiresIn: "1h",
                });

                // Retorna o token, dados da empresa e URL_TRUST
                res.json({
                    token,
                    empresa: {
                        id: empresa.ID,
                        nome: empresa.NOME_EMP,
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

app.listen(3001, () =>
    console.log("🔥 Servidor rodando em http://localhost:3001")
);
