"""SCRUM-220 « Utiliser le bon modèle pour générer les documents d'une session » (RG20, RG21, RG22).

Choix du modèle (RG20) : modèle de la formation, sinon modèle générique du compte, sinon modèle d'origine.
Chaque {{code}} est remplacé par sa valeur à la source du dictionnaire de données ; une valeur absente reste vide,
sans erreur (RG21). Passages conditionnels (<em class="cond">Si … :</em>) : affichés sans l'étiquette si la
condition est vraie, retirés sinon. Le contenu rempli et le PDF sont figés à la génération (RG22).
Un PDF par apprenant (contrat, convocation, attestation), un par entreprise cliente (convention)."""
import html
import io
import re
import unicodedata
from dataclasses import dataclass, field
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from xhtml2pdf import pisa

from quali_formation.logging.log_metier import log_metier
from quali_formation.models import (
    DocumentGenere,
    ModeleFormation,
    ModeleGenerique,
    ModeleOrigine,
    Session,
    TypeModele,
)
from quali_formation.services import (
    ErreurMetier,
    ModeleIntrouvable,
    formations_visibles,
)

VARIABLE = re.compile(r'\{\{\s*([A-Za-z0-9_]+)\s*\}\}')
# Plus petit bloc (paragraphe ou puce) qui contient un passage conditionnel, et l'étiquette « Si … : »
BLOC_CONDITIONNEL = re.compile(
    r'<(p|li)(\s[^>]*)?>((?:(?!<(?:p|li)[\s>]).)*?)<em class="cond">(.*?)</em>(.*?)</\1>', re.DOTALL)
BALISES = re.compile(r'<[^>]+>')
PREFIXES = {TypeModele.CONVENTION: 'CONV', TypeModele.CONTRAT: 'CTR', TypeModele.CONVOCATION: 'CVC',
            TypeModele.ATTESTATION: 'ATT'}
CHAMP_ORGANISME = 'utilisateur.organisme_id'
MESSAGE_SANS_CLIENT = ('Aucun apprenant de cette session n’est rattaché à une entreprise cliente : pas de convention à '
                       'générer. Pour un particulier qui finance lui-même sa formation, générez le contrat de formation.')


class SessionIntrouvable(ErreurMetier):
    """404 : session inexistante ou d'un autre organisme (sans dire laquelle des deux)."""

    def __init__(self):
        super().__init__('SESSION_INTROUVABLE', 'Session introuvable', 404)


class DocumentIntrouvable(ErreurMetier):
    def __init__(self):
        super().__init__('DOCUMENT_INTROUVABLE', 'Document introuvable', 404)


class GenerationImpossible(ErreurMetier):
    """400 : rien à générer (session sans apprenant, convention sans entreprise cliente)."""

    def __init__(self, code, message):
        super().__init__(code, message, 400)


class PdfImpossible(ErreurMetier):
    """500 : le PDF n'a pas pu être créé ; rien n'est enregistré."""

    def __init__(self):
        super().__init__('PDF_IMPOSSIBLE', 'Les documents n’ont pas pu être créés. Réessayez.', 500)


# ---- Formats français ----

def date_fr(valeur):
    return valeur.strftime('%d/%m/%Y') if valeur else ''


def nombre_fr(valeur):
    """14 -> « 14 » ; 7.50 -> « 7,5 »."""
    if valeur is None:
        return ''
    texte = f'{Decimal(valeur).normalize():f}'
    return texte.replace('.', ',')


def montant_fr(valeur):
    """2400 -> « 2 400,00 € »."""
    if valeur is None:
        return ''
    entier, decimales = f'{Decimal(valeur):,.2f}'.split('.')
    return f'{entier.replace(",", " ")},{decimales} €'


def heures_fr(valeur):
    return f'{nombre_fr(valeur)} heures' if valeur is not None else ''


def heure_fr(valeur):
    return f'{valeur.hour}h{valeur.minute:02d}' if valeur else ''


