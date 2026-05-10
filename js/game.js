const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const myPseudo = urlParams.get('pseudo');
const action = urlParams.get('action');

// --- VARIABLES GLOBALES DE JEU ---
let myScore = 0;
let enemyScore = 0;
let currentRound = 1;

let monDeckPersonnalise = []; // Le deck qu'on va construire
const LIMITES_ETOILES = { 1: 15, 2: 19, 3: 15, 4: 9, 5: 2 };
let compteurEtoiles = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

// --- 1. LOGIQUE DU DECK BUILDER ---
const exemplesCartes = [
    { genre: 'Fantasy', etoiles: 1 }, { genre: 'Fantasy', etoiles: 2 }, { genre: 'Fantasy', etoiles: 3 }, { genre: 'Fantasy', etoiles: 4 }, { genre: 'Fantasy', etoiles: 5 },
    { genre: 'Dragon', etoiles: 1 }, { genre: 'Dragon', etoiles: 2 }, { genre: 'Dragon', etoiles: 3 }, { genre: 'Dragon', etoiles: 4 }, { genre: 'Dragon', etoiles: 5 },
    { genre: 'Humain', etoiles: 1 }, { genre: 'Humain', etoiles: 2 }, { genre: 'Humain', etoiles: 3 }, { genre: 'Humain', etoiles: 4 }, { genre: 'Humain', etoiles: 5 }
];

function initDeckBuilder() {
    filtrerGenre('Fantasy'); // Affiche Fantasy par défaut
}

function filtrerGenre(genre) {
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';
    exemplesCartes.filter(c => c.genre === genre).forEach(carte => {
        let starsStr = '⭐'.repeat(carte.etoiles);
        let div = document.createElement('div');
        div.className = 'catalog-card';
        div.innerHTML = `<span>${carte.genre}</span><span class="stars">${starsStr}</span>`;
        div.onclick = () => ajouterAuDeck(carte);
        grid.appendChild(div);
    });
}

function ajouterAuDeck(carte) {
    if (monDeckPersonnalise.length >= 60) return alert("Deck complet ! (60/60)");
    if (compteurEtoiles[carte.etoiles] >= LIMITES_ETOILES[carte.etoiles]) {
        return alert(`Tu as atteint la limite de cartes ${carte.etoiles} étoiles !`);
    }

    monDeckPersonnalise.push({ ...carte, id: `C${monDeckPersonnalise.length}`, type: 'combat', label: `${carte.genre.substring(0,1)}${carte.etoiles}` });
    compteurEtoiles[carte.etoiles]++;
    actualiserUIBuilder();
}

function actualiserUIBuilder() {
    document.getElementById('deck-total-count').innerText = monDeckPersonnalise.length;
    
    for(let i=1; i<=5; i++) {
        let span = document.getElementById(`count-${i}star`);
        span.innerText = compteurEtoiles[i];
        if (compteurEtoiles[i] === LIMITES_ETOILES[i]) span.parentElement.classList.add('limit-reached');
    }

    let list = document.getElementById('my-deck-list');
    list.innerHTML = '';
    monDeckPersonnalise.forEach(c => {
        list.innerHTML += `<div>${c.genre} ${c.etoiles}⭐</div>`;
    });

    let btn = document.getElementById('validate-deck-btn');
    btn.innerText = `Valider le Deck (${monDeckPersonnalise.length}/60)`;
    btn.disabled = monDeckPersonnalise.length < 60; // DOIT ETRE A 60 POUR JOUER
}

function validerDeck() {
    document.getElementById('deck-builder-screen').style.display = 'none';
    document.getElementById('ready-screen').style.display = 'flex';
    initReseau(); // Lance la connexion PeerJS SEULEMENT après avoir fait le deck
}

window.onload = initDeckBuilder;

// --- 2. GESTION DU RÉSEAU (PeerJS) ---
let peer; let networkConn;
let amIReady = false; let isEnemyReady = false;

function initReseau() {
    document.getElementById('my-name').innerText = myPseudo;
    if (action === 'create') {
        const hostId = 'monster-train-room-' + roomCode;
        peer = new Peer(hostId);
        peer.on('connection', (conn) => { networkConn = conn; configurerConnexion(); });
    } else {
        peer = new Peer();
        peer.on('open', () => {
            const hostId = 'monster-train-room-' + roomCode;
            networkConn = peer.connect(hostId);
            configurerConnexion();
        });
    }
}

