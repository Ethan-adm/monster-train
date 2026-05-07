function verifierInputs() {
    let pseudo = document.getElementById('pseudo').value;
    let roomCode = document.getElementById('room-code').value;

    if (pseudo === "" || roomCode === "") {
        alert("Veuillez entrer un pseudo et un code de salon !");
        return null;
    }
    return { pseudo, roomCode };
}

function creerPartie() {
    let data = verifierInputs();
    if (data) {
        window.location.href = `game.html?pseudo=${data.pseudo}&room=${data.roomCode}&action=create`;
    }
}

function rejoindrePartie() {
    let data = verifierInputs();
    if (data) {
        window.location.href = `game.html?pseudo=${data.pseudo}&room=${data.roomCode}&action=join`;
    }
}
