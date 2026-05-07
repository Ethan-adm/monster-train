const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const myPseudo = urlParams.get('pseudo');
const action = urlParams.get('action');

let peer; let networkConn;
let amIReady = false; let isEnemyReady = false;

document.getElementById('my-name').innerText = myPseudo;

if (action === 'create') {
    const hostId = 'monster-train-room-' + roomCode;
    peer = new Peer(hostId);
    document.getElementById('status-text').innerText = `En attente de l'adversaire... (Code: ${roomCode})`;
    peer.on('connection', (conn) => { networkConn = conn; configurerConnexion(); });
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
            enemyTrain.addWagon(data.label, true, 'combat'); // Masqué pour l'ennemi
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

    if (networkConn && networkConn.open) networkConn.send({ type: 'ready', state: amIReady });
    verifierLancement();
}

function verifierLancement() {
    if (amIReady && isEnemyReady) {
        document.getElementById('ready-screen').style.display = 'none';
        document.getElementById('game-content').style.display = 'block';
        demarrerPartie();
    }
}

// --- GESTION DU JEU ET DES DECKS ---
let deckCombat = []; let deckSoutien = []; let deckSabotage = [];
let mainDuJoueur = [];
let etapeGare = 1;
let carteDejaJoueePourCettePhase = false;
let tempsTotalPhase = 0; let tempsRestant = 0; let intervalTimer = null;

const parcours = {
    gare1: {x: 220, y: 80, r: 270}, coinTL: {x: 80, y: 80, r: 270},
    gare2: {x: 80, y: 180, r: 180}, gare3: {x: 80, y: 300, r: 180},
    gare4: {x: 80, y: 420, r: 180}, coinBL: {x: 80, y: 520, r: 180},
    gare5: {x: 220, y: 520, r: 90}, coinBR: {x: 360, y: 520, r: 90},
    combat5: {x: 360, y: 520, r: 0}, combat4: {x: 360, y: 420, r: 0},
    combat3: {x: 360, y: 320, r: 0}, combat2: {x: 360, y: 220, r: 0},
    combat1: {x: 360, y: 120, r: 0}, sortie: {x: 360, y: -60, r: 0} // La loco s'écarte complètement !
};

const enemyParcours = {
    gare1: {x: 580, y: 80, r: 90}, coinTL: {x: 720, y: 80, r: 90}, 
    gare2: {x: 720, y: 180, r: 180}, gare3: {x: 720, y: 300, r: 180},
    gare4: {x: 720, y: 420, r: 180}, coinBL: {x: 720, y: 520, r: 180},
    gare5: {x: 580, y: 520, r: 270}, coinBR: {x: 440, y: 520, r: 270},
    combat5: {x: 440, y: 520, r: 0}, combat4: {x: 440, y: 420, r: 0},
    combat3: {x: 440, y: 320, r: 0}, combat2: {x: 440, y: 220, r: 0},
    combat1: {x: 440, y: 120, r: 0}, sortie: {x: 440, y: -60, r: 0}
};

function placerElement(element, point) {
    element.style.left = (point.x - 30) + 'px';
    element.style.top = (point.y - 30) + 'px';
    element.style.transform = `rotate(${point.r}deg)`;
}

class TrainController {
    constructor(isPlayer) {
        this.isPlayer = isPlayer;
        this.loco = document.getElementById(isPlayer ? 'loco' : 'enemy-loco');
        this.wagons = []; this.history = []; this.path = isPlayer ? parcours : enemyParcours;
        this.targetSteps = []; this.timeoutId = null;
    }

    spawn() {
        this.loco.style.display = 'flex';
        placerElement(this.loco, this.path.gare1);
        this.history.push(this.path.gare1);
    }

    addWagon(label, isHidden, type) {
        let wagonDiv = document.createElement('div');
        wagonDiv.className = this.isPlayer ? `wagon-ingame type-${type}` : 'enemy-wagon-ingame';
        
        if (isHidden) {
            wagonDiv.innerText = "?";
            wagonDiv.dataset.realValue = label; 
            wagonDiv.dataset.realType = type;
        } else {
            wagonDiv.innerText = label;
        }
        
        document.getElementById('wagons-layer').appendChild(wagonDiv);
        let wPos = this.history[this.history.length - 1];
        placerElement(wagonDiv, wPos);
        this.wagons.unshift(wagonDiv);
    }

