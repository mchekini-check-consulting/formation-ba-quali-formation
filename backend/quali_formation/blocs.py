"""Les 13 blocs Qualiopi et le calcul de complétude (même règles que frontend/src/formations/catalogue.js)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Question:
    cle: str
    groupe: str | None = None  # RG09 : une seule réponse du groupe suffit
    hors_presentiel: bool = False  # RG10 : demandée seulement si la modalité n'est pas Présentiel


@dataclass(frozen=True)
class Bloc:
    id: str
    titre: str
    partie: int  # RG07 : 0 La formation, 1 Accès et tarif, 2 Évaluation et suivi
    questions: tuple[Question, ...]


def _q(*cles):
    return tuple(Question(c) for c in cles)


PARTIES = ('La formation', 'Accès et tarif', 'Évaluation et suivi')

BLOCS = (
    Bloc('public', 'Public et prérequis', 0, _q('public', 'besoin', 'prerequis')),
    Bloc('objectifs', 'Objectifs', 0, _q('objectifs')),
    Bloc('programme', 'Programme', 0, ()),  # complet selon les séquences (RG16)
    Bloc('methodes', 'Méthodes et moyens', 0, _q('methodes', 'materiel', 'supports')),
    Bloc('intervenants', 'Formateurs', 0, (Question('formateurs'), Question('assistance_dist', hors_presentiel=True))),
    Bloc('acces', 'Accès et inscription', 1, _q('acces', 'delai', 'lieu', 'contact')),
    Bloc('tarif', 'Tarif et financement', 1, _q('tarif', 'unite', 'taxe', 'financements')),
    Bloc('handicap', 'Accessibilité handicap', 1, _q('ref_handicap', 'amenagements', 'locaux')),
    Bloc('positionnement', 'Évaluation avant la formation', 2, _q('positionnement')),
    Bloc('evaluation', 'Évaluation des acquis', 2, _q('eval_pendant', 'evaluation', 'criteres')),
    Bloc('suivi', 'Document remis', 2, _q('document')),
    Bloc('satisfaction', 'Satisfaction', 2, _q('satisfaction')),
    Bloc('resultats', 'Indicateurs de résultats', 2, (Question('resultats_mesures', groupe='res'), Question('resultats_plan', groupe='res'))),
)


def rempli(valeur):
    """Une réponse texte non vide, ou une liste avec au moins un élément non vide."""
    if isinstance(valeur, list):
        return any(str(x if x is not None else '').strip() for x in valeur)
    return str(valeur if valeur is not None else '').strip() != ''


def bloc_complet(bloc, valeurs, modalite, nb_sequences):
    """RG08 : toutes les questions visibles ont une réponse (RG09 pour les groupes, RG10 pour l'assistance)."""
    if bloc.id == 'programme':
        # Les séquences enregistrées sont toujours complètes (contrôlées à l'enregistrement, RG18)
        return nb_sequences > 0
    groupes = {}
    for q in bloc.questions:
        if q.hors_presentiel and modalite == 'PRESENTIEL':
            continue
        if q.groupe:
            groupes[q.groupe] = groupes.get(q.groupe, False) or rempli(valeurs.get(q.cle))
        elif not rempli(valeurs.get(q.cle)):
            return False
    return all(groupes.values())


def blocs_manquants(valeurs, modalite, nb_sequences):
    return [b for b in BLOCS if not bloc_complet(b, valeurs or {}, modalite, nb_sequences)]