function configurerConnexion() {
    networkConn.on('open', () => {
        document.getElementById('status-text').innerText = "Connexion établie ! Appuie sur Prêt.";
        document.getElementById('ready-btn').disabled = false;
    });

    networkConn.on('data', (data) => {
        if (data.type === 'ready') {
            isEnemyReady = data.state;
            document.getElementById('enemy-ready-status').className = isEnemyReady ? "status-badge ready" : "status-badge not-ready";
            document.getElementById('enemy-ready-status').innerText = isEnemyReady ? "Prêt !" : "Pas Prêt";
            verifierLancement();
        }
        else if (data.type === 'card_played') {
            enemyTrain.addWagon(data.label, true, 'combat'); 
            if (data.fast) enemyTrain.speedUp();
        }
        else if (data.type === 'special_played') {
            let targetIsJoueur = !data.isTrainJoueur;
            ajouterBadgeVisuel(targetIsJoueur, data.index, { type: data.carteType, label: data.label });
        }
    });
}

function toggleReady() {
    amIReady = !amIReady;
    document.getElementById('my-ready-status').className = amIReady ? "status-badge ready" : "status-badge not-ready";
    document.getElementById('my-ready-status').innerText = amIReady ? "Prêt !" : "Pas Prêt";
    let btn = document.getElementById('ready-btn');
    btn.innerText = amIReady ? "Annuler" : "Je suis Prêt !";
    btn.style.backgroundColor = amIReady ? "#e74c3c" : "var(--secondary-teal)";
    if (networkConn && networkConn.open) networkConn.send({ type: 'ready', state: amIReady });
    verifierLancement();
}

function verifierLancement() {
    if (amIReady && isEnemyReady) {
        document.getElementById('ready-screen').style.display = 'none';
        document.getElementById('game-content').style.display = 'block';
        demarrerRound();
    }
}

// --- 3. LOGIQUE DES ROUNDS ET DU JEU ---
let deckCombat = []; let deckSoutien = []; let deckSabotage = [];
let mainDuJoueur = [];
let etapeGare = 1;
let phaseSoutienSabotage = false; 
let carteSelectionnee = null;
let carteDejaJoueePourCettePhase = false;
let tempsTotalPhase = 0; let tempsRestant = 0; let intervalTimer = null;

// (Parcours inchangés, je les omet ici pour la clarté, garde ceux du code précédent)
const parcours = { /*... garde les mêmes ...*/ gare1: {x: 220, y: 80, r: 270}, coinTL: {x: 80, y: 80, r: 270}, gare2: {x: 80, y: 180, r: 180}, gare3: {x: 80, y: 300, r: 180}, gare4: {x: 80, y: 420, r: 180}, coinBL: {x: 80, y: 520, r: 180}, gare5: {x: 220, y: 520, r: 90}, coinBR: {x: 360, y: 520, r: 90}, combat5: {x: 360, y: 520, r: 0}, combat4: {x: 360, y: 420, r: 0}, combat3: {x: 360, y: 320, r: 0}, combat2: {x: 360, y: 220, r: 0}, combat1: {x: 360, y: 120, r: 0}, sortie: {x: 360, y: -60, r: 0} };
const enemyParcours = { /*... garde les mêmes ...*/ gare1: {x: 580, y: 80, r: 90}, coinTL: {x: 720, y: 80, r: 90}, gare2: {x: 720, y: 180, r: 180}, gare3: {x: 720, y: 300, r: 180}, gare4: {x: 720, y: 420, r: 180}, coinBL: {x: 720, y: 520, r: 180}, gare5: {x: 580, y: 520, r: 270}, coinBR: {x: 440, y: 520, r: 270}, combat5: {x: 440, y: 520, r: 0}, combat4: {x: 440, y: 420, r: 0}, combat3: {x: 440, y: 320, r: 0}, combat2: {x: 440, y: 220, r: 0}, combat1: {x: 440, y: 120, r: 0}, sortie: {x: 440, y: -60, r: 0} };
function placerElement(element, point) { element.style.left = (point.x - 30) + 'px'; element.style.top = (point.y - 30) + 'px'; element.style.transform = `rotate(${point.r}deg)`; }

