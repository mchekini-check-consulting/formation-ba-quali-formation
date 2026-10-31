from django.db import models


class Item(models.Model):
    """Ressource générique exposée par /items, modèle à renommer par l'équipe."""

    nom = models.CharField(max_length=200)
    description = models.CharField(max_length=1000, null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "item"
        ordering = ("id",)


class Formation(models.Model):
    """Une formation du catalogue ; les réponses aux 13 blocs Qualiopi sont dans `valeurs` (JSON)."""

    class Modalite(models.TextChoices):
        PRESENTIEL = 'PRESENTIEL', 'Présentiel'
        DISTANCIEL = 'DISTANCIEL', 'Distanciel'
        MIXTE = 'MIXTE', 'Mixte'

    # RG23
    class Statut(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        INCOMPLETE = 'INCOMPLETE', 'Incomplète selon Qualiopi'
        VALIDEE = 'VALIDEE', 'Validée'
        ARCHIVEE = 'ARCHIVEE', 'Archivée'

    # RG24 : seulement pour les formations validées ou incomplètes
    class Publication(models.TextChoices):
        A_PUBLIER = 'A_PUBLIER', 'À publier'
        PUBLIEE = 'PUBLIEE', 'Publiée'

    # RG03 : FOR-AAAA-NNN, attribuée au premier enregistrement
    reference = models.CharField(max_length=12, unique=True)
    # RG04 : 1 à la création, +1 à chaque modification enregistrée
    version = models.PositiveIntegerField(default=1)
    intitule = models.CharField(max_length=255)
    # RG02 : facultatives en brouillon
    duree_heures = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    modalite = models.CharField(max_length=10, choices=Modalite.choices, default=Modalite.PRESENTIEL)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.BROUILLON)
    publication = models.CharField(max_length=10, choices=Publication.choices, null=True, blank=True)
    organisme = models.CharField(max_length=255, default='Cap Compétences')
    preparee_par = models.CharField(max_length=255, default='Camille Laurent')
    valeurs = models.JSONField(default=dict, blank=True)
    autres_informations = models.JSONField(default=list, blank=True)  # [{titre, contenu}]
    date_creation = models.DateTimeField(auto_now_add=True)
    date_mise_a_jour = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-date_mise_a_jour', '-id')  # RG29

    def __str__(self):
        return f'{self.reference} — {self.intitule}'


class Sequence(models.Model):
    """Une séquence du programme (RG17, RG18)."""

    class Modalite(models.TextChoices):
        PRESENTIEL = 'PRESENTIEL', 'Présentiel'
        DISTANCIEL_SYNCHRONE = 'DISTANCIEL_SYNCHRONE', 'Distanciel synchrone (classe virtuelle)'
        DISTANCIEL_ASYNCHRONE = 'DISTANCIEL_ASYNCHRONE', 'Distanciel asynchrone (e-learning)'

    formation = models.ForeignKey(Formation, on_delete=models.CASCADE, related_name='sequences')
    ordre = models.PositiveIntegerField(default=0)
    titre = models.CharField(max_length=255)
    duree_heures = models.DecimalField(max_digits=7, decimal_places=2)
    objectif_vise = models.CharField(max_length=500)
    modalite = models.CharField(max_length=25, choices=Modalite.choices)
    contenu = models.TextField()
    methodes_activites = models.TextField()
    supports = models.TextField(blank=True)
    evaluation = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ('ordre', 'id')

    def __str__(self):
        return self.titre


class Session(models.Model):
    """Une session de la formation (RG38)."""

    formation = models.ForeignKey(Formation, on_delete=models.CASCADE, related_name='sessions')
    date_debut = models.DateField()
    date_fin = models.DateField()
    lieu = models.CharField(max_length=255, blank=True)
    nombre_places = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ('date_debut', 'id')

    def __str__(self):
        return f'{self.formation.intitule} : {self.date_debut} → {self.date_fin}'
