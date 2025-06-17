// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Registro {
    string[] private mensajes;

    function registrarMensaje(string memory mensaje) public {
        mensajes.push(mensaje);
    }

    function obtenerMensajes() public view returns (string[] memory) {
        return mensajes;
    }
}
