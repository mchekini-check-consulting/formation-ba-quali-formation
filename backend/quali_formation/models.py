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
        ARCHIVEE = 'ARCHIVEE', 'Archivée'  # SCRUM-23

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
    # Compte qui a créé la formation : lui seul la voit et la modifie (formations_visibles dans services.py).
    # Vide pour les formations créées avant cette règle : elles ne sont plus visibles par personne.
    proprietaire = models.ForeignKey('Utilisateur', on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='formations')
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


class Organisme(models.Model):
    """Centre de formation (SCRUM-221) : une ligne par centre, créée à l'enregistrement du formulaire de première
    connexion. Raison sociale, SIRET et adresse obligatoires ; les autres informations sont facultatives.
    Le logo n'est pas encore enregistré (stockage traité dans une US dédiée)."""

    # Identité de l'organisme
    raison_sociale = models.CharField(max_length=255)
    siret = models.CharField(max_length=14)
    numero_declaration_activite = models.CharField(max_length=11, blank=True, default='')
    region_nda = models.CharField(max_length=100, blank=True, default='')
    adresse = models.CharField(max_length=500)
    ville_signature = models.CharField(max_length=100, blank=True, default='')
    # Représentant et contacts
    representant_legal = models.CharField(max_length=200, blank=True, default='')
    fonction_representant = models.CharField(max_length=100, blank=True, default='')
    email_contact = models.EmailField(max_length=254, blank=True, default='')
    telephone = models.CharField(max_length=30, blank=True, default='')
    referent_handicap = models.CharField(max_length=200, blank=True, default='')
    contact_stagiaires = models.CharField(max_length=254, blank=True, default='')
    contact_assistance_technique = models.CharField(max_length=254, blank=True, default='')
    # Conditions de vente
    regime_tva = models.CharField(max_length=255, blank=True, default='')
    penalites_retard = models.CharField(max_length=255, blank=True, default='')
    delai_annulation = models.CharField(max_length=100, blank=True, default='')
    montant_dedit = models.CharField(max_length=255, blank=True, default='')
    conditions_abandon = models.CharField(max_length=500, blank=True, default='')
    mediateur_consommation = models.CharField(max_length=255, blank=True, default='')
    ville_tribunal = models.CharField(max_length=100, blank=True, default='')
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'organisme'
        ordering = ('id',)

    def __str__(self):
        return self.raison_sociale


class Entreprise(models.Model):
    """Entreprise cliente du centre (SCRUM-112, table minimale ; complétée par SCRUM-113 et SCRUM-120).
    Un apprenant salarié peut y être rattaché."""

    raison_sociale = models.CharField(max_length=255)
    siret = models.CharField(max_length=14)
    organisme = models.ForeignKey(Organisme, on_delete=models.CASCADE, related_name='entreprises')
    # SCRUM-120 : OPCO (aucune saisie pour l'instant : « À confirmer »)
    opco = models.CharField(max_length=100, blank=True, default='')
    # SCRUM-113 : informations de l'établissement (remplies depuis l'annuaire, modifiables) ; adresse, code postal et
    # ville obligatoires à la création. Vides pour les entreprises créées avant.
    forme_juridique = models.CharField(max_length=100, blank=True, default='')
    code_naf = models.CharField(max_length=10, blank=True, default='')
    adresse = models.CharField(max_length=255, blank=True, default='')
    code_postal = models.CharField(max_length=10, blank=True, default='')
    ville = models.CharField(max_length=255, blank=True, default='')
    adresse_facturation = models.CharField(max_length=255, blank=True, default='')  # vide : identique à l'adresse
    email = models.EmailField(max_length=255, blank=True, default='')

    # Interlocuteur principal, facultatif (prénom et nom affichés dans la liste, SCRUM-120)
    class Role(models.TextChoices):
        RESSOURCES_HUMAINES = 'RESSOURCES_HUMAINES', 'Ressources humaines'
        MANAGER = 'MANAGER', 'Manager'
        COMPTABILITE = 'COMPTABILITE', 'Comptabilité'
        DIRIGEANT = 'DIRIGEANT', 'Dirigeant'

    interlocuteur_prenom = models.CharField(max_length=100, blank=True, default='')
    interlocuteur_nom = models.CharField(max_length=100, blank=True, default='')
    interlocuteur_role = models.CharField(max_length=30, choices=Role.choices, blank=True, default='')
    interlocuteur_email = models.EmailField(max_length=255, blank=True, default='')
    interlocuteur_telephone = models.CharField(max_length=10, blank=True, default='')

    class Meta:
        db_table = 'entreprise'
        ordering = ('raison_sociale', 'id')
        # SCRUM-113 : un SIRET une seule fois par centre (un autre centre peut enregistrer la même entreprise)
        constraints = (models.UniqueConstraint(fields=('siret', 'organisme'), name='entreprise_siret_unique_par_centre'),)

    def __str__(self):
        return self.raison_sociale


