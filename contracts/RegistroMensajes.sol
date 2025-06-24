// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract RegistroMensajes {
    enum Estado { Pendiente, Confirmado }
    struct Mensaje {
        address remitente;
        string contenido;
        string archivoHash; // hash o enlace IPFS
        uint256 timestamp;
        Estado estado;
    }

    Mensaje[] public mensajes;

    event MensajeRegistrado(address indexed remitente, string contenido, string archivoHash, uint256 timestamp, Estado estado);
    event MensajeConfirmado(uint256 index);


    function registrarMensaje(string calldata _contenido, string calldata _archivoHash) external {
        require(bytes(_contenido).length > 0, "El mensaje no puede estar vacio");
        // _archivoHash puede ser vacío o un CID de IPFS
        Estado estadoFinal = Estado.Confirmado;
        if (bytes(_contenido).length > 50) {
            estadoFinal = Estado.Pendiente;
        }
        mensajes.push(Mensaje({
            remitente: msg.sender,
            contenido: _contenido,
            archivoHash: _archivoHash,
            timestamp: block.timestamp,
            estado: estadoFinal
        }));

        emit MensajeRegistrado(msg.sender, _contenido, _archivoHash, block.timestamp, estadoFinal);
    }

    function confirmarMensaje(uint256 index) external {
        require(index < mensajes.length, "Indice invalido");
        require(mensajes[index].estado == Estado.Pendiente, "Ya confirmado");
        mensajes[index].estado = Estado.Confirmado;
        emit MensajeConfirmado(index);
    }

    function obtenerTodosLosMensajes() external view returns (Mensaje[] memory) {
        return mensajes;
    }

    function totalMensajes() external view returns (uint256) {
        return mensajes.length;
    }
}
