"""SCRUM-119 : liste des formateurs du centre (tri, recherche, nombre de sessions), fenêtre « Nouveau formateur »
complétée (statut, NDA) et documents du formateur (CV, diplômes) enregistrés en base."""

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from quali_formation.models import (
    Formateur,
    FormateurDocument,
    Formation,
    Session,
    Utilisateur,
)
from quali_formation.services import TAILLE_MAX_DOCUMENT, ErreurMetier, session_service
from quali_formation.tests import connecter, creer_centre


def fichier(nom='CV_Marc_Garnier.pdf', contenu=b'%PDF-1.4 contenu', taille=None):
    return SimpleUploadedFile(nom, contenu if taille is None else b'0' * taille)


class FormateursTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        self.centre = self.compte.organisme

    def formateur(self, prenom, nom, **champs):
        champs.setdefault('email', f'{prenom.lower()}.{nom.lower()}@exemple.fr')
        return Formateur.objects.create(prenom=prenom, nom=nom, organisme=self.centre, **champs)

    def lister(self, recherche=None):
        url = '/formateurs/' if recherche is None else f'/formateurs/?recherche={recherche}'
        reponse = self.client.get(url)
        self.assertEqual(reponse.status_code, 200)
        return reponse.json()

    def poster(self, **corps):
        corps = {'prenom': 'Marc', 'nom': 'Garnier', 'email': 'marc.garnier@exemple.fr', **corps}
        return self.client.post('/formateurs/', corps, content_type='application/json')

    # ---- CA1 : triés par nom, avec e-mail et nombre de sessions ----

    def test_liste_triee_par_nom_avec_email_et_nombre_de_sessions(self):
        nadia = self.formateur('Nadia', 'Haddad')
        self.formateur('thomas', 'robert')  # minuscules : trié comme « Robert »
        self.formateur('Julien', 'Lefèvre')
        formation = Formation.objects.create(reference='FOR-1', intitule='Excel', proprietaire=self.compte)
        for jour in ('2026-12-01', '2026-12-08', '2026-12-15'):
            Session.objects.create(formation=formation, date_debut=jour, date_fin=jour).formateurs.add(nadia)

        formateurs = self.lister()
        self.assertEqual([f['nom'] for f in formateurs], ['Haddad', 'Lefèvre', 'robert'])
        self.assertEqual(formateurs[0], {
            'id': nadia.id, 'prenom': 'Nadia', 'nom': 'Haddad', 'email': 'nadia.haddad@exemple.fr', 'specialites': '',
            'entreprise': '', 'statut': '', 'numero_nda': '', 'nombre_sessions': 3})
        self.assertEqual(formateurs[1]['nombre_sessions'], 0)

    # ---- CA2 : recherche par nom ou e-mail ----

    def test_recherche_par_nom_ou_email(self):
        self.formateur('Sarah', 'Morel')
        self.formateur('Thomas', 'Robert', email='t.robert@globex.fr')
        self.formateur('Julien', 'Lefèvre', entreprise='Morel Conseil')  # l'entreprise n'est pas cherchée
        self.assertEqual([f['nom'] for f in self.lister('MOREL')], ['Morel'])
        self.assertEqual([f['nom'] for f in self.lister('globex')], ['Robert'])
        self.assertEqual([f['nom'] for f in self.lister('sarah morel')], ['Morel'])
        self.assertEqual(self.lister('  '), self.lister())
        self.assertEqual(self.lister('inconnu'), [])

    # ---- CA3 : aucun formateur ----

    def test_aucun_formateur(self):
        self.assertEqual(self.lister(), [])

    # ---- CA4 / CA5 : statut et NDA ----

    def test_cree_un_sous_traitant_avec_son_nda(self):
        reponse = self.poster(statut='SOUS_TRAITANT', numero_nda='117 565 432 10')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual({k: reponse.json()[k] for k in ('statut', 'numero_nda', 'nombre_sessions')},
                         {'statut': 'SOUS_TRAITANT', 'numero_nda': '11756543210', 'nombre_sessions': 0})
        formateur = Formateur.objects.get(pk=reponse.json()['id'])
        self.assertEqual((formateur.organisme, formateur.statut, formateur.numero_nda),
                         (self.centre, 'SOUS_TRAITANT', '11756543210'))

    def test_statut_et_nda_facultatifs(self):
        reponse = self.poster()
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual((reponse.json()['statut'], reponse.json()['numero_nda']), ('', ''))

    def test_nda_ignore_pour_un_salarie_ou_sans_statut(self):
        self.assertEqual(self.poster(statut='SALARIE', numero_nda='11756543210').json()['numero_nda'], '')
        self.assertEqual(self.poster(numero_nda='11756543210').json()['numero_nda'], '')

    def test_refuse_un_nda_qui_n_a_pas_11_chiffres(self):
        for nda in ('1175654321', '117565432100', '1175654321A'):
            reponse = self.poster(statut='SOUS_TRAITANT', numero_nda=nda)
            self.assertEqual(reponse.status_code, 400)
            self.assertEqual(reponse.json(), {'numero_nda': ['Le NDA doit contenir 11 chiffres']})
        self.assertFalse(Formateur.objects.filter(email='marc.garnier@exemple.fr').exists())

    def test_refuse_un_statut_inconnu(self):
        self.assertEqual(self.poster(statut='BENEVOLE').status_code, 400)
        self.assertFalse(Formateur.objects.filter(email='marc.garnier@exemple.fr').exists())

    # ---- CA8 : chaque centre ne voit que ses formateurs ----

    def test_ne_voit_pas_les_formateurs_d_un_autre_centre(self):
        self.formateur('Ana', 'Ici')
        Formateur.objects.create(prenom='Léo', nom='Ailleurs', email='leo@ailleurs.fr', organisme=creer_centre('Autre'))
        Formateur.objects.create(prenom='Sans', nom='Centre', email='sans@centre.fr')
        self.assertEqual([f['nom'] for f in self.lister()], ['Ici'])
        self.assertEqual(self.lister('ailleurs'), [])

    def test_compte_sans_centre_ne_voit_aucun_formateur(self):
        self.formateur('Ana', 'Ici')
        connecter(self.client, email='nouveau@organisme.fr', centre=False)
        self.assertEqual(self.client.get('/formateurs/').status_code, 403)  # renvoyé vers le formulaire du centre
        sans_centre = Utilisateur.objects.get(email='nouveau@organisme.fr')
        self.assertFalse(session_service.lister_formateurs(sans_centre).exists())
        with self.assertRaises(ErreurMetier):
            session_service.ajouter_document(sans_centre, self.formateur('Ana', 'Autre').id, 'CV', fichier())


