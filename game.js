// Initialisation
let deckDuJoueur = [];
let mainDuJoueur = [];

function creerDeck() {
    let deck = [];
    for (let i = 1; i <= 60; i++) {
        // split monster number from name for styling
        deck.push({ id: i, nom: `Monster`, label: `${i}` });
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

// Fonction appelée quand on clique sur le bouton
function demarrerPartie() {
    deckDuJoueur = melangerDeck(creerDeck());
    mainDuJoueur = piocher(8);
    
    afficherMain();
    document.getElementById('deck-count').innerText = deckDuJoueur.length;
    
    document.getElementById('draw-btn').style.display = 'none';
}

function afficherMain() {
    const handContainer = document.getElementById('hand-container');
    handContainer.innerHTML = ''; // On vide la main visuelle

    mainDuJoueur.forEach(carte => {
        // On crée un élément HTML stylisé pour chaque carte
        let divCarte = document.createElement('div');
        divCarte.className = 'carte';
        divCarte.innerHTML = `<span class="card-label">#</span><span class="card-number">${carte.label}</span><span class="card-title">${carte.nom}</span>`;
        
        handContainer.appendChild(divCarte);
    });
}
