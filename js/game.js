// --- GESTION DU RÉSEAU (PeerJS) ---
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const myPseudo = urlParams.get('pseudo');
const action = urlParams.get('action');

let peer;
let networkConn;
let amIReady = false;
let isEnemyReady = false;

document.getElementById('my-name').innerText = myPseudo;

if (action === 'create') {
    const hostId = 'monster-train-room-' + roomCode;
    peer = new Peer(hostId);
    document.getElementById('status-text').innerText = `En attente de l'adversaire... (Code: ${roomCode})`;
    peer.on('connection', (conn) => {
        networkConn = conn;
        configurerConnexion();
    });
} else {
    peer = new Peer();
    peer.on('open', () => {
        document.getElementById('status-text').innerText = `Recherche du salon ${roomCode}...`;
        const hostId = 'monster-train-room-' + roomCode;
        networkConn = peer.connect(hostId);
        configurerConnexion();
    });
}

function configurerConnexion() {
    networkConn.on('open', () => {
        document.getElementById('status-text').innerText = "Connexion établie ! Appuie sur Prêt.";
        document.getElementById('ready-btn').disabled = false;
    });

    networkConn.on('data', (data) => {
        if (data.type === 'ready') {
            isEnemyReady = data.state;
            let badge = document.getElementById('enemy-ready-status');
            badge.innerText = isEnemyReady ? "Prêt !" : "Pas Prêt";
            badge.className = isEnemyReady ? "status-badge ready" : "status-badge not-ready";
            verifierLancement();
        }
        else if (data.type === 'card_played') {
            // L'ennemi a joué ! On met une carte cachée (true) et on la fait avancer
            enemyTrain.addWagon(data.label, true);
            if (data.fast) enemyTrain.speedUp();
        }
    });
}

function toggleReady() {
    amIReady = !amIReady;
    let badge = document.getElementById('my-ready-status');
    let btn = document.getElementById('ready-btn');

    badge.innerText = amIReady ? "Prêt !" : "Pas Prêt";
    badge.className = amIReady ? "status-badge ready" : "status-badge not-ready";
    btn.innerText = amIReady ? "Annuler" : "Je suis Prêt !";
    btn.style.backgroundColor = amIReady ? "#e74c3c" : "var(--secondary-teal)";

    if (networkConn && networkConn.open) {
        networkConn.send({ type: 'ready', state: amIReady });
    }
    verifierLancement();
}

function verifierLancement() {
    if (amIReady && isEnemyReady) {
        document.getElementById('ready-screen').style.display = 'none';
        document.getElementById('game-content').style.display = 'block';
        demarrerPartie();
    }
}

// --- GESTION DU JEU ---
let deckDuJoueur = [];
let mainDuJoueur = [];
let etapeGare = 1;
let carteDejaJoueePourCettePhase = false;

let tempsTotalPhase = 0;
let tempsRestant = 0;
let intervalTimer = null;

// Le circuit exact du Joueur (gauche)
const parcours = {
    gare1: {x: 220, y: 80, r: 270},
    coinTL: {x: 80, y: 80, r: 270},
    gare2: {x: 80, y: 180, r: 180},
    gare3: {x: 80, y: 300, r: 180},
    gare4: {x: 80, y: 420, r: 180},
    coinBL: {x: 80, y: 520, r: 180},
    gare5: {x: 220, y: 520, r: 90},
    coinBR: {x: 360, y: 520, r: 90},
    combat5: {x: 360, y: 520, r: 0},
    combat4: {x: 360, y: 420, r: 0},
    combat3: {x: 360, y: 320, r: 0},
    combat2: {x: 360, y: 220, r: 0},
    combat1: {x: 360, y: 120, r: 0}
};

// Le circuit exact de l'Ennemi (miroir à droite)
const enemyParcours = {
    gare1: {x: 580, y: 80, r: 90},
    coinTL: {x: 720, y: 80, r: 90}, 
    gare2: {x: 720, y: 180, r: 180},
    gare3: {x: 720, y: 300, r: 180},
    gare4: {x: 720, y: 420, r: 180},
    coinBL: {x: 720, y: 520, r: 180},
    gare5: {x: 580, y: 520, r: 270},
    coinBR: {x: 440, y: 520, r: 270},
    combat5: {x: 440, y: 520, r: 0},
    combat4: {x: 440, y: 420, r: 0},
    combat3: {x: 440, y: 320, r: 0},
    combat2: {x: 440, y: 220, r: 0},
    combat1: {x: 440, y: 120, r: 0}
};

