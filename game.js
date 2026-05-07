let deckDuJoueur = [];
let mainDuJoueur = [];
let etapeGare = 1;

// Le circuit exact en "U". x et y sont les coordonnées du centre du rail. r est la rotation.
const parcoursTrain = [
    {x: 100, y: 80, r: 180},   // 0: Gare 1 (Loco regarde vers le bas)
    {x: 100, y: 180, r: 180},  // 1: Gare 2
    {x: 100, y: 280, r: 180},  // 2: Gare 3
    {x: 100, y: 380, r: 180},  // 3: Gare 4
    {x: 100, y: 480, r: 180},  // 4: Gare 5
    {x: 100, y: 560, r: 180},  // 5: Virage Bas-Gauche
    {x: 225, y: 560, r: -90},  // 6: Virage Bas-Centre (Loco regarde vers la droite)
    {x: 350, y: 560, r: 0},    // 7: Virage Bas-Droite (Loco regarde vers le haut)
    {x: 350, y: 480, r: 0},    // 8: Combat 1 (En bas)
    {x: 350, y: 380, r: 0},    // 9: Combat 2
    {x: 350, y: 280, r: 0},    // 10: Combat 3
    {x: 350, y: 180, r: 0},    // 11: Combat 4
    {x: 350, y: 80, r: 0},     // 12: Combat 5 (En haut)
    {x: 350, y: -50, r: 0}     // 13: Sortie de la Loco
];

let locoPosIndex = 0; // Position actuelle de la loco dans le tableau "parcoursTrain"
let wagonsEnJeu = []; // Liste des éléments HTML de tes wagons
let wagonsPositions = []; // Indice de position de chaque wagon dans "parcoursTrain"

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
    
    // Fait apparaître la loco à la Gare 1
    let loco = document.getElementById('loco');
    loco.style.display = 'flex';
    placerElementSurRail(loco, locoPosIndex, 30, 30); // 30 = moitié de sa taille pour centrer

    afficherMain();
}

function afficherMain() {
    const handContainer = document.getElementById('hand-container');
    handContainer.innerHTML = ''; 

    mainDuJoueur.forEach(carte => {
        let divCarte = document.createElement('div');
        divCarte.className = 'carte';
        divCarte.innerText = carte.label;
        divCarte.onclick = () => jouerCarte(carte.id);
        handContainer.appendChild(divCarte);
    });
}

// Centre un élément HTML sur les coordonnées (x,y) du rail
function placerElementSurRail(element, indexParcours, moitieLargeur, moitieHauteur) {
    let point = parcoursTrain[indexParcours];
    element.style.left = (point.x - moitieLargeur) + 'px';
    element.style.top = (point.y - moitieHauteur) + 'px';
    element.style.transform = `rotate(${point.r}deg)`;
}

function jouerCarte(idCarte) {
    if (etapeGare > 5) return; // Si on a posé 5 wagons, on bloque

    let index = mainDuJoueur.findIndex(c => c.id === idCarte);
    let carte = mainDuJoueur[index];
    mainDuJoueur.splice(index, 1);
    afficherMain();

    // 1. Crée un Wagon sur les rails à l'endroit exact où se trouve la Loco
    let wagonDiv = document.createElement('div');
    wagonDiv.className = 'wagon-ingame';
    wagonDiv.innerText = carte.label;
    document.getElementById('wagons-layer').appendChild(wagonDiv);
    
    // Le wagon prend la place actuelle de la loco
    wagonsEnJeu.push(wagonDiv);
    wagonsPositions.push(locoPosIndex);
    placerElementSurRail(wagonDiv, locoPosIndex, 30, 40); // 30x40 = centre d'un wagon de 60x80

    // 2. La loco avance d'un cran (vers la gare suivante, ou vers le virage si c'est la fin)
    locoPosIndex++;
    let loco = document.getElementById('loco');
    placerElementSurRail(loco, locoPosIndex, 30, 30);

    etapeGare++;

    // 3. Vérifie si le train est complet (5 wagons posés)
    if (etapeGare > 5) {
        document.getElementById('instruction-text').innerText = "Attachez vos ceintures...";
        setTimeout(lancerCinematiqueCombat, 800); // Lance l'animation après un petit délai
    } else {
        document.getElementById('instruction-text').innerText = `Sélectionne une carte pour la Gare ${etapeGare} !`;
    }
}

// Anime tout le train (Loco + 5 wagons) pour remonter la voie centrale
function lancerCinematiqueCombat() {
    document.getElementById('phase-title').innerText = "⚔️ LE TRAIN ENTRE DANS L'ARÈNE ! ⚔️";
    document.getElementById('phase-title').style.color = "#e74c3c";
    
    let loco = document.getElementById('loco');
    let etapesAnimation = 0;

    // Le train doit avancer de 8 cases au total pour que le Wagon 1 arrive face à E1
    let interval = setInterval(() => {
        etapesAnimation++;

        // La loco avance
        locoPosIndex++;
        if(locoPosIndex < parcoursTrain.length) {
            placerElementSurRail(loco, locoPosIndex, 30, 30);
        } else {
            loco.style.opacity = '0'; // La loco sort du plateau par le haut
        }

        // Chaque wagon avance d'un cran en suivant la loco
        wagonsEnJeu.forEach((wagonDiv, i) => {
            wagonsPositions[i]++;
            placerElementSurRail(wagonDiv, wagonsPositions[i], 30, 40);
        });

        // Quand le train a fait ses 8 pas, l'animation s'arrête
        if (etapesAnimation >= 8) {
            clearInterval(interval);
            document.getElementById('phase-title').innerText = "⚔️ COMBAT FACE À FACE ⚔️";
            document.getElementById('instruction-text').innerText = "Attente du joueur adverse...";
        }

    }, 500); // Vitesse du train (1 mouvement toutes les demi-secondes)
}
