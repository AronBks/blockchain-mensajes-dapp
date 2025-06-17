const RegistroMensajes = artifacts.require("RegistroMensajes");

module.exports = function (deployer) {
  deployer.deploy(RegistroMensajes);
};
