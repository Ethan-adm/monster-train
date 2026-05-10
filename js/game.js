const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const myPseudo = urlParams.get('pseudo');
const action = urlParams.get('action');

let myScore = 0; let enemyScore = 0; let currentRound = 1;
let enemyPseudo = "Adversaire";
let monDeckPersonnalise = [];
const LIMITES_ETOILES = { 1: 15, 2: 19, 3: 15, 4: 9, 5: 2 };
let compteurEtoiles = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const GENRES = ['Humain', 'Dragon', 'Fantasy', 'Dark fantasy', 'Mythologie', 'Légende urbaine', 'Apocalypse', 'Aztec'];

// --- PROBABILITÉS EXACTES DE TON TABLEAU ---
const PROBAS_ROUND = {
    1: { 1: 0.60, 2: 0.30, 3: 0.10, 4: 0, 5: 0 },
    2: { 1: 0.40, 2: 0.35, 3: 0.25, 4: 0, 5: 0 },
    3: { 1: 0.20, 2: 0.40, 3: 0.30, 4: 0.10, 5: 0 },
    4: { 1: 0.10, 2: 0.25, 3: 0.40, 4: 0.25, 5: 0 },
    5: { 1: 0, 2: 0.20, 3: 0.35, 4: 0.35, 5: 0.10 },
    6: { 1: 0, 2: 0, 3: 0.30, 4: 0.45, 5: 0.25 },
    7: { 1: 0, 2: 0, 3: 0.25, 4: 0.35, 5: 0.40 }
};

let catalogueComplet = [];
function genererCatalogue() {
    GENRES.forEach(g => { for(let e=1; e<=5; e++) catalogueComplet.push({ genre: g, etoiles: e }); });
}

function initDeckBuilder() { genererCatalogue(); filtrerGenre('Humain'); }

function filtrerGenre(genre) {
    const grid = document.getElementById('catalog-grid'); grid.innerHTML = '';
    catalogueComplet.filter(c => c.genre === genre).forEach(carte => {
        let div = document.createElement('div'); div.className = 'catalog-card';
        div.innerHTML = `<span>${carte.genre}</span><span class="stars">${'⭐'.repeat(carte.etoiles)}</span>`;
        div.onclick = () => ajouterAuDeck(carte); grid.appendChild(div);
    });
}

function ajouterAuDeck(carte) {
    if (monDeckPersonnalise.length >= 60) return alert("Deck complet !");
    if (compteurEtoiles[carte.etoiles] >= LIMITES_ETOILES[carte.etoiles]) return;
    monDeckPersonnalise.push({ ...carte, id: `C${Math.random()}`, type: 'combat' });
    compteurEtoiles[carte.etoiles]++; actualiserUIBuilder();
}

function actualiserUIBuilder() {
    document.getElementById('deck-total-count').innerText = monDeckPersonnalise.length;
    for(let i=1; i<=5; i++) {
        document.getElementById(`count-${i}star`).innerText = compteurEtoiles[i];
        if (compteurEtoiles[i] === LIMITES_ETOILES[i]) document.getElementById(`p-limit-${i}`).classList.add('limit-reached');
    }
    let list = document.getElementById('my-deck-list'); list.innerHTML = '';
    monDeckPersonnalise.forEach(c => { list.innerHTML += `<div><span>${c.genre}</span> <span>${'⭐'.repeat(c.etoiles)}</span></div>`; });
    let btn = document.getElementById('validate-deck-btn'); btn.innerText = `Valider (${monDeckPersonnalise.length}/60)`;
    btn.disabled = monDeckPersonnalise.length < 60;
}

function validerDeck() {
    document.getElementById('deck-builder-screen').style.display = 'none';
    document.getElementById('ready-screen').style.display = 'flex';
    initReseau();
}
window.onload = initDeckBuilder;

// --- RESEAU ---
let peer; let networkConn; let amIReady = false; let isEnemyReady = false;
let isEnemyReadyForCombat = false; // Barrière de synchro finale

function initReseau() {
    document.getElementById('my-name').innerText = myPseudo; document.getElementById('my-name-score').innerText = myPseudo;
    if (action === 'create') {
        peer = new Peer('monster-train-room-' + roomCode);
        peer.on('connection', (conn) => { networkConn = conn; configurerConnexion(); });
    } else {
        peer = new Peer();
        peer.on('open', () => { networkConn = peer.connect('monster-train-room-' + roomCode); configurerConnexion(); });
    }
}