def _texte(valeur):
    """Réponse libre d'un bloc de la formation (texte, liste…) en texte simple."""
    if valeur is None:
        return ''
    if isinstance(valeur, (list, tuple)):
        return ', '.join(t for t in (_texte(v) for v in valeur) if t)
    if isinstance(valeur, dict):
        return ', '.join(t for t in (_texte(v) for v in valeur.values()) if t)
    return str(valeur).strip()


def _joindre(*morceaux, separateur=' ; '):
    return separateur.join(m for m in morceaux if m)


def _personne(prenom, nom):
    return _joindre(prenom, nom, separateur=' ')


# ---- Valeurs des variables (dictionnaire de données, colonne « Source ») ----

@dataclass
class Contexte:
    session: Session
    organisme: object = None
    apprenant: object = None
    entreprise: object = None
    apprenants: list = field(default_factory=list)  # apprenants concernés (convention : ceux de l'entreprise)
    numero: str = ''
    date_generation: object = None


def _valeurs_organisme(o):
    if o is None:
        return {}
    return {
        'org_nom': o.raison_sociale, 'org_adresse': o.adresse, 'org_siret': o.siret,
        'org_nda': o.numero_declaration_activite, 'org_region': o.region_nda, 'org_representant': o.representant_legal,
        'org_representant_fonction': o.fonction_representant, 'org_ville': o.ville_signature,
        'org_telephone': o.telephone, 'org_email': o.email_contact, 'org_referent_handicap': o.referent_handicap,
        'org_contact_stagiaires': o.contact_stagiaires, 'org_contact_technique': o.contact_assistance_technique,
        'org_taux_penalites': o.penalites_retard, 'org_mediateur': o.mediateur_consommation,
        'org_tribunal': o.ville_tribunal, 'org_delai_annulation': o.delai_annulation, 'org_dedit': o.montant_dedit,
        'org_conditions_abandon': o.conditions_abandon, 'prix_taux_tva': o.regime_tva,
    }


def _valeurs_formation(f):
    v = f.valeurs or {}
    programme = '; '.join(_joindre(s.titre, heures_fr(s.duree_heures) and f'({heures_fr(s.duree_heures)})', separateur=' ')
                          for s in f.sequences.all())
    return {
        'formation_intitule': f.intitule, 'formation_duree': heures_fr(f.duree_heures),
        'formation_modalite': f.get_modalite_display(), 'formation_objectifs': _texte(v.get('objectifs')),
        'formation_prerequis': _texte(v.get('prerequis')), 'formation_programme': programme,
        'formation_assistance_distance': _texte(v.get('assistance_dist')),
        'formation_moyens': _joindre(_texte(v.get('methodes')), _texte(v.get('materiel')), _texte(v.get('supports'))),
        'formation_evaluation': _texte(v.get('evaluation')),
    }


def _valeurs_session(s, apprenants):
    distanciel = s.modalite == Session.Modalite.DISTANCIEL
    horaires = f'{heure_fr(s.heure_debut)}-{heure_fr(s.heure_fin)}' if s.heure_debut and s.heure_fin else ''
    return {
        'session_date_debut': date_fr(s.date_debut), 'session_date_fin': date_fr(s.date_fin),
        'session_horaires': horaires, 'session_lieu': 'À distance' if distanciel else s.lieu,
        'session_lien': s.lien_classe_virtuelle,
        'session_formateur': ', '.join(_personne(f.prenom, f.nom) for f in s.formateurs.all()),
        # « Titres et qualités du formateur » : ses spécialités (décision BA du 2026-11-27, pas de champ dédié)
        'formateur_qualites': _joindre(*(_texte(f.specialites) for f in s.formateurs.all())),
        'session_nb_participants': str(len(apprenants)),
        'liste_apprenants': ', '.join(_joindre(_personne(a.prenom, a.nom), a.poste and f'({a.poste})', separateur=' ')
                                      for a in apprenants),
    }


