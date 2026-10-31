# Migration de jonction (équivalent de « makemigrations --merge », impossible ici car les deux
# migrations de départ n'ont pas d'ancêtre commun) : réunit 0001_item (main) et 0001_initial
# (module Formations), créées en parallèle. Aucune opération : elle fixe seulement l'ordre.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('quali_formation', '0001_initial'),
        ('quali_formation', '0001_item'),
    ]

    operations = [
    ]