class Formateur(models.Model):
    """Un formateur, que l'on peut rattacher aux sessions (SCRUM-25 ; création : SCRUM-26)."""

    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    email = models.EmailField(max_length=255)
    specialites = models.CharField(max_length=255, blank=True)
    # SCRUM-166 : vide = « Individuel »
    entreprise = models.CharField(max_length=255, blank=True, default='')

    # SCRUM-119 : statut et n° de déclaration d'activité (NDA, 11 chiffres, pour un sous-traitant), facultatifs.
    # Vides pour les formateurs créés avant.
    class Statut(models.TextChoices):
        SALARIE = 'SALARIE', 'Salarié'
        SOUS_TRAITANT = 'SOUS_TRAITANT', 'Sous-traitant'

    statut = models.CharField(max_length=20, choices=Statut.choices, blank=True, default='')
    numero_nda = models.CharField(max_length=11, blank=True, default='')

    # SCRUM-221 : centre du formateur ; vide pour ceux créés avant (invisibles depuis)
    organisme = models.ForeignKey(Organisme, on_delete=models.CASCADE, null=True, blank=True, related_name='formateurs')

    class Meta:
        db_table = 'formateur'
        ordering = ('nom', 'prenom', 'id')

    def __str__(self):
        return f'{self.prenom} {self.nom}'


class FormateurDocument(models.Model):
    """Un document d'un formateur (SCRUM-119) : son CV (1 au plus) ou un diplôme (5 au plus). Le fichier lui-même
    est enregistré en base, dans `contenu` (pas de stockage de fichiers dans le projet)."""

    class Type(models.TextChoices):
        CV = 'CV', 'CV'
        DIPLOME = 'DIPLOME', 'Diplôme'

    formateur = models.ForeignKey(Formateur, on_delete=models.CASCADE, related_name='documents')
    type = models.CharField(max_length=10, choices=Type.choices)
    nom_fichier = models.CharField(max_length=255)
    format = models.CharField(max_length=10)  # extension, en minuscules : pdf, jpg, jpeg, png, doc, docx
    taille = models.PositiveIntegerField()  # en octets
    contenu = models.BinaryField()
    date_ajout = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'formateur_document'
        ordering = ('date_ajout', 'id')

    def __str__(self):
        return self.nom_fichier


class Apprenant(models.Model):
    """Un apprenant, que l'on peut inscrire aux sessions (SCRUM-25 ; création : SCRUM-27)."""

    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    email = models.EmailField(max_length=255)
    # SCRUM-166 : vide = « Individuel ». Ancien texte libre, affiché en secours depuis SCRUM-112
    entreprise = models.CharField(max_length=255, blank=True, default='')

    # SCRUM-112 : téléphone (10 chiffres), statut, entreprise cliente et poste (ces deux derniers pour un salarié).
    # Vides pour les apprenants créés avant.
    class Statut(models.TextChoices):
        SALARIE = 'SALARIE', 'Salarié'
        DEMANDEUR_EMPLOI = 'DEMANDEUR_EMPLOI', 'Demandeur d’emploi'
        INDEPENDANT = 'INDEPENDANT', 'Indépendant'
        PARTICULIER = 'PARTICULIER', 'Particulier'

    telephone = models.CharField(max_length=10, blank=True, default='')
    statut = models.CharField(max_length=20, choices=Statut.choices, blank=True, default='')
    entreprise_cliente = models.ForeignKey(Entreprise, on_delete=models.SET_NULL, null=True, blank=True,
                                           db_column='entreprise_id', related_name='apprenants')
    poste = models.CharField(max_length=255, blank=True, default='')

    # SCRUM-221 : centre du apprenant ; vide pour ceux créés avant (invisibles depuis)
    organisme = models.ForeignKey(Organisme, on_delete=models.CASCADE, null=True, blank=True, related_name='apprenants')

    class Meta:
        db_table = 'apprenant'
        ordering = ('nom', 'prenom', 'id')

    def __str__(self):
        return f'{self.prenom} {self.nom}'