function placerElement(element, point) {
    element.style.left = (point.x - 30) + 'px';
    element.style.top = (point.y - 30) + 'px';
    element.style.transform = `rotate(${point.r}deg)`;
}

// L'Intelligence qui gère chaque Train
class TrainController {
    constructor(isPlayer) {
        this.isPlayer = isPlayer;
        this.loco = document.getElementById(isPlayer ? 'loco' : 'enemy-loco');
        this.wagons = [];
        this.history = [];
        this.path = isPlayer ? parcours : enemyParcours;
        this.targetSteps = [];
        this.timeoutId = null;
    }

    spawn() {
        this.loco.style.display = 'flex';
        placerElement(this.loco, this.path.gare1);
        this.history.push(this.path.gare1);
    }

    addWagon(label, isHidden) {
        let wagonDiv = document.createElement('div');
        wagonDiv.className = this.isPlayer ? 'wagon-ingame' : 'enemy-wagon-ingame';
        
        if (isHidden) {
            wagonDiv.innerText = "?";
            wagonDiv.dataset.realValue = label; // On cache la valeur pour plus tard !
        } else {
            wagonDiv.innerText = label;
        }
        
        document.getElementById('wagons-layer').appendChild(wagonDiv);
        
        let wPos = this.history[this.history.length - 1];
        placerElement(wagonDiv, wPos);
        this.wagons.unshift(wagonDiv); // S'attache derrière
    }

    moveToStation(stationNum, timeMs) {
        let etapes = [];
        if (stationNum === 2) etapes = [this.path.coinTL, this.path.gare2];
        else if (stationNum === 3) etapes = [this.path.gare3];
        else if (stationNum === 4) etapes = [this.path.gare4];
        else if (stationNum === 5) etapes = [this.path.coinBL, this.path.gare5];
        else if (stationNum === 6) etapes = [this.path.coinBR, this.path.combat5, this.path.combat4, this.path.combat3, this.path.combat2, this.path.combat1];

        this.targetSteps = etapes;
        this.executeSteps(timeMs / etapes.length);
    }

    executeSteps(timePerStep) {
        if (this.targetSteps.length === 0) return;

        let nextPos = this.targetSteps.shift();
        this.history.push(nextPos);

        // Animation fluide CSS
        this.loco.style.transition = `all ${timePerStep}ms linear`;
        placerElement(this.loco, nextPos);

        this.wagons.forEach((w, i) => {
            w.style.transition = `all ${timePerStep}ms linear`;
            let wPos = this.history[this.history.length - 2 - i];
            if(wPos) placerElement(w, wPos);
        });

        this.timeoutId = setTimeout(() => {
            this.executeSteps(timePerStep);
        }, timePerStep);
    }

    speedUp() {
        if (this.targetSteps.length === 0) return;
        
        this.loco.classList.add('flames'); // Ajoute le feu !
        clearTimeout(this.timeoutId);

        // On téléporte à la dernière étape très vite
        let finalPos = this.targetSteps[this.targetSteps.length - 1];
        this.targetSteps = []; 
        this.history.push(finalPos);

        this.loco.style.transition = `all 500ms cubic-bezier(0.25, 1, 0.5, 1)`;
        placerElement(this.loco, finalPos);

        this.wagons.forEach((w, i) => {
            w.style.transition = `all 500ms cubic-bezier(0.25, 1, 0.5, 1)`;
            let wPos = this.history[this.history.length - 2 - i];
            if(wPos) placerElement(w, wPos);
        });

        setTimeout(() => {
            this.loco.classList.remove('flames');
        }, 500);
    }

    revealWagons() {
        this.wagons.forEach(w => {
            if (w.dataset.realValue) {
                w.innerText = w.dataset.realValue;
                w.classList.add('reveal-anim');
            }
        });
    }
}

let playerTrain;
let enemyTrain;

