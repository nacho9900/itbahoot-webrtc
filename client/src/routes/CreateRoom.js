import React from "react";
import { v1 as uuid } from "uuid";

const CreateRoom = (props) => {
    // funcion para crear un room desde frontend,
    // esto no lo crea en el server aun    
    function create() {
        // nuevo uuid para el room
        const id = uuid();
        // lo mando al room
        props.history.push(`/room/${id}`);
    }

    return (
        <button onClick={create}>Create Room</button>
    );
};

export default CreateRoom;