    moveToStation(stationNum, timeMs) {
        let etapes = [];
        if (stationNum === 2) etapes = [this.path.coinTL, this.path.gare2];
        else if (stationNum === 3) etapes = [this.path.gare3];
        else if (stationNum === 4) etapes = [this.path.gare4];
        else if (stationNum === 5) etapes = [this.path.coinBL, this.path.gare5];
        else if (stationNum === 6) etapes = [this.path.coinBR, this.path.combat5, this.path.combat4, this.path.combat3, this.path.combat2, this.path.combat1, this.path.sortie];

        this.targetSteps = etapes;
        this.executeSteps(timeMs / etapes.length);
    }

    executeSteps(timePerStep) {
        if (this.targetSteps.length === 0) return;
        let nextPos = this.targetSteps.shift();
        this.history.push(nextPos);

        this.loco.style.transition = `all ${timePerStep}ms linear`;
        placerElement(this.loco, nextPos);

        this.wagons.forEach((w, i) => {
            w.style.transition = `all ${timePerStep}ms linear`;
            let wPos = this.history[this.history.length - 2 - i];
            if(wPos) placerElement(w, wPos);
        });

        this.timeoutId = setTimeout(() => { this.executeSteps(timePerStep); }, timePerStep);
    }

    speedUp() {
        if (this.targetSteps.length === 0) return;
        this.loco.classList.add('flames');
        clearTimeout(this.timeoutId);

        let finalPos = this.targetSteps[this.targetSteps.length - 1];
        this.targetSteps = []; this.history.push(finalPos);

        this.loco.style.transition = `all 500ms cubic-bezier(0.25, 1, 0.5, 1)`;
        placerElement(this.loco, finalPos);

        this.wagons.forEach((w, i) => {
            w.style.transition = `all 500ms cubic-bezier(0.25, 1, 0.5, 1)`;
            let wPos = this.history[this.history.length - 2 - i];
            if(wPos) placerElement(w, wPos);
        });

        setTimeout(() => { this.loco.classList.remove('flames'); }, 500);
    }

    revealWagons() {
        this.wagons.forEach(w => {
            if (w.dataset.realValue) {
                w.innerText = w.dataset.realValue;
                w.className = `wagon-ingame type-${w.dataset.realType} reveal-anim`; // Prend sa vraie couleur !
            }
        });
    }
}

let playerTrain; let enemyTrain;

function creerDecksInitiaux() {
    for (let i = 1; i <= 60; i++) deckCombat.push({ id: `C${i}`, label: `${i}`, type: 'combat' });
    for (let i = 1; i <= 20; i++) deckSoutien.push({ id: `S${i}`, label: `S`, type: 'soutien' });
    for (let i = 1; i <= 20; i++) deckSabotage.push({ id: `X${i}`, label: `X`, type: 'sabotage' });
    
    deckCombat.sort(() => Math.random() - 0.5);
    deckSoutien.sort(() => Math.random() - 0.5);
    deckSabotage.sort(() => Math.random() - 0.5);
}

function demarrerPartie() {
    creerDecksInitiaux();
    playerTrain = new TrainController(true);
    enemyTrain = new TrainController(false);
    
    animerDistribution();
}

async function animerDistribution() {
    let cartesAPiocher = [
        ...deckCombat.splice(0, 8),
        ...deckSoutien.splice(0, 3),
        ...deckSabotage.splice(0, 3)
    ];

    document.getElementById('count-combat').innerText = deckCombat.length;
    document.getElementById('count-soutien').innerText = deckSoutien.length;
    document.getElementById('count-sabotage').innerText = deckSabotage.length;

    for (let i = 0; i < cartesAPiocher.length; i++) {
        let carte = cartesAPiocher[i];
        mainDuJoueur.push(carte);
        await creerAnimationCarte(carte);
    }

    afficherMain();
    lancerPhase(1);
}