class TrainController {
    // ... Garde ta classe TrainController exacte du précédent message ...
    constructor(isPlayer) { this.isPlayer = isPlayer; this.loco = document.getElementById(isPlayer ? 'loco' : 'enemy-loco'); this.wagons = []; this.history = []; this.path = isPlayer ? parcours : enemyParcours; this.targetSteps = []; this.timeoutId = null; }
    spawn() { this.loco.style.display = 'flex'; placerElement(this.loco, this.path.gare1); this.history.push(this.path.gare1); }
    addWagon(label, isHidden, type) { let wagonDiv = document.createElement('div'); wagonDiv.className = this.isPlayer ? `wagon-ingame type-${type}` : 'enemy-wagon-ingame'; let indexWagon = this.wagons.length; wagonDiv.dataset.index = indexWagon; wagonDiv.onclick = () => clicSurWagon(this.isPlayer, indexWagon); if (isHidden) { wagonDiv.innerText = "?"; wagonDiv.dataset.realValue = label; wagonDiv.dataset.realType = type; } else { wagonDiv.innerText = label; } document.getElementById('wagons-layer').appendChild(wagonDiv); let wPos = this.history[this.history.length - 1]; placerElement(wagonDiv, wPos); this.wagons.unshift(wagonDiv); }
    moveToStation(stationNum, timeMs) { let etapes = []; if (stationNum === 2) etapes = [this.path.coinTL, this.path.gare2]; else if (stationNum === 3) etapes = [this.path.gare3]; else if (stationNum === 4) etapes = [this.path.gare4]; else if (stationNum === 5) etapes = [this.path.coinBL, this.path.gare5]; else if (stationNum === 6) etapes = [this.path.coinBR, this.path.combat5, this.path.combat4, this.path.combat3, this.path.combat2, this.path.combat1, this.path.sortie]; this.targetSteps = etapes; this.executeSteps(timeMs / etapes.length); }
    executeSteps(timePerStep) { if (this.targetSteps.length === 0) return; let nextPos = this.targetSteps.shift(); this.history.push(nextPos); this.loco.style.transition = `all ${timePerStep}ms linear`; placerElement(this.loco, nextPos); this.wagons.forEach((w, i) => { w.style.transition = `all ${timePerStep}ms linear`; let wPos = this.history[this.history.length - 2 - i]; if(wPos) placerElement(w, wPos); }); this.timeoutId = setTimeout(() => { this.executeSteps(timePerStep); }, timePerStep); }
    speedUp() { if (this.targetSteps.length === 0) return; this.loco.classList.add('flames'); clearTimeout(this.timeoutId); let finalPos = this.targetSteps[this.targetSteps.length - 1]; this.targetSteps = []; this.history.push(finalPos); this.loco.style.transition = `all 500ms cubic-bezier(0.25, 1, 0.5, 1)`; placerElement(this.loco, finalPos); this.wagons.forEach((w, i) => { w.style.transition = `all 500ms cubic-bezier(0.25, 1, 0.5, 1)`; let wPos = this.history[this.history.length - 2 - i]; if(wPos) placerElement(w, wPos); }); setTimeout(() => { this.loco.classList.remove('flames'); }, 500); }
    revealWagons() { this.wagons.forEach(w => { if (w.dataset.realValue) { w.innerText = w.dataset.realValue; w.className = `wagon-ingame type-${w.dataset.realType} reveal-anim`; } }); }
}

let playerTrain; let enemyTrain;

function demarrerRound() {
    if (currentRound > 7) return alert("Fin de la partie !");
    document.getElementById('round-number').innerText = currentRound;
    
    // On charge notre deck validé
    deckCombat = [...monDeckPersonnalise].sort(() => Math.random() - 0.5);
    deckSoutien = []; for(let i=1; i<=20; i++) deckSoutien.push({ id: `S${i}`, label: `S`, type: 'soutien' });
    deckSabotage = []; for(let i=1; i<=20; i++) deckSabotage.push({ id: `X${i}`, label: `X`, type: 'sabotage' });

    playerTrain = new TrainController(true);
    enemyTrain = new TrainController(false);
    
    // MALUS DU ROUND 3 (Si 2-0)
    let nombreCartesTirer = 8;
    if (currentRound === 3 && myScore === 2 && enemyScore === 0) {
        nombreCartesTirer = 6; // Malus pour le leader !
        alert("Attention : Tu mènes 2-0. Ta main est réduite à 6 cartes pour ce round !");
    }

    animerDistribution(nombreCartesTirer);
}