def _valeurs_client(e):
    if e is None:
        return {}
    return {
        'client_nom': e.raison_sociale, 'client_siret': e.siret,
        'client_adresse': _joindre(e.adresse, _joindre(e.code_postal, e.ville, separateur=' '), separateur=', '),
        'client_signataire': _personne(e.interlocuteur_prenom, e.interlocuteur_nom),
        'client_signataire_fonction': e.interlocuteur_role,
    }


def valeurs_document(contexte):
    """Valeur de chaque variable pour ce document ; une information absente vaut '' (RG21)."""
    valeurs = {}
    valeurs.update(_valeurs_organisme(contexte.organisme))
    valeurs.update(_valeurs_formation(contexte.session.formation))
    valeurs.update(_valeurs_session(contexte.session, contexte.apprenants))
    valeurs.update(_valeurs_client(contexte.entreprise))
    if contexte.apprenant is not None:
        valeurs.update({'apprenant_prenom': contexte.apprenant.prenom, 'apprenant_nom': contexte.apprenant.nom})
    valeurs.update({'numero_document': contexte.numero, 'date_document': date_fr(contexte.date_generation)})
    return {cle: '' if valeur is None else str(valeur) for cle, valeur in valeurs.items()}


# ---- Passages conditionnels et remplissage ----

def _simplifier(texte):
    return unicodedata.normalize('NFKD', texte).encode('ascii', 'ignore').decode().lower()


def condition_vraie(etiquette, bloc, contexte, valeurs):
    """« Si distanciel (ou mixte) » : session pas en présentiel ; « Si un dédit est prévu » : montant du dédit
    renseigné ; « Si salarié » : apprenant d'une entreprise cliente ; autre condition : vraie seulement si toutes les
    variables du passage ont une valeur."""
    mots = _simplifier(BALISES.sub('', etiquette))
    if 'distanc' in mots or 'mixte' in mots:
        return contexte.session.modalite != Session.Modalite.PRESENTIEL
    if 'dedit' in mots:
        return bool(valeurs.get('org_dedit'))
    if 'salari' in mots:
        return contexte.entreprise is not None
    return all(valeurs.get(code) for code in VARIABLE.findall(bloc))


def appliquer_conditions(contenu, contexte, valeurs):
    def remplacer(m):
        balise, attributs, avant, etiquette, apres = m.groups()
        if not condition_vraie(etiquette, m.group(0), contexte, valeurs):
            return ''
        suite = apres.lstrip()
        if not BALISES.sub('', avant).strip() or BALISES.sub('', avant).rstrip()[-1] in '.!?':  # début de phrase
            suite = re.sub(r'^((?:<[^>]+>)*)(\w)', lambda d: d.group(1) + d.group(2).upper(), suite, count=1)
        return f'<{balise}{attributs or ""}>{avant}{suite}</{balise}>'

    contenu = BLOC_CONDITIONNEL.sub(remplacer, contenu)
    # Puce ou liste devenues vides (éditeur : <li><p>…</p></li>)
    contenu = re.sub(r'<li>\s*</li>', '', contenu)
    return re.sub(r'<ul>\s*</ul>', '', contenu)


def remplir(contenu, contexte):
    """Le contenu du modèle rempli pour ce destinataire : conditions appliquées, variables remplacées par leur valeur
    (échappée), vide si absente (RG21). Pas encore de logo (Paramètres) : l'emplacement « LOGO » est retiré."""
    valeurs = valeurs_document(contexte)
    contenu = appliquer_conditions(contenu or '', contexte, valeurs)
    contenu = re.sub(r'<span class="logo-ph">.*?</span>', '', contenu, flags=re.DOTALL)
    return VARIABLE.sub(lambda m: html.escape(valeurs.get(m.group(1), '')), contenu)


# ---- PDF ----

