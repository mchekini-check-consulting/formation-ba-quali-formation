"""Règles de gestion du module Formations (RG01 à RG38), indépendantes de l'API pour être testées seules."""

from django.db import IntegrityError, transaction
from django.utils import timezone

from quali_formation.blocs import blocs_manquants
from quali_formation.models import Formation, Sequence, Session

Statut = Formation.Statut
Publication = Formation.Publication


class ErreurMetier(Exception):
    """Règle de gestion non respectée ; `code` permet au frontend d'ouvrir la bonne pop-up."""

    def __init__(self, code, message, statut_http=400, **details):
        super().__init__(message)
        self.code = code
        self.message = message
        self.statut_http = statut_http
        self.details = details


def manquants(formation):
    return blocs_manquants(formation.valeurs, formation.modalite, formation.sequences.count())


def _prochaine_reference():
    # RG03 : FOR-AAAA-NNN, numéro suivant pour l'année en cours
    annee = timezone.localdate().year
    prefixe = f'FOR-{annee}-'
    refs = Formation.objects.filter(reference__startswith=prefixe).values_list('reference', flat=True)
    numeros = [int(r[len(prefixe):]) for r in refs if r[len(prefixe):].isdigit()]
    return f'{prefixe}{max(numeros, default=0) + 1:03d}'


def _remplacer_sequences(formation, sequences):
    formation.sequences.all().delete()
    Sequence.objects.bulk_create(
        Sequence(formation=formation, ordre=i, **s) for i, s in enumerate(sequences)
    )


def enregistrer(formation, donnees, action, forcer=False):
    """Crée (formation=None) ou modifie une formation.

    action « brouillon » : seul l'intitulé est obligatoire (RG02) ;
    action « valider » : intitulé, durée > 0 et modalité obligatoires (RG01), puis Validée si tous les
    blocs sont complets (RG13), sinon refus sauf `forcer` qui l'enregistre Incomplète (RG14, RG15).
    """
    if not donnees['intitule'].strip():
        raise ErreurMetier('INTITULE_REQUIS', "L'intitulé est obligatoire.")
    sequences = donnees.pop('sequences')

    if action == 'valider':
        duree = donnees.get('duree_heures')
        if duree is None or duree <= 0 or not donnees.get('modalite'):
            raise ErreurMetier('BASE_INCOMPLETE', "Renseignez l'intitulé et une durée supérieure à 0.")
        manque = blocs_manquants(donnees['valeurs'], donnees['modalite'], len(sequences))
        if manque and not forcer:
            raise ErreurMetier('BLOCS_MANQUANTS', f'{len(manque)} bloc(s) ne sont pas remplis.', 409,
                               blocs=[b.id for b in manque])
        statut = Statut.INCOMPLETE if manque else Statut.VALIDEE
    elif formation is not None and formation.statut == Statut.ARCHIVEE:
        statut = Statut.ARCHIVEE  # enregistrer une formation archivée la laisse archivée
    else:
        statut = Statut.BROUILLON

    with transaction.atomic():
        nouvelle = formation is None
        if nouvelle:
            formation = Formation()
        else:
            formation.version += 1  # RG04
        for champ, valeur in donnees.items():
            setattr(formation, champ, valeur)
        formation.statut = statut
        # RG28 : une formation publiée qui repasse en brouillon redevient « À publier »
        if statut == Statut.BROUILLON:
            if formation.publication == Publication.PUBLIEE:
                formation.publication = Publication.A_PUBLIER
        elif statut in (Statut.VALIDEE, Statut.INCOMPLETE) and not formation.publication:
            formation.publication = Publication.A_PUBLIER

        if nouvelle:
            # RG03 + RG04 ; en cas d'enregistrements simultanés, le numéro suivant est repris
            for _ in range(5):
                formation.reference = _prochaine_reference()
                formation.version = 1
                try:
                    with transaction.atomic():
                        formation.save()
                    break
                except IntegrityError:
                    continue
            else:
                raise ErreurMetier('REFERENCE', "Impossible d'attribuer une référence, réessayez.", 409)
        else:
            formation.save()
        _remplacer_sequences(formation, sequences)
    return formation


def publier(formation, confirmer=False):
    # RG24 : un brouillon (ou une formation archivée) ne peut pas être publié
    if formation.statut not in (Statut.VALIDEE, Statut.INCOMPLETE):
        raise ErreurMetier('NON_PUBLIABLE', 'Seule une formation validée ou incomplète peut être publiée.', 409)
    # RG26
    if not formation.sequences.exists():
        raise ErreurMetier('PROGRAMME_REQUIS', 'Une formation ne peut pas être publiée sans son programme.', 409)
    # RG27
    if formation.statut == Statut.INCOMPLETE and not confirmer:
        raise ErreurMetier('CONFIRMATION_REQUISE', "Confirmez la publication d'une formation incomplète.", 409)
    formation.publication = Publication.PUBLIEE
    formation.save()
    return formation


def retirer_publication(formation):
    formation.publication = Publication.A_PUBLIER
    formation.save()
    return formation


def archiver(formation):
    # RG34 : la confirmation est demandée par l'écran ; une formation archivée ne reçoit plus de session
    formation.statut = Statut.ARCHIVEE
    formation.save()
    return formation


def restaurer(formation):
    # RG35 : retour en brouillon (et donc « À publier », RG28)
    formation.statut = Statut.BROUILLON
    if formation.publication == Publication.PUBLIEE:
        formation.publication = Publication.A_PUBLIER
    formation.save()
    return formation


def supprimer(formation, confirmation):
    # RG36 : pas de suppression d'une formation qui a des sessions, sauf si elle est archivée
    if formation.sessions.exists() and formation.statut != Statut.ARCHIVEE:
        raise ErreurMetier('A_DES_SESSIONS', 'Cette formation a des sessions : archivez-la plutôt.', 409)
    # RG37 : il faut taper « supprimer »
    if str(confirmation or '').strip().lower() != 'supprimer':
        raise ErreurMetier('CONFIRMATION_INVALIDE', 'Tapez « supprimer » pour confirmer.')
    formation.delete()


def ajouter_session(formation, date_debut, date_fin, lieu='', nombre_places=None):
    if formation.statut == Statut.ARCHIVEE:  # RG34
        raise ErreurMetier('ARCHIVEE', 'Une formation archivée ne reçoit plus de nouvelle session.', 409)
    if date_fin < date_debut:  # RG38
        raise ErreurMetier('DATES_INVALIDES', 'La date de fin ne peut pas être avant la date de début.')
    return Session.objects.create(formation=formation, date_debut=date_debut, date_fin=date_fin,
                                  lieu=lieu, nombre_places=nombre_places)
