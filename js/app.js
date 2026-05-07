function rejoindrePartie() {
    let pseudo = document.getElementById('pseudo').value;
    let roomCode = document.getElementById('room-code').value;

    if (pseudo === "") {
        alert("Veuillez entrer un pseudo !");
        return;
    }

    // Pour l'instant, on redirige vers game.html
    // En multijoueur réel, on enverrait une requête au serveur ici
    window.location.href = `game.html?pseudo=${pseudo}&room=${roomCode}`;
}