async function animerDistribution(nbCombat) {
    let cartesAPiocher = [
        ...deckCombat.splice(0, nbCombat),
        ...deckSoutien.splice(0, 3),
        ...deckSabotage.splice(0, 3)
    ];
    document.getElementById('count-combat').innerText = deckCombat.length;
    for (let i = 0; i < cartesAPiocher.length; i++) {
        mainDuJoueur.push(cartesAPiocher[i]);
        await creerAnimationCarte(cartesAPiocher[i]);
    }
    afficherMain(); lancerPhase(1);
}

// ... Garde les fonctions d'animation (creerAnimationCarte) et d'affichage (afficherMain) ...
function creerAnimationCarte(carte) { return new Promise(resolve => { let deckEl = document.getElementById(`deck-${carte.type}`); let rect = deckEl.getBoundingClientRect(); let animDiv = document.createElement('div'); animDiv.className = `carte type-${carte.type} anim-card`; animDiv.innerText = carte.label; animDiv.style.left = rect.left + 'px'; animDiv.style.top = rect.top + 'px'; document.getElementById('animation-layer').appendChild(animDiv); setTimeout(() => { animDiv.style.left = '50%'; animDiv.style.top = '30%'; animDiv.style.transform = 'translate(-50%, -50%) scale(1.5)'; setTimeout(() => { animDiv.style.left = '50%'; animDiv.style.top = '90%'; animDiv.style.transform = 'translate(-50%, 0) scale(0.5)'; animDiv.style.opacity = '0'; setTimeout(() => { animDiv.remove(); resolve(); }, 400); }, 600); }, 50); }); }
function afficherMain() { const handContainer = document.getElementById('hand-container'); handContainer.innerHTML = ''; mainDuJoueur.forEach(carte => { let divCarte = document.createElement('div'); divCarte.className = `carte type-${carte.type}`; divCarte.innerText = carte.label; if (!phaseSoutienSabotage && carte.type !== 'combat') { divCarte.classList.add('disabled-card'); } else if (phaseSoutienSabotage && carte.type === 'combat') { divCarte.classList.add('disabled-card'); } else if (carteSelectionnee && carteSelectionnee.id === carte.id) { divCarte.classList.add('selected-card'); } divCarte.onclick = () => selectionnerOuJouerCarte(carte); handContainer.appendChild(divCarte); }); }
function selectionnerOuJouerCarte(carte) { if (!phaseSoutienSabotage) { if (carte.type !== 'combat') return; jouerCarteMonstre(carte.id); } else { if (carte.type === 'combat') return; if (carteSelectionnee && carteSelectionnee.id === carte.id) { carteSelectionnee = null; } else { carteSelectionnee = carte; } afficherMain(); } }
function jouerCarteMonstre(idCarte) { if (etapeGare > 5 || carteDejaJoueePourCettePhase) return; carteDejaJoueePourCettePhase = true; let isFast = tempsRestant >= (tempsTotalPhase / 2); let index = mainDuJoueur.findIndex(c => c.id === idCarte); let carte = mainDuJoueur[index]; mainDuJoueur.splice(index, 1); afficherMain(); playerTrain.addWagon(carte.label, false, carte.type); if (isFast) playerTrain.speedUp(); if (networkConn && networkConn.open) { networkConn.send({ type: 'card_played', etape: etapeGare, label: carte.label, fast: isFast, carteType: carte.type }); } }
function clicSurWagon(isTrainJoueur, indexWagon) { if (!phaseSoutienSabotage || !carteSelectionnee) return; if (carteSelectionnee.type === 'soutien' && isTrainJoueur) { placerCarteSpeciale(isTrainJoueur, indexWagon, carteSelectionnee); } else if (carteSelectionnee.type === 'sabotage' && !isTrainJoueur) { placerCarteSpeciale(isTrainJoueur, indexWagon, carteSelectionnee); } }
function placerCarteSpeciale(isTrainJoueur, indexWagon, carte) { let index = mainDuJoueur.findIndex(c => c.id === carte.id); mainDuJoueur.splice(index, 1); carteSelectionnee = null; afficherMain(); ajouterBadgeVisuel(isTrainJoueur, indexWagon, carte); if (networkConn && networkConn.open) { networkConn.send({ type: 'special_played', isTrainJoueur: isTrainJoueur, index: indexWagon, carteType: carte.type, label: carte.label }); } }
function ajouterBadgeVisuel(isTrainJoueur, indexWagon, carte) { let train = isTrainJoueur ? playerTrain : enemyTrain; let wagonDiv = train.wagons.find(w => w.dataset.index == indexWagon); if (!wagonDiv) return; let badge = document.createElement('div'); badge.className = `badge-${carte.type}`; badge.innerText = carte.label; wagonDiv.appendChild(badge); }

