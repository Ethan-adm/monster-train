let deckDuJoueur = [];
let mainDuJoueur = [];
let etapeGare = 0; // 0 = non commencé, 1 à 5 = Placement, 6 = Phase de Combat

function creerDeck() {
    let deck = [];
    for (let i = 1; i <= 60; i++) {
        deck.push({ id: i, label: `${i}` });
    }
    return deck;
}

function melangerDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function piocher(nombreDeCartes) {
    return deckDuJoueur.splice(0, nombreDeCartes);
}

function demarrerPartie() {
    // Initialisation
    deckDuJoueur = melangerDeck(creerDeck());
    mainDuJoueur = piocher(8);
    
    // On cache le bouton, on met à jour le texte
    document.getElementById('draw-btn').style.display = 'none';
    document.getElementById('deck-count').innerText = deckDuJoueur.length;
    
    // Le jeu commence à la Gare 1
    etapeGare = 1;
    afficherMain();
    animerTrainEtGares();
}

function afficherMain() {
    const handContainer = document.getElementById('hand-container');
    handContainer.innerHTML = ''; 

    mainDuJoueur.forEach(carte => {
        let divCarte = document.createElement('div');
        divCarte.className = 'carte';
        divCarte.innerHTML = `<span class="card-number">${carte.label}</span>`;
        
        // Quand on clique sur une carte de sa main
        divCarte.onclick = () => jouerCarte(carte.id);
        
        handContainer.appendChild(divCarte);
    });
}

function jouerCarte(idCarte) {
    // Si on a déjà rempli les 5 wagons, on ne peut plus jouer
    if (etapeGare > 5 || etapeGare < 1) return;

    // 1. Trouver la carte dans la main
    let index = mainDuJoueur.findIndex(c => c.id === idCarte);
    let carte = mainDuJoueur[index];

    // 2. Retirer la carte de la main et mettre à jour l'affichage
    mainDuJoueur.splice(index, 1);
    afficherMain();

    // 3. Placer la carte visuellement dans la Gare actuelle
    let slot = document.getElementById(`p-slot-${etapeGare}`);
    slot.innerHTML = `<div class="carte carte-jouee" style="background: #27ae60;"><span class="card-number">${carte.label}</span></div>`;
    slot.style.borderColor = "#27ae60"; // Change la couleur de la bordure

    // 4. Avancer à la Gare suivante
    etapeGare++;
    animerTrainEtGares();
}

function animerTrainEtGares() {
    let train = document.getElementById('player-train');
    train.style.display = 'block'; // Affiche le train

    // Enlève l'illumination de toutes les gares
    for(let i = 1; i <= 5; i++) {
        document.getElementById(`row-${i}`).classList.remove('active-row');
    }

    if (etapeGare <= 5) {
        // Le jeu continue (Gare 1 à 5)
        document.getElementById('phase-title').innerText = `🚂 Placement - Gare ${etapeGare}`;
        document.getElementById('instruction-text').innerText = `Sélectionne une carte pour le Wagon ${etapeGare} !`;
        
        // Illumine la nouvelle gare
        document.getElementById(`row-${etapeGare}`).classList.add('active-row');
        
        // Calcule le déplacement du train vers le bas
        // La hauteur d'une ligne est environ 140px + 15px de gap
        let deplacementY = (etapeGare - 1) * 155; 
        train.style.transform = `translateY(${deplacementY}px)`;
        
    } else {
        // Fin de la phase de placement -> COMBAT
        document.getElementById('phase-title').innerText = "⚔️ PHASE DE COMBAT ! ⚔️";
        document.getElementById('phase-title').style.color = "#e74c3c";
        document.getElementById('instruction-text').innerText = "Attente du joueur adverse...";
        
        // Le train avance au milieu (face à face)
        train.style.transform = `translateY(800px)`; 
    }
}