class Session(models.Model):
    """Une session de la formation (RG38, SCRUM-25)."""

    # SCRUM-166 : mêmes modalités que la formation (les sessions « Classe virtuelle » sont devenues « Distanciel »)
    Modalite = Formation.Modalite

    class Statut(models.TextChoices):
        PREVUE = 'PREVUE', 'Prévue'

    formation = models.ForeignKey(Formation, on_delete=models.CASCADE, related_name='sessions')
    date_debut = models.DateField()
    date_fin = models.DateField()
    # Champs ajoutés par SCRUM-25, plus demandés depuis SCRUM-166 (conservés pour les sessions déjà enregistrées)
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

    class Role(models.TextChoices):
        GESTIONNAIRE = 'GESTIONNAIRE', 'Gestionnaire'
        UTILISATEUR = 'UTILISATEUR', 'Utilisateur'

    # SCRUM-221 : renseignés à l'enregistrement du formulaire de première connexion ;
    # organisme vide tant que ce formulaire n'est pas enregistré (l'application reste alors bloquée sur le formulaire)
    prenom = models.CharField(max_length=100, blank=True, default='')
    nom = models.CharField(max_length=100, blank=True, default='')
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.UTILISATEUR)
    organisme = models.ForeignKey(Organisme, on_delete=models.SET_NULL, null=True, blank=True, related_name='utilisateurs')

    class Meta:
        db_table = 'utilisateur'
        ordering = ('id',)

    def __str__(self):
        return self.email

    @property
    def nom_complet(self):
        """« Prénom Nom » (renseignés au formulaire de première connexion, SCRUM-221) : « Préparée par » des formations."""
        return f'{self.prenom} {self.nom}'.strip()