function configurerConnexion() {
    networkConn.on('open', () => {
        document.getElementById('status-text').innerText = "Connexion établie !";
        document.getElementById('ready-btn').disabled = false;
        networkConn.send({ type: 'hello', pseudo: myPseudo });
    });
    networkConn.on('data', (data) => {
        if (data.type === 'hello') {
            enemyPseudo = data.pseudo; document.getElementById('enemy-name-ready').innerText = enemyPseudo; document.getElementById('enemy-name-score').innerText = enemyPseudo;
        } else if (data.type === 'ready') {
            isEnemyReady = data.state;
            document.getElementById('enemy-ready-status').className = isEnemyReady ? "status-badge ready" : "status-badge not-ready";
            document.getElementById('enemy-ready-status').innerText = isEnemyReady ? "Prêt !" : "Pas Prêt";
            verifierLancement();
        } else if (data.type === 'card_played') {
            enemyTrain.addWagon(data.carteObj, true, 'combat', data.etape); 
        } else if (data.type === 'special_played') {
            // Reçu de l'ennemi = badge complètement CACHÉ
            ajouterBadgeSoutienSabotage(false, data.index, data.carteObj, true);
        } else if (data.type === 'ready_for_combat') {
            // BARRIÈRE DE SYNCHRO : L'ennemi a fini ses 25s
            isEnemyReadyForCombat = true;
            verifierSiLesDeuxSontPretsPourCombat();
        }
    });
}

