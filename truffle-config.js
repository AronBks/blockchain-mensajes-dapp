module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545, // Cambiado para coincidir con Ganache GUI
      network_id: "1337" // Coincide con Ganache GUI
    }
  },
  compilers: {
    solc: {
      version: "0.8.17",   // ✅ Estable, compatible y ampliamente testeada
    }
  }
};
