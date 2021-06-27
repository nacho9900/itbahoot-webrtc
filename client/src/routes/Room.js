import React, { useRef, useEffect } from "react";
import io from "socket.io-client";

const Room = (props) => {
    // videos
    const userVideo = useRef();
    const partnerVideo = useRef();

    const peerRef = useRef();
    const socketRef = useRef();
    const otherUser = useRef();
    const userStream = useRef();

    useEffect(() => {
        // dame audio y video
        navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
            userVideo.current.srcObject = stream;
            userStream.current = stream;

            // me contecto al server
            socketRef.current = io.connect("/");
            // le digo al server que me quiero meter en el room
            socketRef.current.emit("join room", props.match.params.roomID);

            // defino callback: si ya habia alguien
            socketRef.current.on("other user", userID => {
                // lo llamo
                callUser(userID);
                // me guardo quien es el otro
                otherUser.current = userID;
            });

            // defino callback: si fui el primero y se unió alguien
            socketRef.current.on("user joined", userID => {
                // me guardo quien es el otro
                otherUser.current = userID;
            });

            // defino callback: me llego un offer 
            socketRef.current.on("offer", handleReceiveCall);

            // defino callback: me llego un answer 
            socketRef.current.on("answer", handleAnswer);

            // defino callback: me llego un ice-candidate 
            socketRef.current.on("ice-candidate", handleNewICECandidateMessage);
        });
    }, []);

    // funcion para dar acceso a mi audio y video
    function callUser(userID) {
        // creo un Peer para el nuevo user
        peerRef.current = createPeer(userID);
        // agrego las cosas de audio y video
        userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current));
    }

    // funcion para crear el peer de WebRTC
    function createPeer(userID) {
        const peer = new RTCPeerConnection({
            // esto son los servers que se encargan de abstraer
            // la configuracion de la red, firewalls y demas
            // y dejar que se establezca la conexion
            // para esto hay varios protocolos, en este caso usamos STUN y TURN
            iceServers: [
                {
                    urls: "stun:stun.stunprotocol.org" // server para el protocolo STUN
                },
                {
                    urls: "turn:numb.viagenie.ca", //server para el protocolo TURN
                    credential: "muazkh",
                    username: "webrtc@live.com"
                }
            ]
        });

        // defino callback: cuando hay un nuevo ice candidate
        // esto lo triggerea el browser automaticamente cuando lo necesita
        peer.onicecandidate = handleICECandidateEvent;
        // defino callback: esto se triggera cuando hay una conexion con el otro peer
        // osea, se debe intercambiar info con esto
        peer.ontrack = handleTrackEvent;
        // defino callback: esto es cuando arranca la negociacion de offer y answer
        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

        return peer;
    }

    // funcion para iniciar la negociacion
    function handleNegotiationNeededEvent(userID) {
        // creo un offer de WebRTC
        peerRef.current.createOffer().then(offer => {
            // le pone los datos locales, no es importante entenderlo
            return peerRef.current.setLocalDescription(offer);
        }).then(() => {
            const payload = {
                target: userID,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            };

            // envio al server la respuesta para que se la mande al otro
            // payload: quien soy y donde estoy, etc.
            socketRef.current.emit("offer", payload);
        }).catch(e => console.log(e));
    }

    // funcion para recibir una conexion
    async function handleReceiveCall(incoming) {
        peerRef.current = createPeer();
        // creo la sesion de WebRTC
        const desc = new RTCSessionDescription(incoming.sdp);
        // le pongo al peer sus datos
        await peerRef.current.setRemoteDescription(desc);
        userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current));
        // creo la respuesta de WebRTC
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);

        const payload = {
            target: incoming.caller,
            caller: socketRef.current.id,
            sdp: peerRef.current.localDescription
        };

        // envio al server la respuesta para que se la mande al otro
        // payload: quien soy y donde estoy, etc.
        socketRef.current.emit("answer", payload);
    }

    // funcion para cuando llega un answer
    async function handleAnswer(message) {
        // creo la sesion con los datos que me llegaron
        const desc = new RTCSessionDescription(message.sdp);
        try {
            // seteo la session a mi peer
            peerRef.current.setRemoteDescription(desc);
        } catch (e) {
            console.log(e);
        }
    }

    // funcion para cuando hay un ICE Candidate, lo triggerea el browser
    // e: ICE event
    async function handleICECandidateEvent(e) {
        if (e.candidate) {
            const payload = {
                target: otherUser.current,
                candidate: e.candidate
            };

            // envio el candidate al server para que se lo envie
            // al otro usuarios
            socketRef.current.emit("ice-candidate", payload);
        }
    }

    // funcion para cuando recibo un nuevo ICE Candidate
    // para la comunicacion WebRTC
    async function handleNewICECandidateMessage(incoming) {
        // creo el candidate de WebRTC
        const candidate = new RTCIceCandidate(incoming);

        try {
            // lo seteo al peer
            await peerRef.current.addIceCandidate(candidate);
        } catch (e) {
            console.log(e);
        }
    }

    // funcion para cuando ya hay conexion y se recibe stream de video
    // e: event de WebRTC
    function handleTrackEvent(e) {
        partnerVideo.current.srcObject = e.streams[0];
    }


    return (
        <div>
            <video autoPlay ref={userVideo}></video>
            <video autoPlay ref={partnerVideo}></video>
        </div>
    );
};

export default Room;