// Initialisation
let deckDuJoueur = [];
let mainDuJoueur = [];

function creerDeck() {
    let deck = [];
    for (let i = 1; i <= 60; i++) {
        deck.push({ id: i, nom: `Monstre ${i}` });
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
    // 1. On crée et mélange le deck
    deckDuJoueur = melangerDeck(creerDeck());
    
    // 2. On pioche 8 cartes
    mainDuJoueur = piocher(8);
    
    // 3. On met à jour l'affichage
    afficherMain();
    document.getElementById('deck-count').innerText = deckDuJoueur.length;
    
    // 4. On cache le bouton pour éviter de repiocher 8 cartes
    document.getElementById('draw-btn').style.display = 'none';
}

function afficherMain() {
    const handContainer = document.getElementById('hand-container');
    handContainer.innerHTML = ''; // On vide la main visuelle

    mainDuJoueur.forEach(carte => {
        // On crée un élément HTML pour chaque carte
        let divCarte = document.createElement('div');
        divCarte.className = 'carte';
        divCarte.innerText = carte.nom;
        
        handContainer.appendChild(divCarte);
    });
}