function lancerPhase(numGare) { etapeGare = numGare; carteDejaJoueePourCettePhase = false; if (numGare === 1) { playerTrain.spawn(); enemyTrain.spawn(); document.getElementById('instruction-text').innerText = "Gare 1 : Place ton 1er Wagon !"; lancerTimer(20); } else if (numGare <= 5) { playerTrain.moveToStation(numGare, 10000); enemyTrain.moveToStation(numGare, 10000); document.getElementById('instruction-text').innerText = `Gare ${numGare} : En route !`; lancerTimer(10); } else { document.getElementById('instruction-text').innerText = "Attachez vos ceintures..."; document.getElementById('timer-display').style.display = 'none'; setTimeout(lancerCinematiqueCombat, 1000); } }
function lancerTimer(secondes) { clearInterval(intervalTimer); tempsTotalPhase = secondes; tempsRestant = secondes; actualiserAffichageTimer(); intervalTimer = setInterval(() => { tempsRestant--; actualiserAffichageTimer(); if (tempsRestant <= 0) { clearInterval(intervalTimer); if (phaseSoutienSabotage) { terminerPhaseSpeciale(); } else { if (!carteDejaJoueePourCettePhase) jouerCarteAleatoire(); setTimeout(() => { lancerPhase(etapeGare + 1); }, 1000); } } }, 1000); }
function actualiserAffichageTimer() { let display = document.getElementById('timer-display'); display.innerText = `⏳ ${tempsRestant}s`; if (tempsRestant <= 5) display.classList.add('timer-danger'); else display.classList.remove('timer-danger'); }
function jouerCarteAleatoire() { let cartesCombatEnMain = mainDuJoueur.filter(c => c.type === 'combat'); if (cartesCombatEnMain.length > 0) { jouerCarteMonstre(cartesCombatEnMain[0].id); } }

function lancerCinematiqueCombat() {
    document.getElementById('phase-title').innerText = "⚔️ LE TRAIN ENTRE DANS L'ARÈNE ! ⚔️";
    playerTrain.moveToStation(6, 4000); enemyTrain.moveToStation(6, 4000);
    setTimeout(() => {
        placerElement(playerTrain.loco, parcours.sortie); placerElement(enemyTrain.loco, enemyParcours.sortie);
        playerTrain.wagons.forEach((w, i) => placerElement(w, parcours[`combat${5-i}`]));
        enemyTrain.wagons.forEach((w, i) => placerElement(w, enemyParcours[`combat${5-i}`]));
        demarrerPhaseSoutienSabotage();
    }, 4500);
}

function demarrerPhaseSoutienSabotage() {
    phaseSoutienSabotage = true;
    document.getElementById('phase-title').innerText = "✨ SOUTIEN & SABOTAGE ✨";
    document.getElementById('instruction-text').innerText = "Place ton Soutien sur TOI, et ton Sabotage sur L'ENNEMI !";
    document.getElementById('timer-display').style.display = 'block';
    afficherMain(); lancerTimer(25);
}

function terminerPhaseSpeciale() {
    phaseSoutienSabotage = false; carteSelectionnee = null; afficherMain();
    document.getElementById('phase-title').innerText = "⚔️ COMBAT FACE À FACE ⚔️";
    document.getElementById('instruction-text').innerText = "Que le meilleur gagne !";
    document.getElementById('timer-display').style.display = 'none';
    enemyTrain.revealWagons();
    
    // Note : C'est ici que tu devras intégrer le calcul des points d'attaque/défense plus tard
    // Pour l'instant, on prépare le terrain pour le Round 2.
}