function toggleReady() {
    amIReady = !amIReady;
    document.getElementById('my-ready-status').className = amIReady ? "status-badge ready" : "status-badge not-ready";
    document.getElementById('my-ready-status').innerText = amIReady ? "Prêt !" : "Pas Prêt";
    let btn = document.getElementById('ready-btn'); btn.innerText = amIReady ? "Annuler" : "Je suis Prêt !";
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

// --- JEU ---
let deckCombat = []; let deckSoutien = []; let deckSabotage = []; let mainDuJoueur = [];
let etapeGare = 1; let phaseSoutienSabotage = false; let carteSelectionnee = null;
let carteDejaJoueePourCettePhase = false; let tempsTotalPhase = 0; let tempsRestant = 0; let intervalTimer = null;
let amIReadyForCombat = false; // Ma barrière de synchro

const parcours = { gare1: {x: 220, y: 80, r: 270}, coinTL: {x: 80, y: 80, r: 270}, gare2: {x: 80, y: 180, r: 180}, gare3: {x: 80, y: 300, r: 180}, gare4: {x: 80, y: 420, r: 180}, coinBL: {x: 80, y: 520, r: 180}, gare5: {x: 220, y: 520, r: 90}, coinBR: {x: 360, y: 520, r: 90}, combat5: {x: 360, y: 520, r: 0}, combat4: {x: 360, y: 420, r: 0}, combat3: {x: 360, y: 320, r: 0}, combat2: {x: 360, y: 220, r: 0}, combat1: {x: 360, y: 120, r: 0}, sortie: {x: 360, y: -100, r: 0} };
const enemyParcours = { gare1: {x: 580, y: 80, r: 90}, coinTL: {x: 720, y: 80, r: 90}, gare2: {x: 720, y: 180, r: 180}, gare3: {x: 720, y: 300, r: 180}, gare4: {x: 720, y: 420, r: 180}, coinBL: {x: 720, y: 520, r: 180}, gare5: {x: 580, y: 520, r: 270}, coinBR: {x: 440, y: 520, r: 270}, combat5: {x: 440, y: 520, r: 0}, combat4: {x: 440, y: 420, r: 0}, combat3: {x: 440, y: 320, r: 0}, combat2: {x: 440, y: 220, r: 0}, combat1: {x: 440, y: 120, r: 0}, sortie: {x: 440, y: -100, r: 0} };

function placerElement(element, point, isLoco = false) { 
    element.style.left = (point.x - 30) + 'px'; element.style.top = (point.y - 30) + 'px'; 
    if(isLoco) element.style.transform = `rotate(${point.r}deg)`; 
    else element.style.transform = `rotate(0deg)`; // CARTES TOUJOURS DROITES
}

// Algorithme de mélange propre
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

class TrainController {
    constructor(isPlayer) { this.isPlayer = isPlayer; this.loco = document.getElementById(isPlayer ? 'loco' : 'enemy-loco'); this.wagons = []; this.history = []; this.path = isPlayer ? parcours : enemyParcours; this.targetSteps = []; this.timeoutId = null; }
    spawn() { this.loco.style.display = 'flex'; this.loco.style.opacity = 1; placerElement(this.loco, this.path.gare1, true); this.history.push(this.path.gare1); }
    addWagon(carteObj, isHidden, type, numGare) { 
        let wagonDiv = document.createElement('div'); wagonDiv.className = this.isPlayer ? `wagon-ingame type-${type}` : 'enemy-wagon-ingame'; 
        wagonDiv.dataset.gare = numGare; wagonDiv.onclick = () => clicSurWagon(this.isPlayer, numGare); 
        
        if (isHidden) { 
            wagonDiv.innerText = "?"; wagonDiv.dataset.realGenre = carteObj.genre; wagonDiv.dataset.realEtoiles = carteObj.etoiles; wagonDiv.dataset.realType = type; 
        } else { 
            wagonDiv.innerHTML = `<span class="card-genre">${carteObj.genre}</span><span class="card-stars">${'⭐'.repeat(carteObj.etoiles)}</span>`;
            wagonDiv.dataset.stars = carteObj.etoiles; 
        } 
        document.getElementById('wagons-layer').appendChild(wagonDiv); 
        placerElement(wagonDiv, this.history[this.history.length - 1]); 
        this.wagons.push(wagonDiv); 
    }
    moveToStation(stationNum, timeMs) { let etapes = []; if (stationNum === 2) etapes = [this.path.coinTL, this.path.gare2]; else if (stationNum === 3) etapes = [this.path.gare3]; else if (stationNum === 4) etapes = [this.path.gare4]; else if (stationNum === 5) etapes = [this.path.coinBL, this.path.gare5]; else if (stationNum === 6) etapes = [this.path.coinBR, this.path.combat5, this.path.combat4, this.path.combat3, this.path.combat2, this.path.combat1]; this.targetSteps = etapes; this.executeSteps(timeMs / etapes.length); }
    executeSteps(timePerStep) { if (this.targetSteps.length === 0) return; let nextPos = this.targetSteps.shift(); this.history.push(nextPos); this.loco.style.transition = `all ${timePerStep}ms linear`; placerElement(this.loco, nextPos, true); this.wagons.forEach((w, i) => { w.style.transition = `all ${timePerStep}ms linear`; let wPos = this.history[this.history.length - 1 - this.wagons.length + i]; if(wPos) placerElement(w, wPos); }); this.timeoutId = setTimeout(() => { this.executeSteps(timePerStep); }, timePerStep); }
    
    revealWagons() { 
        this.wagons.forEach(w => { 
            if (w.dataset.realGenre) { 
                w.innerHTML = `<span class="card-genre">${w.dataset.realGenre}</span><span class="card-stars">${'⭐'.repeat(w.dataset.realEtoiles)}</span>`; w.className = `wagon-ingame type-${w.dataset.realType} reveal-anim`; w.dataset.stars = w.dataset.realEtoiles; 
            } 
            w.querySelectorAll('.badge-hidden').forEach(b => { b.classList.remove('badge-hidden'); w.dataset.badgeMod = b.classList.contains('badge-soutien') ? 1 : -1; });
        }); 
    }
    clearBoard() { this.loco.style.display = 'none'; this.wagons.forEach(w => w.remove()); this.wagons = []; this.history = []; this.targetSteps = []; }
    
    driveOff() {
        this.history.push(this.path.sortie);
        this.loco.style.transition = "all 2s ease-in-out";
        placerElement(this.loco, this.path.sortie, true);
        this.wagons.forEach((w, i) => {
            if(!w.classList.contains('faint')){ // Seulement les survivants avancent
                w.style.transition = "all 2s ease-in-out";
                placerElement(w, this.path.sortie);
            }
        });
    }
}

let playerTrain; let enemyTrain;

function demarrerRound() {
    if (currentRound > 7) return alert("Fin de la partie !");
    document.getElementById('round-number').innerText = currentRound;
    
    // Reset flags
    amIReadyForCombat = false; isEnemyReadyForCombat = false;
    
    if(currentRound === 1) {
        deckCombat = shuffle([...monDeckPersonnalise]); // Mélange aléatoire propre
        deckSoutien = []; for(let i=1; i<=20; i++) deckSoutien.push({ id: `S${i}`, label: `S`, type: 'soutien' });
        deckSabotage = []; for(let i=1; i<=20; i++) deckSabotage.push({ id: `X${i}`, label: `X`, type: 'sabotage' });
    }
    if(playerTrain) playerTrain.clearBoard(); if(enemyTrain) enemyTrain.clearBoard();
    playerTrain = new TrainController(true); enemyTrain = new TrainController(false);
    
    let nbCartes = currentRound === 1 ? 8 : 4;
    if (currentRound === 3 && myScore === 2 && enemyScore === 0) nbCartes = 6;
    animerDistribution(nbCartes);
}

// LOGIQUE EXACTE DES PROBABILITES
function piocherCartesCombatAvecProbas(nbAPiocher) {
    let tirage = [];
    let weights = PROBAS_ROUND[currentRound > 7 ? 7 : currentRound];
    let toDraw = {1:0, 2:0, 3:0, 4:0, 5:0};
    
    // Calcul de la répartition exacte selon les % et le nb de cartes à piocher
    let remaining = nbAPiocher;
    for(let stars=1; stars<=5; stars++) {
        let count = Math.floor(nbAPiocher * (weights[stars] || 0));
        toDraw[stars] = count;
        remaining -= count;
    }
    // S'il reste une carte (arrondi), on donne au plus gros pourcentage
    if(remaining > 0) {
        let highestStar = 1; let highestW = 0;
        for(let s=1; s<=5; s++) { if(weights[s] > highestW) { highestW = weights[s]; highestStar = s; } }
        toDraw[highestStar]++;
    }

    // On pioche physiquement dans le deck selon ces quotas
    for(let stars=1; stars<=5; stars++) {
        let count = toDraw[stars];
        while(count > 0) {
            let index = deckCombat.findIndex(c => c.etoiles == stars);
            if(index !== -1) { tirage.push(deckCombat.splice(index, 1)[0]); }
            count--;
        }
    }
    return shuffle(tirage); // Mélange le résultat de la pioche
}

async function animerDistribution(nbCombat) {
    let piocheCombat = piocherCartesCombatAvecProbas(nbCombat);
    let cartesAPiocher = [...piocheCombat, ...deckSoutien.splice(0, currentRound===1?3:0), ...deckSabotage.splice(0, currentRound===1?3:0)];
    document.getElementById('count-combat').innerText = deckCombat.length;
    for (let i = 0; i < cartesAPiocher.length; i++) {
        mainDuJoueur.push(cartesAPiocher[i]);
        await creerAnimationCarte(cartesAPiocher[i]);
    }
    afficherMain(); lancerPhase(1);
}

function creerAnimationCarte(c) { return new Promise(r => { let d = document.getElementById(`deck-${c.type}`); let rect = d.getBoundingClientRect(); let a = document.createElement('div'); a.className = `carte type-${c.type} anim-card`; if(c.type==='combat') { a.innerHTML = `<span class="card-genre">${c.genre}</span><span class="card-stars">${'⭐'.repeat(c.etoiles)}</span>`; } else { a.innerText = c.label; } a.style.left = rect.left + 'px'; a.style.top = rect.top + 'px'; document.getElementById('animation-layer').appendChild(a); setTimeout(() => { a.style.left = '50%'; a.style.top = '30%'; a.style.transform = 'translate(-50%, -50%) scale(1.5)'; setTimeout(() => { a.style.left = '50%'; a.style.top = '90%'; a.style.transform = 'translate(-50%, 0) scale(0.5)'; a.style.opacity = '0'; setTimeout(() => { a.remove(); r(); }, 400); }, 600); }, 50); }); }

function afficherMain() { 
    const handContainer = document.getElementById('hand-container'); handContainer.innerHTML = ''; 
    mainDuJoueur.forEach(carte => { 
        let divCarte = document.createElement('div'); divCarte.className = `carte type-${carte.type}`; 
        if(carte.type==='combat') { divCarte.innerHTML = `<span class="card-genre">${carte.genre}</span><span class="card-stars">${'⭐'.repeat(carte.etoiles)}</span>`; } else { divCarte.innerText = carte.label; }
        if (!phaseSoutienSabotage && carte.type !== 'combat') divCarte.classList.add('disabled-card'); 
        else if (phaseSoutienSabotage && carte.type === 'combat') divCarte.classList.add('disabled-card'); 
        else if (carteSelectionnee && carteSelectionnee.id === carte.id) divCarte.classList.add('selected-card'); 
        divCarte.onclick = () => selectionnerOuJouerCarte(carte); handContainer.appendChild(divCarte); 
    }); 
}

function selectionnerOuJouerCarte(c) { if (!phaseSoutienSabotage) { if (c.type !== 'combat') return; jouerCarteMonstre(c.id); } else { if (c.type === 'combat') return; if (carteSelectionnee && carteSelectionnee.id === c.id) carteSelectionnee = null; else carteSelectionnee = c; afficherMain(); } }

function jouerCarteMonstre(idCarte) { 
    if (etapeGare > 5 || carteDejaJoueePourCettePhase) return; carteDejaJoueePourCettePhase = true; 
    let index = mainDuJoueur.findIndex(c => c.id === idCarte); let carte = mainDuJoueur[index]; 
    mainDuJoueur.splice(index, 1); afficherMain(); 
    playerTrain.addWagon(carte, false, carte.type, etapeGare); 
    if (networkConn && networkConn.open) networkConn.send({ type: 'card_played', etape: etapeGare, carteObj: carte }); 
}

function clicSurWagon(isTrainJoueur, numGare) { if (!phaseSoutienSabotage || !carteSelectionnee) return; if (carteSelectionnee.type === 'soutien' && isTrainJoueur) placerCarteSpeciale(isTrainJoueur, numGare, carteSelectionnee); else if (carteSelectionnee.type === 'sabotage' && !isTrainJoueur) placerCarteSpeciale(isTrainJoueur, numGare, carteSelectionnee); }

function placerCarteSpeciale(isTrainJoueur, numGare, carte) { 
    let index = mainDuJoueur.findIndex(c => c.id === carte.id); mainDuJoueur.splice(index, 1); carteSelectionnee = null; afficherMain(); 
    // MOI je le vois : forceHidden = false
    ajouterBadgeSoutienSabotage(true, numGare, carte, false); 
    if (networkConn && networkConn.open) networkConn.send({ type: 'special_played', isTrainJoueur: isTrainJoueur, index: numGare, carteObj: carte }); 
}

function ajouterBadgeSoutienSabotage(isLocalPlayer, numGare, carte, forceHidden) { 
    let isTrainJoueur = (isLocalPlayer && carte.type==='soutien') || (!isLocalPlayer && carte.type==='sabotage');
    let train = isTrainJoueur ? playerTrain : enemyTrain; 
    let wagonDiv = train.wagons.find(w => w.dataset.gare == numGare); if (!wagonDiv) return; 
    let badge = document.createElement('div'); 
    badge.className = `badge-${carte.type}`;
    if (forceHidden) badge.classList.add('badge-hidden'); // L'ENNEMI NE VOIT RIEN
    badge.innerText = carte.label; wagonDiv.appendChild(badge); 
}

function lancerPhase(numGare) { etapeGare = numGare; carteDejaJoueePourCettePhase = false; if (numGare === 1) { playerTrain.spawn(); enemyTrain.spawn(); document.getElementById('instruction-text').innerText = "Gare 1 !"; lancerTimer(20); } else if (numGare <= 5) { playerTrain.moveToStation(numGare, 10000); enemyTrain.moveToStation(numGare, 10000); document.getElementById('instruction-text').innerText = `Gare ${numGare}...`; lancerTimer(10); } else { document.getElementById('timer-display').style.display = 'none'; setTimeout(lancerCinematiqueCombat, 1000); } }

function lancerTimer(sec) { 
    clearInterval(intervalTimer); tempsTotalPhase = sec; tempsRestant = sec; actualiserAffichageTimer(); 
    intervalTimer = setInterval(() => { 
        tempsRestant--; actualiserAffichageTimer(); 
        if (tempsRestant <= 0) { 
            clearInterval(intervalTimer); // ARRÊTE NET LE COMPTEUR
            if (phaseSoutienSabotage) { terminerPhaseSpeciale(); } 
            else { 
                if (!carteDejaJoueePourCettePhase) jouerCarteAleatoire(); 
                // Pour éviter le spam d'AFK, on attend 1s proprement.
                setTimeout(() => { lancerPhase(etapeGare + 1); }, 1000); 
            } 
        } 
    }, 1000); 
}

function actualiserAffichageTimer() { let d = document.getElementById('timer-display'); d.innerText = `⏳ ${tempsRestant}s`; if (tempsRestant <= 5) d.classList.add('timer-danger'); else d.classList.remove('timer-danger'); }
function jouerCarteAleatoire() { let c = mainDuJoueur.filter(x => x.type === 'combat'); if (c.length > 0) jouerCarteMonstre(c[0].id); }

function lancerCinematiqueCombat() {
    document.getElementById('phase-title').innerText = "⚔️ LE TRAIN ENTRE DANS L'ARÈNE ! ⚔️";
    playerTrain.moveToStation(6, 4000); enemyTrain.moveToStation(6, 4000);
    setTimeout(() => {
        placerElement(playerTrain.loco, parcours.combat1, true); placerElement(enemyTrain.loco, enemyParcours.combat1, true);
        playerTrain.wagons.forEach(w => placerElement(w, parcours[`combat${w.dataset.gare}`]));
        enemyTrain.wagons.forEach(w => placerElement(w, enemyParcours[`combat${w.dataset.gare}`]));
        demarrerPhaseSoutienSabotage();
    }, 4500);
}

function demarrerPhaseSoutienSabotage() { phaseSoutienSabotage = true; document.getElementById('phase-title').innerText = "✨ SOUTIEN & SABOTAGE ✨"; document.getElementById('timer-display').style.display = 'block'; afficherMain(); lancerTimer(25); }

// --- LA BARRIERE DE SYNCHRONISATION ---
async function terminerPhaseSpeciale() {
    phaseSoutienSabotage = false; carteSelectionnee = null; afficherMain();
    document.getElementById('phase-title').innerText = "⚔️ ATTENTE DE L'ADVERSAIRE... ⚔️"; document.getElementById('timer-display').style.display = 'none';
    
    amIReadyForCombat = true;
    if (networkConn && networkConn.open) networkConn.send({ type: 'ready_for_combat' });
    
    verifierSiLesDeuxSontPretsPourCombat();
}

function verifierSiLesDeuxSontPretsPourCombat() {
    if (amIReadyForCombat && isEnemyReadyForCombat) {
        document.getElementById('phase-title').innerText = "⚔️ COMBAT FACE À FACE ⚔️"; 
        enemyTrain.revealWagons(); playerTrain.revealWagons(); 
        setTimeout(resoudreCombats, 2000);
    }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function resoudreCombats() {
    let pSurivants = 0; let eSurivants = 0;
    // Combat de Gare 5 à Gare 1 (Bas vers Haut de l'écran)
    for(let i=5; i>=1; i--) {
        let pW = playerTrain.wagons.find(w => w.dataset.gare == i); let eW = enemyTrain.wagons.find(w => w.dataset.gare == i);
        if(!pW || !eW) continue;
        
        pW.classList.add('clash-player'); eW.classList.add('clash-enemy');
        await sleep(600);
        let pStars = parseInt(pW.dataset.stars) + (parseInt(pW.dataset.badgeMod) || 0); let eStars = parseInt(eW.dataset.stars) + (parseInt(eW.dataset.badgeMod) || 0);
        
        if (pStars > eStars) { eW.classList.add('faint'); pSurivants++; } 
        else if (eStars > pStars) { pW.classList.add('faint'); eSurivants++; } 
        else { pW.classList.add('faint'); eW.classList.add('faint'); }
        await sleep(800);
    }
    
    if (pSurivants > eSurivants) { myScore++; document.getElementById('instruction-text').innerText = "🎉 ROUND GAGNÉ !"; }
    else if (eSurivants > pSurivants) { enemyScore++; document.getElementById('instruction-text').innerText = "💀 ROUND PERDU..."; }
    else { document.getElementById('instruction-text').innerText = "⚖️ ÉGALITÉ !"; }
    
    document.getElementById('my-score').innerText = myScore; document.getElementById('enemy-score').innerText = enemyScore;
    
    await sleep(2000);
    // Le train quitte l'écran avec les survivants !
    playerTrain.driveOff(); enemyTrain.driveOff();
    await sleep(2000);
    currentRound++; demarrerRound(); 
}