function creerAnimationCarte(carte) {
    return new Promise(resolve => {
        let deckEl = document.getElementById(`deck-${carte.type}`);
        let rect = deckEl.getBoundingClientRect();
        
        let animDiv = document.createElement('div');
        animDiv.className = `carte type-${carte.type} anim-card`;
        animDiv.innerText = carte.label;
        animDiv.style.left = rect.left + 'px';
        animDiv.style.top = rect.top + 'px';
        
        document.getElementById('animation-layer').appendChild(animDiv);

        setTimeout(() => {
            // Vole au centre
            animDiv.style.left = '50%';
            animDiv.style.top = '30%';
            animDiv.style.transform = 'translate(-50%, -50%) scale(1.5)';
            
            setTimeout(() => {
                // Va dans la main (vers le bas)
                animDiv.style.left = '50%';
                animDiv.style.top = '90%';
                animDiv.style.transform = 'translate(-50%, 0) scale(0.5)';
                animDiv.style.opacity = '0';
                
                setTimeout(() => {
                    animDiv.remove();
                    resolve();
                }, 400);
            }, 600);
        }, 50);
    });
}

function afficherMain() {
    const handContainer = document.getElementById('hand-container');
    handContainer.innerHTML = ''; 
    mainDuJoueur.forEach(carte => { 
        let divCarte = document.createElement('div'); 
        divCarte.className = `carte type-${carte.type}`; 
        divCarte.innerText = carte.label; 
        divCarte.onclick = () => jouerCarte(carte.id); 
        handContainer.appendChild(divCarte); 
    }); 
}

function lancerPhase(numGare) {
    etapeGare = numGare; carteDejaJoueePourCettePhase = false;

    if (numGare === 1) {
        playerTrain.spawn(); enemyTrain.spawn();
        document.getElementById('instruction-text').innerText = "Gare 1 : Place ton 1er Wagon !";
        lancerTimer(20);
    } else if (numGare <= 5) {
        playerTrain.moveToStation(numGare, 10000); enemyTrain.moveToStation(numGare, 10000);
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
    tempsTotalPhase = secondes; tempsRestant = secondes;
    actualiserAffichageTimer();

    intervalTimer = setInterval(() => {
        tempsRestant--; actualiserAffichageTimer();

        if (tempsRestant <= 0) {
            clearInterval(intervalTimer);
            if (!carteDejaJoueePourCettePhase && mainDuJoueur.length > 0) {
                jouerCarte(mainDuJoueur[0].id); // Joue la 1ere carte auto si AFK
            }
            setTimeout(() => { lancerPhase(etapeGare + 1); }, 1000);
        }
    }, 1000);
}

function actualiserAffichageTimer() {
    let display = document.getElementById('timer-display');
    display.innerText = `⏳ ${tempsRestant}s`;
    if (tempsRestant <= 5) display.classList.add('timer-danger');
    else display.classList.remove('timer-danger');
}

function jouerCarte(idCarte) {
    if (etapeGare > 5 || carteDejaJoueePourCettePhase) return;
    carteDejaJoueePourCettePhase = true;

    let isFast = tempsRestant >= (tempsTotalPhase / 2);
    let index = mainDuJoueur.findIndex(c => c.id === idCarte);
    let carte = mainDuJoueur[index];
    
    mainDuJoueur.splice(index, 1);
    afficherMain();

    playerTrain.addWagon(carte.label, false, carte.type);
    if (isFast) playerTrain.speedUp();

    if (networkConn && networkConn.open) {
        networkConn.send({ type: 'card_played', etape: etapeGare, label: carte.label, fast: isFast, carteType: carte.type });
    }
}

function lancerCinematiqueCombat() {
    document.getElementById('phase-title').innerText = "⚔️ LE TRAIN ENTRE DANS L'ARÈNE ! ⚔️";
    playerTrain.moveToStation(6, 4000);
    enemyTrain.moveToStation(6, 4000);

    setTimeout(() => {
        // Force les positions finales exactes pour éviter tout bug d'affichage
        placerElement(playerTrain.loco, parcours.sortie);
        placerElement(enemyTrain.loco, enemyParcours.sortie);
        playerTrain.wagons.forEach((w, i) => placerElement(w, parcours[`combat${5-i}`]));
        enemyTrain.wagons.forEach((w, i) => placerElement(w, enemyParcours[`combat${5-i}`]));

        document.getElementById('phase-title').innerText = "⚔️ COMBAT FACE À FACE ⚔️";
        enemyTrain.revealWagons();
    }, 4500);
}
