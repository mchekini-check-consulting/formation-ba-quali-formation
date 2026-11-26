"""SCRUM-216 « Télécharger un modèle en Word » : un modèle de document (HTML de l'éditeur, variables {{code}})
transformé en fichier .docx avec python-docx. Réutilisable pour tout modèle (générique, et modèle de la formation
SCRUM-219) : ne lit que le contenu, jamais la base.

Mise en forme reprise : titres, gras, italique, souligné, barré, alignement, marge haute, couleur du texte,
listes à puces et numérotées, retours à la ligne. Les variables restent écrites {{code}}, jamais leur valeur
(RG9), dans un seul morceau de texte pour être reconnues au réimport (SCRUM-215). Le reste (liens, images,
scripts) est réduit à son texte ou ignoré, comme à l'affichage du document (DocumentModele.jsx)."""
import io
import re
from html.parser import HTMLParser

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor

DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

TITRES = {'h1': 'Heading 1', 'h2': 'Heading 2', 'h3': 'Heading 3', 'h4': 'Heading 3'}
BLOCS = {'p', 'div', 'blockquote', *TITRES}
IGNOREES = {'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'head', 'title'}
VIDES = {'br', 'img', 'hr', 'input', 'meta', 'link', 'wbr', 'col', 'source'}
ALIGNEMENTS = {'left': WD_ALIGN_PARAGRAPH.LEFT, 'center': WD_ALIGN_PARAGRAPH.CENTER,
               'right': WD_ALIGN_PARAGRAPH.RIGHT, 'justify': WD_ALIGN_PARAGRAPH.JUSTIFY}
# Mise en forme portée par une balise : <b>, <strong> = gras...
MARQUES = {'b': 'gras', 'strong': 'gras', 'i': 'italique', 'em': 'italique', 'u': 'souligne',
           's': 'barre', 'strike': 'barre', 'del': 'barre'}
HEX = re.compile(r'^#([0-9a-f]{3}|[0-9a-f]{6})$', re.IGNORECASE)
RGB = re.compile(r'^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$', re.IGNORECASE)
MARGE = re.compile(r'^(\d{1,3})px$')
ESPACES = re.compile(r'\s+')


class _Noeud:
    def __init__(self, balise, attributs, parent=None):
        self.balise = balise
        self.attributs = dict(attributs)
        self.parent = parent
        self.enfants = []

    @property
    def classes(self):
        return set((self.attributs.get('class') or '').split())

    @property
    def style(self):
        # « text-align: center; color: #DC2626 » -> {'text-align': 'center', 'color': '#DC2626'}
        regles = (r.split(':', 1) for r in (self.attributs.get('style') or '').split(';') if ':' in r)
        return {cle.strip().lower(): valeur.strip() for cle, valeur in regles}


class _Arbre(HTMLParser):
    """Le HTML du modèle en arbre de _Noeud (texte = str), balises mal fermées tolérées."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.racine = self.courant = _Noeud('body', {})

    def handle_starttag(self, balise, attributs):
        noeud = _Noeud(balise, attributs, self.courant)
        self.courant.enfants.append(noeud)
        if balise not in VIDES:
            self.courant = noeud

    def handle_endtag(self, balise):
        noeud = self.courant
        while noeud is not self.racine and noeud.balise != balise:
            noeud = noeud.parent
        if noeud is not self.racine:
            self.courant = noeud.parent

    def handle_data(self, texte):
        self.courant.enfants.append(texte)


def _couleur(valeur):
    if m := HEX.match(valeur or ''):
        code = m.group(1)
        if len(code) == 3:  # #f00 -> FF0000
            code = ''.join(c * 2 for c in code)
        return RGBColor.from_string(code.upper())
    if m := RGB.match(valeur or ''):
        rouge, vert, bleu = (min(int(v), 255) for v in m.groups())
        return RGBColor(rouge, vert, bleu)
    return None


class _Redacteur:
    """Parcourt l'arbre et écrit les paragraphes du document Word."""

    def __init__(self, document):
        self.document = document
        self.paragraphe = None
        self.paragraphe_puce = None  # paragraphe d'une puce, repris par son premier <p> (<li><p>…</p></li>)
        self.listes = []  # listes ouvertes : (balise, numérotation)

    def ecrire(self, noeud, format_texte, alignement):
        if isinstance(noeud, str):
            self._texte(noeud, format_texte, alignement)
            return
        balise = noeud.balise
        if balise in IGNOREES:
            return
        style = noeud.style
        alignement = ALIGNEMENTS.get(style.get('text-align', '').lower(), alignement)
        format_texte = self._format(noeud, style, format_texte)
        if balise == 'br':
            if self.paragraphe is not None:
                self.paragraphe.add_run().add_break()
        elif balise in ('ul', 'ol'):
            self._liste(noeud, format_texte, alignement)
        elif balise == 'li':
            self._puce(noeud, format_texte, alignement)
        elif balise in BLOCS and balise != 'div':
            self._bloc(noeud, format_texte, alignement, TITRES.get(balise), style)
        elif balise == 'div' or (balise == 'span' and 'eh' in getattr(noeud.parent, 'classes', set())):
            # Conteneur (dont l'en-tête des modèles d'origine : logo puis coordonnées) : un paragraphe par bloc
            self._fermer()
            for enfant in noeud.enfants:
                self.ecrire(enfant, format_texte, alignement)
            self._fermer()
        else:  # mise en forme dans le texte (gras, couleur…) ou balise inconnue : seulement son contenu
            for enfant in noeud.enfants:
                self.ecrire(enfant, format_texte, alignement)

    @staticmethod
    def _format(noeud, style, format_texte):
        nouveau = dict(format_texte)
        if noeud.balise in MARQUES:
            nouveau[MARQUES[noeud.balise]] = True
        if (couleur := _couleur(style.get('color'))) is not None:
            nouveau['couleur'] = couleur
        return nouveau

    def _fermer(self):
        self.paragraphe = None
        self.paragraphe_puce = None

    def _nouveau(self, nom_style, alignement):
        self.paragraphe = self.document.add_paragraph(style=nom_style)
        if alignement is not None:
            self.paragraphe.alignment = alignement
        return self.paragraphe

    def _texte(self, texte, format_texte, alignement):
        texte = ESPACES.sub(' ', texte)
        if self.paragraphe is None:
            texte = texte.lstrip()
            if not texte:
                return
            self._nouveau(None, alignement)
        self.paragraphe_puce = None
        morceau = self.paragraphe.add_run(texte)  # un {{code}} reste dans un seul morceau (RG9)
        morceau.bold = format_texte.get('gras')
        morceau.italic = format_texte.get('italique')
        morceau.underline = format_texte.get('souligne')
        morceau.font.strike = format_texte.get('barre')
        if 'couleur' in format_texte:
            morceau.font.color.rgb = format_texte['couleur']

    def _bloc(self, noeud, format_texte, alignement, titre, style):
        if self.paragraphe_puce is not None and titre is None:
            paragraphe = self.paragraphe_puce  # premier paragraphe d'une puce : celui de la puce
            if alignement is not None:
                paragraphe.alignment = alignement
            self.paragraphe = paragraphe
            self.paragraphe_puce = None
        else:
            self._fermer()
            paragraphe = self._nouveau(titre or ('List Continue' if self.listes else None), alignement)
        if m := MARGE.match(style.get('margin-top', '')):
            paragraphe.paragraph_format.space_before = Pt(int(m.group(1)) * 0.75)  # 1 px = 0,75 pt
        for enfant in noeud.enfants:
            self.ecrire(enfant, format_texte, alignement)
        self._fermer()

    def _liste(self, noeud, format_texte, alignement):
        self._fermer()
        niveau = min(len(self.listes), 2)
        style = self._style_liste(noeud.balise, niveau)
        numerotation = _numerotation(self.document, style) if noeud.balise == 'ol' else _numero_du_style(self.document, style)
        self.listes.append((noeud.balise, numerotation))
        for enfant in noeud.enfants:
            self.ecrire(enfant, format_texte, alignement)
        self.listes.pop()
        self._fermer()

    @staticmethod
    def _style_liste(balise, niveau):
        nom = 'List Number' if balise == 'ol' else 'List Bullet'
        return nom if niveau == 0 else f'{nom} {niveau + 1}'

    def _puce(self, noeud, format_texte, alignement):
        self._fermer()
        if not self.listes:  # <li> hors liste : une puce simple
            self.listes.append(('ul', _numero_du_style(self.document, 'List Bullet')))
            self._puce(noeud, format_texte, alignement)
            self.listes.pop()
            return
        balise, numerotation = self.listes[-1]
        paragraphe = self._nouveau(self._style_liste(balise, min(len(self.listes) - 1, 2)), alignement)
        # Numérotation écrite sur le paragraphe (et pas seulement dans le style) : Word, LibreOffice et le
        # réimport (mammoth) reconnaissent alors la liste, et chaque liste numérotée repart de 1
        numpr = paragraphe._p.get_or_add_pPr().get_or_add_numPr()
        numpr.get_or_add_ilvl().val = 0
        numpr.get_or_add_numId().val = numerotation
        self.paragraphe_puce = paragraphe
        for enfant in noeud.enfants:
            self.ecrire(enfant, format_texte, alignement)
        self._fermer()


def _numero_du_style(document, nom_style):
    return document.styles[nom_style].element.pPr.numPr.numId.val


def _numerotation(document, nom_style):
    """Une numérotation propre à cette liste (qui repart de 1), sur le modèle de celle du style."""
    numerotations = document.part.numbering_part.element
    numero = _numero_du_style(document, nom_style)
    abstrait = next(n.abstractNumId.val for n in numerotations.num_lst if n.numId == numero)
    num = numerotations.add_num(abstrait)
    num.add_lvlOverride(ilvl=0).add_startOverride(1)
    return num.numId


def docx_depuis_html(contenu, titre=''):
    """Le contenu d'un modèle (HTML, variables {{code}}) en fichier .docx (octets)."""
    arbre = _Arbre()
    arbre.feed(contenu or '')
    arbre.close()
    document = Document()
    proprietes = document.core_properties
    proprietes.title = titre
    proprietes.author = proprietes.last_modified_by = 'Quali-formation'
    proprietes.comments = ''
    redacteur = _Redacteur(document)
    for noeud in arbre.racine.enfants:
        redacteur.ecrire(noeud, {}, None)
    sortie = io.BytesIO()
    document.save(sortie)
    return sortie.getvalue()