CSS_PDF = '''
@page { size: A4; margin: 1.8cm 2cm; }
body { font-family: Helvetica; font-size: 10pt; line-height: 1.4; color: #111827; }
h1 { font-size: 15pt; text-align: center; margin: 12pt 0 4pt 0; }
h3 { font-size: 11pt; margin: 10pt 0 3pt 0; }
p { margin: 3pt 0; }
ul, ol { margin: 3pt 0; }
table.entete { width: 100%; border-bottom: 2px solid #0F766E; margin-bottom: 6pt; }
td.entete-logo { width: 35%; vertical-align: top; color: #0F766E; font-weight: bold; }
td.entete-coord { width: 65%; vertical-align: top; text-align: right; font-size: 9pt; }
'''


def _entete_en_tableau(contenu):
    """En-tête des modèles (<div class="eh"> : logo puis coordonnées) en tableau : le PDF ne sait pas aligner
    deux blocs côte à côte autrement."""
    def remplacer(m):
        parties = re.findall(r'<span(?:\s[^>]*)?>(.*?)</span>', m.group(1), re.DOTALL)
        logo, coordonnees = ('', parties[-1]) if len(parties) < 2 else (parties[0], parties[-1])
        return (f'<table class="entete"><tr><td class="entete-logo">{logo}</td>'
                f'<td class="entete-coord">{coordonnees}</td></tr></table>')
    return re.sub(r'<div class="eh">(.*?)</div>', remplacer, contenu, flags=re.DOTALL)


def pdf_depuis_html(contenu, titre=''):
    """Le document rempli en PDF (octets). Lève PdfImpossible si la conversion échoue."""
    page = (f'<html><head><meta charset="utf-8"><title>{html.escape(titre)}</title><style>{CSS_PDF}</style></head>'
            f'<body>{_entete_en_tableau(contenu)}</body></html>')
    sortie = io.BytesIO()
    resultat = pisa.CreatePDF(page, dest=sortie, encoding='utf-8')
    if resultat.err:
        raise PdfImpossible()
    return sortie.getvalue()


# ---- Service ----

