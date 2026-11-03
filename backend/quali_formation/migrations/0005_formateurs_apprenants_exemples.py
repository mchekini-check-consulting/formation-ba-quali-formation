# Formateurs et apprenants d'exemple de la maquette SCRUM-25, pour pouvoir créer des sessions
# avant que leur création soit disponible dans l'écran (SCRUM-26, SCRUM-27).
# Personnes fictives. N'ajoute que celles dont l'e-mail n'existe pas encore.

from django.db import migrations

FORMATEURS = [
    ('Sarah', 'Dubois', 'sarah.dubois@exemple.fr', 'Management, bureautique'),
    ('Marc', 'Roux', 'marc.roux@exemple.fr', 'Sécurité, SST'),
    ('Amina', 'Fontaine', 'amina.fontaine@exemple.fr', 'Langues'),
    ('Julien', 'Lefèvre', 'julien.lefevre@exemple.fr', 'Management'),
]

APPRENANTS = [
    ('Camille', 'Martin', 'camille.martin@acme.fr'),
    ('Hugo', 'Bernard', 'hugo.bernard@acme.fr'),
    ('Léa', 'Moreau', 'lea.moreau@acme.fr'),
    ('Yanis', 'Petit', 'yanis.petit@acme.fr'),
    ('Nora', 'Garcia', 'nora.garcia@acme.fr'),
    ('Théo', 'Laurent', 'theo.laurent@acme.fr'),
    ('Inès', 'Robert', 'ines.robert@acme.fr'),
    ('Malik', 'Benali', 'malik.benali@acme.fr'),
]


def ajouter_exemples(apps, schema_editor):
    Formateur = apps.get_model('quali_formation', 'Formateur')
    Apprenant = apps.get_model('quali_formation', 'Apprenant')
    for prenom, nom, email, specialites in FORMATEURS:
        Formateur.objects.get_or_create(email=email, defaults={'prenom': prenom, 'nom': nom, 'specialites': specialites})
    for prenom, nom, email in APPRENANTS:
        Apprenant.objects.get_or_create(email=email, defaults={'prenom': prenom, 'nom': nom})


def retirer_exemples(apps, schema_editor):
    apps.get_model('quali_formation', 'Formateur').objects.filter(email__in=[f[2] for f in FORMATEURS]).delete()
    apps.get_model('quali_formation', 'Apprenant').objects.filter(email__in=[a[2] for a in APPRENANTS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('quali_formation', '0004_sessions_formateurs_apprenants'),
    ]

    operations = [
        migrations.RunPython(ajouter_exemples, retirer_exemples),
    ]