class DocumentsFormateurTests(TestCase):
    """CA6 / CA7 : POST /formateurs/<id>/documents/, un fichier par appel."""

    def setUp(self):
        self.compte = connecter(self.client)
        self.formateur = Formateur.objects.create(prenom='Marc', nom='Garnier', email='marc.garnier@exemple.fr',
                                                  organisme=self.compte.organisme)

    def envoyer(self, type_document='CV', document=None, formateur=None):
        formateur = formateur or self.formateur
        corps = {'type': type_document}
        if document is not False:
            corps['fichier'] = document or fichier()
        return self.client.post(f'/formateurs/{formateur.id}/documents/', corps)

    def test_enregistre_le_cv_et_les_diplomes_en_base(self):
        reponse = self.envoyer('CV', fichier('CV_Marc_Garnier.pdf', b'%PDF cv'))
        self.assertEqual(reponse.status_code, 201)
        corps = reponse.json()
        self.assertEqual({k: corps[k] for k in ('type', 'nom_fichier', 'format', 'taille')},
                         {'type': 'CV', 'nom_fichier': 'CV_Marc_Garnier.pdf', 'format': 'pdf', 'taille': 7})
        self.assertNotIn('contenu', corps)
        for nom in ('Master.pdf', 'Titre.JPG', 'Licence.jpeg', 'Certificat.png', 'Ancien.doc'):
            self.assertEqual(self.envoyer('DIPLOME', fichier(nom)).status_code, 201)
        documents = self.formateur.documents.all()
        self.assertEqual([(d.type, d.format) for d in documents], [
            ('CV', 'pdf'), ('DIPLOME', 'pdf'), ('DIPLOME', 'jpg'), ('DIPLOME', 'jpeg'), ('DIPLOME', 'png'),
            ('DIPLOME', 'doc')])
        self.assertEqual(bytes(documents[0].contenu), b'%PDF cv')
        self.assertIsNotNone(documents[0].date_ajout)

    def test_accepte_un_document_word_recent(self):
        self.assertEqual(self.envoyer('DIPLOME', fichier('Diplome.docx')).status_code, 201)

    def test_refuse_un_autre_format(self):
        reponse = self.envoyer('CV', fichier('CV_complet.zip'))
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'code': 'FORMAT_INVALIDE',
                                          'detail': '« CV_complet.zip » refusé : format non accepté (PDF, JPG, PNG ou Word)'})
        self.assertFalse(FormateurDocument.objects.exists())

    def test_refuse_un_fichier_de_plus_de_10_mo(self):
        self.assertEqual(self.envoyer('CV', fichier('Juste.pdf', taille=TAILLE_MAX_DOCUMENT)).status_code, 201)
        reponse = self.envoyer('DIPLOME', fichier('CV_scan.pdf', taille=TAILLE_MAX_DOCUMENT + 1))
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'code': 'FICHIER_TROP_VOLUMINEUX', 'detail': '« CV_scan.pdf » refusé : plus de 10 Mo'})

    def test_refuse_un_sixieme_diplome_et_un_deuxieme_cv(self):
        for i in range(5):
            self.assertEqual(self.envoyer('DIPLOME', fichier(f'Diplome{i}.pdf')).status_code, 201)
        reponse = self.envoyer('DIPLOME', fichier('Habilitation.pdf'))
        self.assertEqual(reponse.json(), {'code': 'TROP_DE_DIPLOMES', 'detail': '« Habilitation.pdf » refusé : 5 diplômes maximum'})
        self.assertEqual(self.envoyer('CV').status_code, 201)
        reponse = self.envoyer('CV', fichier('Autre_CV.pdf'))
        self.assertEqual(reponse.json(), {'code': 'CV_DEJA_PRESENT', 'detail': '« Autre_CV.pdf » refusé : 1 CV maximum'})
        self.assertEqual(self.formateur.documents.count(), 6)

    def test_refuse_un_type_inconnu_ou_sans_fichier(self):
        self.assertEqual(self.envoyer('PHOTO').json()['code'], 'TYPE_INVALIDE')
        self.assertEqual(self.envoyer('CV', document=False).json()['code'], 'FICHIER_REQUIS')
        self.assertFalse(FormateurDocument.objects.exists())

    def test_formateur_d_un_autre_centre_introuvable(self):
        autre = Formateur.objects.create(prenom='Léo', nom='Ailleurs', email='leo@ailleurs.fr', organisme=creer_centre('Autre'))
        reponse = self.envoyer('CV', formateur=autre)
        self.assertEqual(reponse.status_code, 404)
        self.assertEqual(reponse.json()['code'], 'FORMATEUR_INTROUVABLE')
        self.assertFalse(FormateurDocument.objects.exists())

    def test_reserve_aux_comptes_connectes(self):
        self.client.logout()
        self.assertEqual(self.envoyer('CV').status_code, 401)

    def test_supprime_les_documents_avec_le_formateur(self):
        self.envoyer('CV')
        self.formateur.delete()
        self.assertFalse(FormateurDocument.objects.exists())