class DocumentSessionService:
    """Onglet Documents d'une session (SCRUM-220)."""

    @staticmethod
    def _session(utilisateur, session_id):
        session = (Session.objects.filter(pk=session_id, formation__in=formations_visibles(utilisateur))
                   .select_related('formation').prefetch_related('formateurs', 'formation__sequences').first())
        if session is None:
            raise SessionIntrouvable()
        return session

    @staticmethod
    def _type(type_modele):
        origine = ModeleOrigine.objects.filter(type=str(type_modele).upper()).first()
        if origine is None:
            raise ModeleIntrouvable()
        return origine

    @staticmethod
    def modele_a_utiliser(utilisateur, session, origine):
        """RG20 : (contenu, source) : modèle de la formation, sinon modèle générique du compte, sinon d'origine."""
        sien = ModeleFormation.objects.filter(formation=session.formation, type=origine.type).first()
        if sien is not None:
            return sien.contenu, DocumentGenere.Source.FORMATION
        generique = ModeleGenerique.objects.filter(proprietaire=utilisateur, type=origine.type).first()
        return (generique.contenu if generique else origine.contenu), DocumentGenere.Source.GENERIQUE

    def lister(self, utilisateur, session_id):
        """L'en-tête de la session et, pour chaque document, le modèle utilisé (celui des documents générés, sinon
        celui qui serait utilisé maintenant) et les documents déjà générés."""
        session = self._session(utilisateur, session_id)
        generes = {}
        for d in session.documents.order_by('date_generation', 'id').only(
                'id', 'type', 'source', 'destinataire', 'numero', 'date_generation'):
            generes.setdefault(d.type, []).append(d)
        documents = []
        for origine in ModeleOrigine.objects.all().order_by('id'):
            siens = generes.get(origine.type, [])
            source = siens[0].source if siens else self.modele_a_utiliser(utilisateur, session, origine)[1]
            documents.append({'type': origine.type, 'nom': origine.nom, 'source': source, 'generes': [
                {'id': d.id, 'numero': d.numero, 'destinataire': d.destinataire, 'source': d.source,
                 'date_generation': d.date_generation} for d in siens]})
        ordre = list(TypeModele.values)
        documents.sort(key=lambda d: ordre.index(d['type']))
        return {'session': {'id': session.id, 'formation': session.formation.intitule,
                            'date_debut': session.date_debut, 'date_fin': session.date_fin,
                            'modalite': session.modalite, 'lieu': session.lieu,
                            'formateurs': [_personne(f.prenom, f.nom) for f in session.formateurs.all()]},
                'documents': documents}

    def generer(self, utilisateur, session_id, type_modele):
        """POST …/generer : vérifie qu'il y a des destinataires (400 sinon), puis génère (RG22 : contenu et PDF
        figés). Une nouvelle génération remplace les documents de ce type déjà générés pour la session."""
        session = self._session(utilisateur, session_id)
        origine = self._type(type_modele)
        apprenants = list(session.apprenants.select_related('entreprise_cliente').order_by('nom', 'prenom', 'id'))
        if not apprenants:
            raise GenerationImpossible('SESSION_SANS_APPRENANT',
                                       'Cette session n’a pas d’apprenant : ajoutez des apprenants avant de générer les documents.')
        if origine.type == TypeModele.CONVENTION:
            entreprises = {a.entreprise_cliente_id: a.entreprise_cliente for a in apprenants if a.entreprise_cliente_id}
            if not entreprises:
                raise GenerationImpossible('SANS_ENTREPRISE_CLIENTE', MESSAGE_SANS_CLIENT)
            destinataires = [(None, e, [a for a in apprenants if a.entreprise_cliente_id == e.id])
                             for e in sorted(entreprises.values(), key=lambda e: e.raison_sociale)]
        else:
            destinataires = [(a, a.entreprise_cliente, apprenants) for a in apprenants]
        return self._generer(utilisateur, session, origine.type, origine, destinataires)

    @log_metier("service", champs=[CHAMP_ORGANISME, "session.id", "type_modele", "resultat.nombre"],
                message="Document de session généré", message_echec="Erreur de génération PDF")
    def _generer(self, utilisateur, session, type_modele, origine, destinataires):
        contenu, source = self.modele_a_utiliser(utilisateur, session, origine)
        maintenant = timezone.now()
        with transaction.atomic():
            DocumentGenere.objects.filter(session=session, type=type_modele).delete()
            for apprenant, entreprise, concernes in destinataires:
                destinataire = entreprise.raison_sociale if apprenant is None else _personne(apprenant.prenom, apprenant.nom)
                document = DocumentGenere.objects.create(
                    session=session, type=type_modele, source=source, apprenant=apprenant, entreprise=entreprise,
                    destinataire=destinataire, contenu='', date_generation=maintenant)
                document.numero = f'{PREFIXES[type_modele]}-{maintenant.year}-{document.pk:04d}'
                contexte = Contexte(session=session, organisme=utilisateur.organisme, apprenant=apprenant,
                                    entreprise=entreprise, apprenants=concernes, numero=document.numero,
                                    date_generation=timezone.localdate(maintenant))
                document.contenu = remplir(contenu, contexte)
                document.fichier = pdf_depuis_html(document.contenu, f'{origine.nom} {document.numero}')
                document.save(update_fields=['numero', 'contenu', 'fichier'])
        return {'type': type_modele, 'source': source, 'nombre': len(destinataires)}

    def pdf(self, utilisateur, session_id, document_id):
        """Le PDF figé d'un document (organisme connecté seulement, 404 sinon) : (octets, nom du fichier)."""
        session = self._session(utilisateur, session_id)
        document = DocumentGenere.objects.filter(session=session, pk=document_id).first()
        if document is None or not document.fichier:
            raise DocumentIntrouvable()
        nom = dict(TypeModele.choices)[document.type]
        return bytes(document.fichier), f'{nom} - {document.destinataire} - {document.numero}.pdf'


document_session_service = DocumentSessionService()
