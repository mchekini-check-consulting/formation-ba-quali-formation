"""SCRUM-220 « Utiliser le bon modèle pour générer les documents d'une session » (RG20, RG21, RG22) :
GET /sessions/<id>/documents/, POST /sessions/<id>/documents/<type>/generer, GET /sessions/<id>/documents/<doc>/pdf."""

import io
import json
from datetime import date, time
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import Client, SimpleTestCase, TestCase
from pypdf import PdfReader

from quali_formation.documents_session import (
    MESSAGE_SANS_CLIENT,
    Contexte,
    appliquer_conditions,
    date_fr,
    heures_fr,
    montant_fr,
    nombre_fr,
    remplir,
)
from quali_formation.models import (
    Apprenant,
    DocumentGenere,
    Entreprise,
    Formateur,
    Formation,
    ModeleFormation,
    ModeleGenerique,
    ModeleOrigine,
    Session,
)
from quali_formation.tests import connecter, connecter_existant


def texte_pdf(octets):
    return ' '.join(page.extract_text() for page in PdfReader(io.BytesIO(octets)).pages)


class DocumentsSessionTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        org = self.compte.organisme
        self.formation = Formation.objects.create(reference='F-1', intitule='Excel intermédiaire', proprietaire=self.compte,
                                                  duree_heures=Decimal(14), modalite='PRESENTIEL')
        self.cobalt = Entreprise.objects.create(organisme=org, raison_sociale='Cobalt Industrie', siret='98765432100021')
        self.paul = Apprenant.objects.create(organisme=org, prenom='Paul', nom='Garnier', email='p@exemple.fr',
                                             entreprise_cliente=self.cobalt)
        self.ines = Apprenant.objects.create(organisme=org, prenom='Inès', nom='Moreau', email='i@exemple.fr')
        self.session = Session.objects.create(formation=self.formation, date_debut=date(2026, 11, 21),
                                              date_fin=date(2026, 11, 22), heure_debut=time(9), heure_fin=time(17),
                                              lieu='Lyon, salle A')
        self.session.apprenants.add(self.paul, self.ines)
        self.session.formateurs.add(Formateur.objects.create(organisme=org, prenom='Nadia', nom='Benali',
                                                             email='n@exemple.fr', specialites='Bureautique'))

    def url(self, suite='', session=None):
        return f'/sessions/{(session or self.session).pk}/documents/{suite}'

    def generer(self, type_modele='CONVOCATION', session=None):
        return self.client.post(self.url(f'{type_modele}/generer', session))

    def liste(self):
        return {d['type']: d for d in self.client.get(self.url()).json()['documents']}

    def documents(self, type_modele='CONVOCATION'):
        return list(DocumentGenere.objects.filter(session=self.session, type=type_modele).order_by('destinataire'))

    # ---- RG20 : le bon modèle ----

    def test_ca1_rg20_la_formation_a_son_modele_de_convocation_source_formation(self):
        ModeleFormation.objects.create(formation=self.formation, type='CONVOCATION',
                                       contenu='<h1>CONVOCATION EXCEL</h1><p>{{apprenant_prenom}}</p>')
        self.assertEqual(self.liste()['CONVOCATION']['source'], 'FORMATION')  # avant génération : celui qui servira
        reponse = self.generer()
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.json(), {'type': 'CONVOCATION', 'source': 'FORMATION', 'nombre': 2})
        for document in self.documents():
            self.assertEqual(document.source, DocumentGenere.Source.FORMATION)
            self.assertIn('CONVOCATION EXCEL', document.contenu)
        self.assertEqual({g['source'] for g in self.liste()['CONVOCATION']['generes']}, {'FORMATION'})

    def test_ca2_rg20_sans_modele_de_la_formation_le_modele_generique_du_compte(self):
        ModeleGenerique.objects.create(proprietaire=self.compte, type='CONVOCATION',
                                       contenu='<h1>CONVOCATION DU CENTRE</h1>')
        self.generer()
        self.assertEqual({(d.source, '<h1>CONVOCATION DU CENTRE</h1>' in d.contenu) for d in self.documents()},
                         {('GENERIQUE', True)})
        self.assertEqual(self.liste()['CONVOCATION']['source'], 'GENERIQUE')

    def test_ca2_rg20_sans_modele_generique_le_modele_d_origine_colonne_modele_generique(self):
        self.generer()
        document = next(d for d in self.documents() if d.apprenant_id == self.paul.pk)
        self.assertEqual(document.source, 'GENERIQUE')
        self.assertIn('CONVOCATION À LA FORMATION', document.contenu)
        self.assertEqual({d['source'] for d in self.liste().values()}, {'GENERIQUE'})

    # ---- Remplissage ----

    def test_ca3_le_nom_de_l_apprenant_et_les_dates_de_la_session_dans_le_pdf(self):
        self.generer()
        document = next(d for d in self.documents() if d.apprenant_id == self.paul.pk)
        self.assertEqual(document.destinataire, 'Paul Garnier')
        self.assertNotIn('{{', document.contenu)
        texte = texte_pdf(bytes(document.fichier))
        for attendu in ('Garnier', '21/11/2026', '22/11/2026', 'Excel intermédiaire', '9h00-17h00', 'Nadia Benali',
                        'Cobalt Industrie'):
            self.assertIn(attendu, texte)

    def test_ca4_rg21_information_jamais_saisie_vide_sans_erreur(self):
        # La civilité, l'adresse de l'apprenant et le matériel n'existent pas : place vide, pas d'erreur
        ModeleFormation.objects.create(formation=self.formation, type='CONVOCATION',
                                       contenu='<p>[{{apprenant_civilite}}] {{apprenant_nom}}</p><p>[{{session_materiel}}]'
                                               '[{{code_inconnu}}]</p>')
        self.assertEqual(self.generer().status_code, 201)
        document = next(d for d in self.documents() if d.apprenant_id == self.paul.pk)
        self.assertEqual(document.contenu, '<p>[] Garnier</p><p>[][]</p>')

    def test_un_pdf_par_apprenant_pour_contrat_convocation_attestation(self):
        for type_modele in ('CONTRAT', 'CONVOCATION', 'ATTESTATION'):
            self.assertEqual(self.generer(type_modele).json()['nombre'], 2)
            self.assertEqual([d.destinataire for d in self.documents(type_modele)], ['Inès Moreau', 'Paul Garnier'])
            self.assertTrue(all(bytes(d.fichier).startswith(b'%PDF') for d in self.documents(type_modele)))

    def test_convention_un_pdf_par_entreprise_cliente_avec_ses_apprenants(self):
        autre = Entreprise.objects.create(organisme=self.compte.organisme, raison_sociale='Alpha', siret='11111111100011')
        lea = Apprenant.objects.create(organisme=self.compte.organisme, prenom='Léa', nom='Petit', email='l@exemple.fr',
                                       entreprise_cliente=self.cobalt, poste='Comptable')
        self.session.apprenants.add(lea, Apprenant.objects.create(organisme=self.compte.organisme, prenom='Zoé',
                                                                  nom='Durand', email='z@exemple.fr', entreprise_cliente=autre))
        self.assertEqual(self.generer('CONVENTION').json()['nombre'], 2)  # Inès (particulier) n'a pas de convention
        cobalt = DocumentGenere.objects.get(session=self.session, type='CONVENTION', entreprise=self.cobalt)
        self.assertEqual(cobalt.destinataire, 'Cobalt Industrie')
        self.assertIn('2 participants', cobalt.contenu.replace('accueillera ', ''))
        self.assertIn('Paul Garnier, Léa Petit (Comptable)', cobalt.contenu)
        self.assertNotIn('Zoé', cobalt.contenu)

    def test_numero_unique_par_type_et_annee(self):
        self.generer('CONVENTION')
        self.generer('CONTRAT')
        numeros = list(DocumentGenere.objects.values_list('numero', flat=True))
        self.assertEqual(len(numeros), len(set(numeros)))
        self.assertRegex(DocumentGenere.objects.get(type='CONVENTION').numero, r'^CONV-\d{4}-\d{4}$')

    # ---- RG22 : document figé ----

    def test_ca5_rg22_modele_modifie_retabli_ou_supprime_apres_generation_document_inchange(self):
        sien = ModeleFormation.objects.create(formation=self.formation, type='CONVOCATION', contenu='<p>Version 1</p>')
        self.generer()
        avant = {d.pk: (d.contenu, bytes(d.fichier), d.source) for d in self.documents()}
        url = f'/formations/{self.formation.pk}/modeles/CONVOCATION/'
        self.client.put(url, data=json.dumps({'contenu': '<p>Version 2</p>'}), content_type='application/json')
        self.client.post(f'{url}reinitialiser')
        self.client.put('/modeles/CONVOCATION', data=json.dumps({'contenu': '<p>Générique</p>'}),
                        content_type='application/json')
        sien.delete()
        apres = {d.pk: (d.contenu, bytes(d.fichier), d.source) for d in self.documents()}
        self.assertEqual(apres, avant)
        self.assertTrue(all('Version 1' in c for c, _, _ in apres.values()))

    def test_3a_generer_a_nouveau_remplace_les_documents_de_ce_type(self):
        self.generer()
        self.generer('CONTRAT')
        anciens = {d.pk for d in self.documents()}
        ModeleFormation.objects.create(formation=self.formation, type='CONVOCATION', contenu='<p>Nouveau</p>')
        self.assertEqual(self.generer().status_code, 201)
        nouveaux = self.documents()
        self.assertEqual(len(nouveaux), 2)
        self.assertFalse(anciens & {d.pk for d in nouveaux})
        self.assertTrue(all(d.source == 'FORMATION' for d in nouveaux))
        self.assertEqual(len(self.documents('CONTRAT')), 2)  # les autres types ne changent pas

    # ---- Refus ----

    def test_400_session_sans_apprenant(self):
        vide = Session.objects.create(formation=self.formation, date_debut=date(2026, 12, 1), date_fin=date(2026, 12, 1))
        reponse = self.generer(session=vide)
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'SESSION_SANS_APPRENANT'))
        self.assertFalse(DocumentGenere.objects.exists())

    def test_400_convention_sans_entreprise_cliente_message_de_la_ba(self):
        self.session.apprenants.remove(self.paul)
        reponse = self.generer('CONVENTION')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json()['detail'], MESSAGE_SANS_CLIENT)
        self.assertEqual(MESSAGE_SANS_CLIENT, 'Aucun apprenant de cette session n’est rattaché à une entreprise cliente : '
                         'pas de convention à générer. Pour un particulier qui finance lui-même sa formation, générez le '
                         'contrat de formation.')

    def test_document_inconnu_404(self):
        self.assertEqual(self.generer('INCONNU').status_code, 404)

    # ---- Téléchargement et sécurité ----

    def test_telecharger_le_pdf(self):
        self.generer()
        document = self.documents()[0]
        reponse = self.client.get(self.url(f'{document.pk}/pdf'))
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse['Content-Type'], 'application/pdf')
        self.assertEqual(reponse['Cache-Control'], 'no-store')
        self.assertIn('attachment', reponse['Content-Disposition'])
        self.assertTrue(reponse.content.startswith(b'%PDF'))

    def test_autre_organisme_404_partout(self):
        self.generer()
        document = self.documents()[0]
        connecter(self.client, 'autre@organisme-b.fr')
        self.assertEqual(self.client.get(self.url()).status_code, 404)
        self.assertEqual(self.generer().status_code, 404)
        self.assertEqual(self.client.get(self.url(f'{document.pk}/pdf')).status_code, 404)
        connecter_existant(self.client, self.compte)
        self.assertEqual(len(self.documents()), 2)

    def test_pdf_d_une_autre_session_404(self):
        self.generer()
        document = self.documents()[0]
        autre = Session.objects.create(formation=self.formation, date_debut=date(2026, 12, 1), date_fin=date(2026, 12, 1))
        self.assertEqual(self.client.get(self.url(f'{document.pk}/pdf', autre)).status_code, 404)

    def test_non_connecte_401(self):
        self.generer()
        document = self.documents()[0]
        anonyme = Client()
        for reponse in (anonyme.get(self.url()), anonyme.post(self.url('CONVOCATION/generer')),
                        anonyme.get(self.url(f'{document.pk}/pdf'))):
            self.assertEqual(reponse.status_code, 401)

    def test_liste_en_tete_et_ordre_des_documents(self):
        corps = self.client.get(self.url()).json()
        self.assertEqual(corps['session']['formation'], 'Excel intermédiaire')
        self.assertEqual(corps['session']['formateurs'], ['Nadia Benali'])
        self.assertEqual([d['type'] for d in corps['documents']], ['CONVENTION', 'CONTRAT', 'CONVOCATION', 'ATTESTATION'])
        self.assertTrue(all(d['generes'] == [] for d in corps['documents']))

    # ---- Logs ----

    def test_log_info_document_de_session_genere_sans_nom_ni_contenu(self):
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.generer()
        (ligne,) = logs.records
        self.assertEqual((ligne.levelname, ligne.layer, ligne.getMessage()), ('INFO', 'service', 'Document de session généré'))
        self.assertEqual((getattr(ligne, 'utilisateur.organisme_id'), getattr(ligne, 'session.id'), ligne.type_modele,
                          getattr(ligne, 'resultat.nombre')),
                         (str(self.compte.organisme_id), str(self.session.pk), 'CONVOCATION', '2'))
        texte = json.dumps(ligne.__dict__, default=str)
        for interdit in ('Garnier', 'Paul', 'Moreau', 'Cobalt', 'CONVOCATION À', 'camille@'):
            self.assertNotIn(interdit, texte)

    def test_log_error_erreur_de_generation_pdf_rien_n_est_enregistre(self):
        self.generer()
        avant = {d.pk for d in self.documents()}
        with patch('quali_formation.documents_session.pisa.CreatePDF', return_value=SimpleNamespace(err=1)), \
                self.assertLogs('quali_formation.metier', level='ERROR') as logs:
            reponse = self.generer()
        self.assertEqual((reponse.status_code, reponse.json()['code']), (500, 'PDF_IMPOSSIBLE'))
        (ligne,) = logs.records
        self.assertEqual((ligne.levelname, ligne.getMessage()), ('ERROR', 'Erreur de génération PDF'))
        self.assertNotIn('Garnier', json.dumps(ligne.__dict__, default=str))
        self.assertEqual({d.pk for d in self.documents()}, avant)  # les anciens documents restent


