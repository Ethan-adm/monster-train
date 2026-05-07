let deckDuJoueur = [];
let mainDuJoueur = [];
let etapeGare = 1;

let tempsRestant = 0;
let intervalTimer = null;
let enMouvement = false;

// Coordonnées exactes du circuit rectangulaire
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
    combat1: {x: 360, y: 120, r: 0},
    sortie: {x: 360, y: -50, r: 0}
};

let positionsTrain = [];
let wagonsEnJeu = [];

function creerDeck() {
    let deck = [];
    for (let i = 1; i <= 60; i++) deck.push({ id: i, label: `${i}` });
    return deck;
}

function melangerDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function demarrerPartie() {
    deckDuJoueur = melangerDeck(creerDeck());
    mainDuJoueur = deckDuJoueur.splice(0, 8);
    
    document.getElementById('draw-btn').style.display = 'none';
    document.getElementById('deck-count').innerText = deckDuJoueur.length;
    
    let loco = document.getElementById('loco');
    loco.style.display = 'flex';
    placerElement(loco, parcours.gare1);
    positionsTrain.push(parcours.gare1); 

    afficherMain();
    lancerTimer(20);
}

function afficherMain() {
    const handContainer = document.getElementById('hand-container');
    handContainer.innerHTML = ''; 

    mainDuJoueur.forEach(carte => {
        let divCarte = document.createElement('div');
        divCarte.className = 'carte';
        divCarte.innerText = carte.label;
        divCarte.onclick = () => {
            if(!enMouvement) jouerCarte(carte.id);
        };
        handContainer.appendChild(divCarte);
    });
}

function placerElement(element, point) {
    element.style.left = (point.x - 30) + 'px';
    element.style.top = (point.y - 30) + 'px';
    element.style.transform = `rotate(${point.r}deg)`;
}

function lancerTimer(secondes) {
    clearInterval(intervalTimer);
    tempsRestant = secondes;
    actualiserAffichageTimer();

    intervalTimer = setInterval(() => {
        tempsRestant--;
        actualiserAffichageTimer();

        if (tempsRestant <= 0) {
            clearInterval(intervalTimer);
            jouerCarteAleatoire();
        }
    }, 1000);
}

function actualiserAffichageTimer() {
    let display = document.getElementById('timer-display');
    display.innerText = `⏳ ${tempsRestant}s`;
    
    if (tempsRestant <= 5) {
        display.classList.add('timer-danger');
    } else {
        display.classList.remove('timer-danger');
    }
}

function jouerCarteAleatoire() {
    if (mainDuJoueur.length > 0 && etapeGare <= 5) {
        let indexAleatoire = Math.floor(Math.random() * mainDuJoueur.length);
        let carte = mainDuJoueur[indexAleatoire];
        jouerCarte(carte.id);
    }
}

function jouerCarte(idCarte) {
    if (etapeGare > 5 || enMouvement) return;
    
    enMouvement = true;
    clearInterval(intervalTimer);

    let index = mainDuJoueur.findIndex(c => c.id === idCarte);
    let carte = mainDuJoueur[index];
    mainDuJoueur.splice(index, 1);
    afficherMain();

    let wagonDiv = document.createElement('div');
    wagonDiv.className = 'wagon-ingame';
    wagonDiv.innerText = carte.label;
    document.getElementById('wagons-layer').appendChild(wagonDiv);
    
    placerElement(wagonDiv, positionsTrain[positionsTrain.length - 1]);
    wagonsEnJeu.unshift(wagonDiv);

    deplacerVersGareSuivante();
}

function deplacerVersGareSuivante() {
    let loco = document.getElementById('loco');
    let etapesDeplacement = [];

    if (etapeGare === 1) etapesDeplacement = [parcours.coinTL, parcours.gare2];
    if (etapeGare === 2) etapesDeplacement = [parcours.gare3];
    if (etapeGare === 3) etapesDeplacement = [parcours.gare4];
    if (etapeGare === 4) etapesDeplacement = [parcours.coinBL, parcours.gare5];
    
    let indexEtape = 0;

    function animerPas() {
        if (indexEtape < etapesDeplacement.length) {
            let nextPos = etapesDeplacement[indexEtape];
            positionsTrain.push(nextPos);
            
            placerElement(loco, nextPos);
            
            for(let i=0; i<wagonsEnJeu.length; i++) {
                placerElement(wagonsEnJeu[i], positionsTrain[positionsTrain.length - 2 - i]);
            }
            
            indexEtape++;
            setTimeout(animerPas, 300);
        } else {
            etapeGare++;
            enMouvement = false;
            
            if (etapeGare > 5) {
                document.getElementById('instruction-text').innerText = "Attachez vos ceintures...";
                document.getElementById('timer-display').style.display = 'none';
                setTimeout(lancerCinematiqueCombat, 500);
            } else {
                document.getElementById('instruction-text').innerText = `Gare ${etapeGare} : Choisis vite !`;
                lancerTimer(10);
            }
        }
    }
    
    animerPas();
}

function lancerCinematiqueCombat() {
    document.getElementById('phase-title').innerText = "⚔️ LE TRAIN ENTRE DANS L'ARÈNE ! ⚔️";
    let loco = document.getElementById('loco');
    
    let cheminCombat = [parcours.coinBR, parcours.combat5, parcours.combat4, parcours.combat3, parcours.combat2, parcours.combat1, parcours.sortie];
    let indexEtape = 0;

    function animerCombat() {
        if (indexEtape < cheminCombat.length) {
            let nextPos = cheminCombat[indexEtape];
            positionsTrain.push(nextPos);
            
            placerElement(loco, nextPos);
            for(let i=0; i<wagonsEnJeu.length; i++) {
                if (positionsTrain.length - 2 - i >= 0) {
                   let wPos = positionsTrain[positionsTrain.length - 2 - i];
                   if(wPos !== parcours.sortie) placerElement(wagonsEnJeu[i], wPos);
                }
            }
            
            indexEtape++;
            setTimeout(animerCombat, 300);
        }
    }
    
    animerCombat();
}
