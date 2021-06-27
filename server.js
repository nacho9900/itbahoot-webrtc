const express = require("express");
const http = require("http");
const socket = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socket(server);

const rooms = {};

io.on("connection", socket => {
    // este evento sirve para cuando alguien se une a una sala
    socket.on("join room", roomID => {
        // si ya existe el room
        if (rooms[roomID]) {
            // lo agrego al room
            rooms[roomID].push(socket.id);
        } else { // no existe el room
            //creo el room con el usuario
            rooms[roomID] = [socket.id];
        }

        // busco cualquier otro usuarios
        const otherUser = rooms[roomID].find(id => id !== socket.id);
        // si hay otro usuario
        if (otherUser) {
            // le digo quien es el otro usuario
            socket.emit("other user", otherUser);
            // le aviso al otro que se unio alguien nuevo
            socket.to(otherUser).emit("user joined", socket.id);
        }
    });

    // este evento sirve para cuando ya están unidos a la sala y
    // se quieren pasar algun tipo de informacion
    socket.on("offer", payload => {
        // le mando al target el payload: quien soy y los datos que quiero mandar
        io.to(payload.target).emit("offer", payload);
    });

    //este evento sirve para cuando alguien recibe un offer y contesta
    socket.on("answer", payload => {
        // le mando al target el payload: quien soy y mi respuesta
        io.to(payload.target).emit("answer", payload);
    });

    // este evento es para conectarse p2p una vez que intercambiaron informacion
    // es necesario porque resuelve todo el tema de firewalls y NAT
    // con esto me aseguro que se puedan conectar sin importar
    // practicamente la configuracion de las redes
    socket.on("ice-candidate", incoming => {
        io.to(incoming.target).emit("ice-candidate", incoming.candidate);
    });
});

server.listen(8000, () => console.log("server is running on port 8000"));