class FormationHistorique(models.Model):
    """Une ligne par action sur une formation : création (SCRUM-20), modification, archivage, restauration,
    suppression (SCRUM-23). Référence et intitulé sont recopiés : la ligne reste après la suppression de la formation."""

    class Action(models.TextChoices):
        CREATION = 'CREATION', 'Création'
        MODIFICATION = 'MODIFICATION', 'Modification'
        ARCHIVAGE = 'ARCHIVAGE', 'Archivage'
        RESTAURATION = 'RESTAURATION', 'Restauration'
        SUPPRESSION = 'SUPPRESSION', 'Suppression'

    formation = models.ForeignKey(Formation, on_delete=models.SET_NULL, null=True, blank=True, related_name='historique')
    reference = models.CharField(max_length=12)
    intitule = models.CharField(max_length=255)
    # Utilisateur connecté (SCRUM-16) ; vide si personne n'est connecté
    utilisateur = models.ForeignKey(Utilisateur, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    action = models.CharField(max_length=12, choices=Action.choices)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'formation_historique'
        ordering = ('date', 'id')

    def __str__(self):
        return f'{self.reference} : {self.action}'


class TypeModele(models.TextChoices):
    """Modèles de documents proposés (épic Modèles SCRUM-125, RG2 : seulement ces 4 ; les modèles prévus plus
    tard ne sont pas ajoutés ici tant qu'ils ne sont pas proposés). Liste fixe : pas de table."""

    CONVENTION = 'CONVENTION', 'Convention de formation'
    CONTRAT = 'CONTRAT', 'Contrat de formation'
    CONVOCATION = 'CONVOCATION', 'Convocation'
    ATTESTATION = 'ATTESTATION', 'Attestation de fin de formation'


class ModeleOrigine(models.Model):
    """Modèle d'origine fourni par l'application (RG1) : texte de modeles-origine.json chargé tel quel par
    migration (0011), commun à tous les comptes et jamais modifié (RG3). Variables écrites {{code}}."""

    type = models.CharField(max_length=12, choices=TypeModele.choices, unique=True)
    nom = models.CharField(max_length=100)
    contenu = models.TextField()  # HTML
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = 'modele_origine'
        ordering = ('id',)

    def __str__(self):
        return self.nom


class ModeleGenerique(models.Model):
    """Modèle générique d'un compte, créé à partir du modèle d'origine à la première modification (RG3) ;
    tant qu'il n'existe pas, le compte utilise le modèle d'origine (statut ORIGINE)."""

    class Statut(models.TextChoices):  # RG4
        ORIGINE = 'ORIGINE', "Modèle d'origine"
        PERSONNALISE = 'PERSONNALISE', 'Personnalisé'
        IMPORTE = 'IMPORTE', 'Mon document'

    proprietaire = models.ForeignKey(Utilisateur, on_delete=models.CASCADE, related_name='modeles_generiques')
    type = models.CharField(max_length=12, choices=TypeModele.choices)
    contenu = models.TextField()  # HTML ; aucun contrôle sur le contenu (RG12)
    statut = models.CharField(max_length=12, choices=Statut.choices, default=Statut.PERSONNALISE)
    nom_fichier_importe = models.CharField(max_length=255, null=True, blank=True)
    date_maj = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'modele_generique'
        constraints = (models.UniqueConstraint(fields=('proprietaire', 'type'), name='modele_generique_compte_type'),)

    def __str__(self):
        return f'{self.type} ({self.statut})'


class ModeleFormation(models.Model):
    """Modèle de la formation (SCRUM-218) : copie d'un modèle générique faite pour une formation, puis indépendante
    (RG17 : les modifications futures du modèle générique ne s'y appliquent pas). RG16 : au plus un par document."""

    formation = models.ForeignKey(Formation, on_delete=models.CASCADE, related_name='modeles')
    type = models.CharField(max_length=12, choices=TypeModele.choices)
    contenu = models.TextField()  # HTML, variables {{code}} (RG9)
    nom_fichier_importe = models.CharField(max_length=255, null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_maj = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'modele_formation'
        constraints = (models.UniqueConstraint(fields=('formation', 'type'), name='modele_formation_formation_type'),)

    def __str__(self):
        return f'{self.type} ({self.formation_id})'



class DocumentGenere(models.Model):
    """Document d'une session (SCRUM-220) : contenu rempli et PDF figés à la génération (RG22) ; modifier, rétablir ou
    supprimer le modèle ensuite ne les change pas. Un par apprenant (contrat, convocation, attestation), un par
    entreprise cliente (convention). Contient des données personnelles : servi seulement à l'organisme connecté."""

    class Source(models.TextChoices):  # RG20 : colonne « Modèle utilisé »
        FORMATION = 'FORMATION', 'Modèle de la formation'
        GENERIQUE = 'GENERIQUE', 'Modèle générique'

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='documents')
    type = models.CharField(max_length=12, choices=TypeModele.choices)
    source = models.CharField(max_length=10, choices=Source.choices)
    apprenant = models.ForeignKey(Apprenant, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    entreprise = models.ForeignKey(Entreprise, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    destinataire = models.CharField(max_length=255)  # nom figé au moment de la génération
    numero = models.CharField(max_length=20, unique=True, null=True, blank=True)  # TYPE-AAAA-NNNN, jamais réutilisé
    contenu = models.TextField()  # HTML rempli, figé
    fichier = models.BinaryField(null=True, blank=True)  # PDF figé (pas de disque permanent sur les serveurs)
    date_generation = models.DateTimeField()

    class Meta:
        db_table = 'document_genere'
        ordering = ('date_generation', 'id')

    def __str__(self):
        return self.numero or f'{self.type} ({self.session_id})'


class Variable(models.Model):
    """Variable d'un modèle de document (SCRUM-214), écrite {{code}} dans le texte (RG9) et remplacée par la
    vraie information à la génération du document. Liste du dictionnaire de données (variables.json)."""

    class Categorie(models.TextChoices):  # RG10 : dans l'ordre d'affichage du panneau Variables
        SESSION = 'Session'
        FORMATION = 'Formation'
        APPRENANT = 'Apprenant'
        CLIENT = 'Client'
        PRIX = 'Prix'
        FIN_DE_FORMATION = 'Fin de formation'
        DOCUMENT = 'Document'
        ORGANISME = 'Organisme'

    code = models.CharField(max_length=60, unique=True)
    libelle = models.CharField(max_length=120)
    categorie = models.CharField(max_length=20, choices=Categorie.choices)
    ordre = models.PositiveSmallIntegerField()  # ordre dans sa catégorie
    exemple = models.CharField(max_length=255, blank=True, default='')  # valeur de l'aperçu (SCRUM-214)

    class Meta:
        db_table = 'variable'

    def __str__(self):
        return self.code
