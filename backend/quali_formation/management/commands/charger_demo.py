"""Charge les formations d'exemple de la maquette dans une base vide : python manage.py charger_demo"""

import json
from datetime import datetime, time
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from quali_formation.models import Formation, Sequence, Session

FICHIER = Path(__file__).resolve().parents[2] / 'demo' / 'formations_demo.json'


class Command(BaseCommand):
    help = "Charge les 9 formations d'exemple de la maquette (seulement si aucune formation n'existe)."

    def handle(self, *args, **options):
        if Formation.objects.exists():
            self.stdout.write(self.style.WARNING('Des formations existent déjà : rien n’est chargé (aucune donnée n’est supprimée).'))
            return
        exemples = json.loads(FICHIER.read_text(encoding='utf-8'))
        with transaction.atomic():
            for e in exemples:
                sequences, sessions = e.pop('sequences'), e.pop('sessions')
                maj = timezone.make_aware(datetime.combine(datetime.fromisoformat(e.pop('date_mise_a_jour')).date(), time(12)))
                # RG24 : une formation validée ou incomplète est au moins « À publier »
                if not e['publication']:
                    e['publication'] = Formation.Publication.A_PUBLIER if e['statut'] in ('VALIDEE', 'INCOMPLETE') else ''
                f = Formation.objects.create(**e)
                Sequence.objects.bulk_create(Sequence(formation=f, ordre=i, **s) for i, s in enumerate(sequences))
                Session.objects.bulk_create(Session(formation=f, **s) for s in sessions)
                # La date de mise à jour de l'exemple (auto_now l'écraserait avec save())
                Formation.objects.filter(pk=f.pk).update(date_creation=maj, date_mise_a_jour=maj)
        self.stdout.write(self.style.SUCCESS(f'{len(exemples)} formations d’exemple chargées.'))
