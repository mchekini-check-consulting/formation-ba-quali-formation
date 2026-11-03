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
    publication = models.CharField(max_length=10, choices=Publication.choices, blank=True, default='')
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


class Formateur(models.Model):
    """Un formateur, que l'on peut rattacher aux sessions (SCRUM-25 ; création : SCRUM-26)."""

    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    email = models.EmailField(max_length=255)
    specialites = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'formateur'
        ordering = ('nom', 'prenom', 'id')

    def __str__(self):
        return f'{self.prenom} {self.nom}'


class Apprenant(models.Model):
    """Un apprenant, que l'on peut inscrire aux sessions (SCRUM-25 ; création : SCRUM-27)."""

    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    email = models.EmailField(max_length=255)

    class Meta:
        db_table = 'apprenant'
        ordering = ('nom', 'prenom', 'id')

    def __str__(self):
        return f'{self.prenom} {self.nom}'


class Session(models.Model):
    """Une session de la formation (RG38, SCRUM-25)."""

    class Modalite(models.TextChoices):
        PRESENTIEL = Formation.Modalite.PRESENTIEL.value, Formation.Modalite.PRESENTIEL.label
        CLASSE_VIRTUELLE = 'CLASSE_VIRTUELLE', 'Classe virtuelle'

    class Statut(models.TextChoices):
        PREVUE = 'PREVUE', 'Prévue'

    formation = models.ForeignKey(Formation, on_delete=models.CASCADE, related_name='sessions')
    date_debut = models.DateField()
    date_fin = models.DateField()
    # Champs ajoutés par SCRUM-25 : facultatifs pour les sessions déjà enregistrées
    heure_debut = models.TimeField(null=True, blank=True)
    heure_fin = models.TimeField(null=True, blank=True)
    duree_heures = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    modalite = models.CharField(max_length=20, choices=Modalite.choices, default=Modalite.PRESENTIEL)
    lieu = models.CharField(max_length=255, blank=True)
    lien_classe_virtuelle = models.CharField(max_length=500, blank=True)
    nombre_places = models.PositiveIntegerField(null=True, blank=True)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.PREVUE)
    formateurs = models.ManyToManyField(Formateur, related_name='sessions', blank=True)
    apprenants = models.ManyToManyField(Apprenant, related_name='sessions', blank=True)

    class Meta:
        ordering = ('date_debut', 'id')

    def __str__(self):
        return f'{self.formation.intitule} : {self.date_debut} → {self.date_fin}'


class Utilisateur(models.Model):
    """Compte du responsable d'un organisme de formation (SCRUM-15 « Créer un compte »).

    `email` est enregistré en minuscules, sans espaces autour : l'unicité ignore les majuscules (RG-CC-02).
    `mot_de_passe` contient uniquement le hash Django, jamais le mot de passe en clair (RG-CC-07)."""

    email = models.EmailField(max_length=254, unique=True)
    mot_de_passe = models.CharField(max_length=128)
    cgu_acceptees_le = models.DateTimeField()
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'utilisateur'
        ordering = ('id',)

    def __str__(self):
        return self.email