class FormatsEtConditionsTests(SimpleTestCase):
    def test_formats_francais(self):
        self.assertEqual(date_fr(date(2027, 1, 5)), '05/01/2027')
        self.assertEqual(date_fr(None), '')
        self.assertEqual(montant_fr(Decimal(2400)), '2 400,00 €')
        self.assertEqual(montant_fr(Decimal('1234567.5')), '1 234 567,50 €')
        self.assertEqual(montant_fr(None), '')
        self.assertEqual(nombre_fr(Decimal('7.50')), '7,5')
        self.assertEqual(heures_fr(Decimal('14.00')), '14 heures')
        self.assertEqual(heures_fr(None), '')

    def contexte(self, modalite='PRESENTIEL', entreprise=None, dedit=''):
        session = SimpleNamespace(modalite=modalite)
        return Contexte(session=session, entreprise=entreprise, organisme=SimpleNamespace(montant_dedit=dedit))

    def appliquer(self, html, contexte, valeurs=None):
        return appliquer_conditions(html, contexte, valeurs or {})

    def test_si_distanciel_ou_mixte(self):
        html = '<ul><li>Lieu : A</li><li><em class="cond">Si distanciel ou mixte :</em> part à distance</li></ul>'
        self.assertEqual(self.appliquer(html, self.contexte('PRESENTIEL')), '<ul><li>Lieu : A</li></ul>')
        self.assertEqual(self.appliquer(html, self.contexte('MIXTE')), '<ul><li>Lieu : A</li><li>Part à distance</li></ul>')
        self.assertEqual(self.appliquer('<ul><li><em class="cond">Si distanciel :</em> lien</li></ul>',
                                        self.contexte('PRESENTIEL')), '')

    def test_si_un_dedit_est_prevu_au_milieu_d_un_paragraphe(self):
        html = '<p>Annulation. <em class="cond">Si un dédit est prévu :</em> l\'entreprise verse {{org_dedit}}.</p>'
        self.assertEqual(self.appliquer(html, self.contexte(), {'org_dedit': '30 %'}),
                         '<p>Annulation. L\'entreprise verse {{org_dedit}}.</p>')
        self.assertEqual(self.appliquer(html, self.contexte(), {'org_dedit': ''}), '')

    def test_si_salarie(self):
        html = '<p><em class="cond">Si salarié :</em> salarié(e) de {{client_nom}}</p>'
        self.assertEqual(self.appliquer(html, self.contexte()), '')
        self.assertEqual(self.appliquer(html, self.contexte(entreprise=object())), '<p>Salarié(e) de {{client_nom}}</p>')

    def test_condition_inconnue_affichee_seulement_si_ses_variables_ont_une_valeur(self):
        html = '<ul><li><em class="cond">Si l\'analyse du besoin n\'est pas faite :</em> avant le {{session_date_questionnaire}}</li></ul>'
        self.assertEqual(self.appliquer(html, self.contexte()), '')
        self.assertEqual(self.appliquer(html, self.contexte(), {'session_date_questionnaire': '05/01/2027'}),
                         '<ul><li>Avant le {{session_date_questionnaire}}</li></ul>')

    def test_puce_de_l_editeur_avec_paragraphe(self):
        html = '<ul><li><p><em class="cond">Si distanciel :</em> lien</p></li></ul>'
        self.assertEqual(self.appliquer(html, self.contexte('PRESENTIEL')), '')


