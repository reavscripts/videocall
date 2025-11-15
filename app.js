document.addEventListener('DOMContentLoaded', () => {
    const nicknameOverlay = document.getElementById('nickname-overlay');
    const nicknameInput = document.getElementById('nickname-input');
    const joinButton = document.getElementById('join-button');
    const conferenceContainer = document.getElementById('conference-container');
    const localVideo = document.getElementById('local-video');
    const participantsList = document.getElementById('participants-list');
    
    let userNickname = 'Ospite';

    joinButton.addEventListener('click', () => {
        const nickname = nicknameInput.value.trim();
        if (nickname) {
            userNickname = nickname;
            nicknameOverlay.classList.add('hidden');
            conferenceContainer.classList.remove('hidden');
            
            // Avvia la webcam e il microfono
            startLocalMedia();
            
            // Aggiunge il proprio nickname alla lista
            addParticipant(userNickname + " (Tu)");
            
            // Qui andrebbe la logica WebRTC per connettersi al server di segnalazione
            console.log(`Utente ${userNickname} entrato nella conferenza.`);
        } else {
            alert('Per favore, inserisci un nickname.');
        }
    });

    // Funzione per avviare la webcam e il microfono
    async function startLocalMedia() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = stream;
            // Qui WebRTC aggiunge lo stream alla RTCPeerConnection
        } catch (error) {
            console.error('Errore nell\'accesso ai media (Webcam/Mic):', error);
            alert('Impossibile accedere alla webcam e al microfono. Controlla i permessi.');
        }
    }

    // Funzione per aggiungere un partecipante alla lista
    function addParticipant(name) {
        const listItem = document.createElement('li');
        listItem.textContent = name;
        participantsList.appendChild(listItem);
    }

    // Qui andrebbe tutta la logica WebRTC (RTCPeerConnection, Signaling, STUN/TURN)
});