import firebird from "node-firebird";

const options = {
  host: "localhost",
  port: 3050,
  database: "C:/Users/Padrao/Desktop/AuthPygg.fdb",
  user: "SYSDBA",
  password: "vancotovo",
  lowercase_keys: false,
  role: null,
  pageSize: 4096
};

export function withConnection(callback) {
  firebird.attach(options, (err, db) => {
    if (err) {
      console.error("❌ Erro ao conectar ao Firebird:", err);
      callback(err, null);
    } else {
      callback(null, db);
    }
  });
}