function demarrerPartie() {
    deckDuJoueur = melangerDeck(creerDeck());
    mainDuJoueur = deckDuJoueur.splice(0, 8);
    document.getElementById('deck-count').innerText = deckDuJoueur.length;
    
    playerTrain = new TrainController(true);
    enemyTrain = new TrainController(false);
    
    afficherMain();
    lancerPhase(1);
}

function lancerPhase(numGare) {
    etapeGare = numGare;
    carteDejaJoueePourCettePhase = false;

    if (numGare === 1) {
        playerTrain.spawn();
        enemyTrain.spawn();
        document.getElementById('instruction-text').innerText = "Gare 1 : Fais vite !";
        lancerTimer(20);
    } else if (numGare <= 5) {
        // Le train avance PENDANT le timer de 10s
        playerTrain.moveToStation(numGare, 10000);
        enemyTrain.moveToStation(numGare, 10000);
        document.getElementById('instruction-text').innerText = `Gare ${numGare} : En route !`;
        lancerTimer(10);
    } else {
        document.getElementById('instruction-text').innerText = "Attachez vos ceintures...";
        document.getElementById('timer-display').style.display = 'none';
        setTimeout(lancerCinematiqueCombat, 1000);
    }
}

function lancerTimer(secondes) {
    clearInterval(intervalTimer);
    tempsTotalPhase = secondes;
    tempsRestant = secondes;
    actualiserAffichageTimer();

    intervalTimer = setInterval(() => {
        tempsRestant--;
        actualiserAffichageTimer();

        if (tempsRestant <= 0) {
            clearInterval(intervalTimer);
            if (!carteDejaJoueePourCettePhase) {
                jouerCarteAleatoire(); // Joue auto si pas décidé
            }
            // Attend 1 seconde avant de lancer la gare suivante
            setTimeout(() => { lancerPhase(etapeGare + 1); }, 1000);
        }
    }, 1000);
}

function jouerCarte(idCarte) {
    if (etapeGare > 5 || carteDejaJoueePourCettePhase) return;
    carteDejaJoueePourCettePhase = true;

    // Si on joue dans la première moitié du chrono = BOOST FLAMMES
    let isFast = tempsRestant >= (tempsTotalPhase / 2);

    let index = mainDuJoueur.findIndex(c => c.id === idCarte);
    let carte = mainDuJoueur[index];
    mainDuJoueur.splice(index, 1);
    afficherMain();

    playerTrain.addWagon(carte.label, false);
    if (isFast) playerTrain.speedUp();

    if (networkConn && networkConn.open) {
        networkConn.send({ type: 'card_played', etape: etapeGare, label: carte.label, fast: isFast });
    }
}

// ... Les autres fonctions inchangées ...
function creerDeck() { let deck = []; for (let i = 1; i <= 60; i++) deck.push({ id: i, label: `${i}` }); return deck; }
function melangerDeck(deck) { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } return deck; }
function afficherMain() { const handContainer = document.getElementById('hand-container'); handContainer.innerHTML = ''; mainDuJoueur.forEach(carte => { let divCarte = document.createElement('div'); divCarte.className = 'carte'; divCarte.innerText = carte.label; divCarte.onclick = () => jouerCarte(carte.id); handContainer.appendChild(divCarte); }); }
function actualiserAffichageTimer() { let display = document.getElementById('timer-display'); display.innerText = `⏳ ${tempsRestant}s`; if (tempsRestant <= 5) { display.classList.add('timer-danger'); } else { display.classList.remove('timer-danger'); } }
function jouerCarteAleatoire() { if (mainDuJoueur.length > 0) { let indexAleatoire = Math.floor(Math.random() * mainDuJoueur.length); jouerCarte(mainDuJoueur[indexAleatoire].id); } }

function lancerCinematiqueCombat() {
    document.getElementById('phase-title').innerText = "⚔️ LE TRAIN ENTRE DANS L'ARÈNE ! ⚔️";
    
    // Remonte au centre en 4 secondes
    playerTrain.moveToStation(6, 4000);
    enemyTrain.moveToStation(6, 4000);

    setTimeout(() => {
        document.getElementById('phase-title').innerText = "⚔️ COMBAT FACE À FACE ⚔️";
        // Révélation dramatique des cartes ennemies !
        enemyTrain.revealWagons();
    }, 4500);
}