class RemplissageTests(TestCase):
    def test_valeurs_echappees_et_logo_retire(self):
        compte = connecter(self.client)
        formation = Formation.objects.create(reference='F-1', intitule='<script>alert(1)</script>', proprietaire=compte)
        session = Session.objects.create(formation=formation, date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 1))
        contenu = remplir('<div class="eh"><span class="logo-ph">LOGO</span><span>{{org_nom}}</span></div>'
                          '<h1>{{formation_intitule}}</h1>', Contexte(session=session, organisme=compte.organisme))
        self.assertEqual(contenu, '<div class="eh"><span>Cap Compétences</span></div>'
                                  '<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>')

    def test_les_4_modeles_d_origine_se_remplissent_et_deviennent_des_pdf(self):
        from quali_formation.documents_session import pdf_depuis_html
        compte = connecter(self.client)
        formation = Formation.objects.create(reference='F-1', intitule='Excel', proprietaire=compte)
        session = Session.objects.create(formation=formation, date_debut=date(2026, 1, 1), date_fin=date(2026, 1, 2))
        for origine in ModeleOrigine.objects.all():
            with self.subTest(origine.type):
                contenu = remplir(origine.contenu, Contexte(session=session, organisme=compte.organisme))
                self.assertNotIn('{{', contenu)
                self.assertNotIn('class="cond"', contenu)
                self.assertIn('Cap Compétences', texte_pdf(pdf_depuis_html(contenu, origine.nom)))
