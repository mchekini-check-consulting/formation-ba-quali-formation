"""SCRUM-219 (RG18 bis) : deux modèles (HTML de l'éditeur, variables {{code}}) affichent-ils le même document ?
Comparaison du texte « nettoyé », pour qu'un modèle ouvert puis enregistré sans changement visible reste
« Identique au modèle générique » : l'éditeur réécrit le HTML (styles « text-align: center; », <b> en <strong>,
paragraphe dans chaque puce de liste). Sont ignorés : espaces en trop, balises sans contenu, attributs vides,
ordre et écriture des règles de style et des classes."""
import re
from html.parser import HTMLParser

# Balises équivalentes à l'écran (forme écrite par l'éditeur)
SYNONYMES = {'b': 'strong', 'i': 'em', 'strike': 's', 'del': 's'}
VIDES = {'br', 'img', 'hr', 'wbr', 'input', 'col', 'source', 'meta', 'link'}
IGNOREES = {'script', 'style', 'template', 'noscript', 'head', 'title'}
ESPACES = re.compile(r'\s+')


def _style(valeur):
    # « text-align:center » et « text-align: center; » : la même règle
    regles = (r.split(':', 1) for r in valeur.split(';') if ':' in r)
    propres = sorted(f'{cle.strip().lower()}:{ESPACES.sub(" ", val.strip()).lower()}' for cle, val in regles if val.strip())
    return ';'.join(propres)


def _attributs(attrs):
    propres = []
    for nom, valeur in attrs:
        valeur = (valeur or '').strip()
        if nom == 'style':
            valeur = _style(valeur)
        elif nom == 'class':
            valeur = ' '.join(sorted(valeur.split()))
        if valeur:
            propres.append((nom, valeur))
    return tuple(sorted(propres))


class _Noeud:
    def __init__(self, balise, attributs=()):
        self.balise = balise
        self.attributs = attributs
        self.enfants = []


class _Lecteur(HTMLParser):
    """Le HTML en arbre (texte = str), balises mal fermées tolérées."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.racine = _Noeud('racine')
        self.pile = [self.racine]
        self.ignore = 0

    def handle_starttag(self, tag, attrs):
        if tag in IGNOREES:
            self.ignore += 1
            return
        noeud = _Noeud(SYNONYMES.get(tag, tag), _attributs(attrs))
        self.pile[-1].enfants.append(noeud)
        if tag not in VIDES:
            self.pile.append(noeud)

    def handle_endtag(self, tag):
        if tag in IGNOREES:
            self.ignore = max(0, self.ignore - 1)
            return
        balise = SYNONYMES.get(tag, tag)
        for i in range(len(self.pile) - 1, 0, -1):
            if self.pile[i].balise == balise:
                del self.pile[i:]
                return

    def handle_data(self, data):
        if not self.ignore:
            self.pile[-1].enfants.append(data)


def _forme(noeud, dans_puce=False):
    """Forme comparable d'un nœud : liste de jetons ; les balises sans contenu disparaissent."""
    jetons = []
    for enfant in noeud.enfants:
        if isinstance(enfant, str):
            jetons.append(('texte', enfant))
            continue
        if enfant.balise in VIDES:
            jetons.append(('vide', enfant.balise, enfant.attributs))
            continue
        # <li><p>…</p></li> (éditeur) et <li>…</li> : la même puce
        if dans_puce and enfant.balise == 'p' and not enfant.attributs:
            jetons.extend(_forme(enfant))
            continue
        interieur = _forme(enfant, dans_puce=enfant.balise == 'li')
        if any(j[0] != 'texte' or j[1].strip() for j in interieur):
            jetons.append(('ouvre', enfant.balise, enfant.attributs))
            jetons.extend(interieur)
            jetons.append(('ferme', enfant.balise))
    return _fusionner_textes(jetons)


def _fusionner_textes(jetons):
    resultat = []
    for jeton in jetons:
        if jeton[0] == 'texte' and resultat and resultat[-1][0] == 'texte':
            resultat[-1] = ('texte', resultat[-1][1] + jeton[1])
        else:
            resultat.append(jeton)
    return resultat


def forme_comparable(html):
    """Le document sous une forme où seules les différences visibles comptent."""
    lecteur = _Lecteur()
    lecteur.feed(html or '')
    lecteur.close()
    jetons = []
    for jeton in _forme(lecteur.racine):
        if jeton[0] == 'texte':
            texte = ESPACES.sub(' ', jeton[1]).strip()
            if texte:
                jetons.append(('texte', texte))
        else:
            jetons.append(jeton)
    return jetons


def meme_document(html_a, html_b):
    """Vrai si les deux modèles affichent le même document (texte, mise en forme, variables)."""
    return html_a == html_b or forme_comparable(html_a) == forme_comparable(html_b)
