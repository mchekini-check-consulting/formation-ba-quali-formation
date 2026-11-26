"""SCRUM-216 « Télécharger un modèle en Word » : GET /modeles/<type>/export.docx (RG9)."""

import io
import re
from unittest.mock import patch
from urllib.parse import quote

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import RGBColor

from quali_formation.logging.formatter import JsonFormatter
from quali_formation.models import ModeleOrigine
from quali_formation.tests import connecter
from quali_formation.word_export import DOCX_MIME, docx_depuis_html

MIS_EN_FORME = ('<h1>Convocation</h1><h3>Informations pratiques</h3>'
                '<p style="text-align: center">Bonjour <strong>{{apprenant_prenom}}</strong>, <em>bienvenue</em> '
                '<u>le {{session_date_debut}}</u> <s>ancien tarif</s> <span style="color: #dc2626">important</span></p>'
                '<p style="text-align: justify">Justifié</p><p style="text-align: right">À droite</p>'
                '<ul><li><p>Lieu : {{session_lieu}}</p></li><li><p>Horaires</p></li></ul>'
                '<ol><li><p>Arriver</p></li><li><p>Signer</p></li></ol><p>Ligne 1<br>Ligne 2</p>')


def lire(reponse):
    return Document(io.BytesIO(reponse.content))


def numerotation(paragraphe):
    numpr = paragraphe._p.pPr.numPr
    return None if numpr is None else numpr.numId.val


class ExporterWordTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)

    def exporter(self, type_modele='CONVENTION', client=None):
        return (client or self.client).get(f'/modeles/{type_modele}/export.docx')

    def enregistrer(self, contenu, type_modele='CONVOCATION'):
        reponse = self.client.put(f'/modeles/{type_modele}', {'contenu': contenu}, content_type='application/json')
        self.assertEqual(reponse.status_code, 200)

    def test_ca1_fichier_docx_avec_le_bon_nom_accents_compris(self):
        reponse = self.exporter()
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse['Content-Type'], DOCX_MIME)
        disposition = reponse['Content-Disposition']
        self.assertTrue(disposition.startswith('attachment'))
        self.assertIn("filename*=utf-8''" + quote('Modèle - Convention de formation.docx'), disposition)
        self.assertTrue(reponse.content.startswith(b'PK'))  # archive Word
        self.assertEqual(lire(reponse).core_properties.title, 'Convention de formation')

    def test_ca1_nom_de_chaque_modele(self):
        for origine in ModeleOrigine.objects.all():
            reponse = self.exporter(origine.type.lower())
            self.assertEqual(reponse.status_code, 200)
            self.assertIn(quote(f'Modèle - {origine.nom}.docx'), reponse['Content-Disposition'])

    def test_sans_connexion_401_et_type_inconnu_404(self):
        self.assertEqual(self.exporter(client=Client()).status_code, 401)
        reponse = self.exporter('FACTURE')
        self.assertEqual(reponse.status_code, 404)
        self.assertEqual(reponse.json()['code'], 'MODELE_INTROUVABLE')

    def test_derniere_version_enregistree_et_seulement_celle_du_compte(self):
        # Jamais enregistré : le modèle d'origine
        origine = ModeleOrigine.objects.get(type='CONVOCATION')
        self.assertEqual(lire(self.exporter('CONVOCATION')).paragraphs[0].text, 'LOGO')
        self.assertIn('CONVOCATION', ' '.join(p.text for p in lire(self.exporter('CONVOCATION')).paragraphs))
        self.enregistrer('<p>Version enregistrée</p>')
        self.assertEqual([p.text for p in lire(self.exporter('CONVOCATION')).paragraphs], ['Version enregistrée'])
        # Un autre organisme reçoit toujours le modèle d'origine (RGT1)
        autre = Client()
        connecter(autre, email='autre@organisme.fr')
        texte_autre = ' '.join(p.text for p in lire(self.exporter('CONVOCATION', autre)).paragraphs)
        self.assertNotIn('Version enregistrée', texte_autre)
        self.assertEqual(ModeleOrigine.objects.get(type='CONVOCATION').contenu, origine.contenu)

    def test_ca2_mise_en_forme_conservee(self):
        self.enregistrer(MIS_EN_FORME)
        paragraphes = lire(self.exporter('CONVOCATION')).paragraphs
        styles = [p.style.name for p in paragraphes]
        self.assertEqual(styles, ['Heading 1', 'Heading 3', 'Normal', 'Normal', 'Normal',
                                  'List Bullet', 'List Bullet', 'List Number', 'List Number', 'Normal'])
        bonjour, justifie, droite = paragraphes[2], paragraphes[3], paragraphes[4]
        self.assertEqual(bonjour.alignment, WD_ALIGN_PARAGRAPH.CENTER)
        self.assertEqual(justifie.alignment, WD_ALIGN_PARAGRAPH.JUSTIFY)
        self.assertEqual(droite.alignment, WD_ALIGN_PARAGRAPH.RIGHT)
        morceaux = {r.text.strip(): r for r in bonjour.runs if r.text.strip()}
        self.assertTrue(morceaux['{{apprenant_prenom}}'].bold)
        self.assertTrue(morceaux['bienvenue'].italic)
        self.assertTrue(morceaux['le {{session_date_debut}}'].underline)
        self.assertTrue(morceaux['ancien tarif'].font.strike)
        self.assertEqual(morceaux['important'].font.color.rgb, RGBColor(0xDC, 0x26, 0x26))
        self.assertIsNone(morceaux['Bonjour'].bold)
        # Listes : à puces, numérotée (qui repart de 1), retour à la ligne
        self.assertEqual(paragraphes[5].text, 'Lieu : {{session_lieu}}')
        self.assertEqual(numerotation(paragraphes[5]), numerotation(paragraphes[6]))
        self.assertEqual(numerotation(paragraphes[7]), numerotation(paragraphes[8]))
        self.assertNotEqual(numerotation(paragraphes[5]), numerotation(paragraphes[7]))
        self.assertIn('<w:br/>', paragraphes[9]._p.xml)
        self.assertEqual(paragraphes[9].text, 'Ligne 1\nLigne 2')

    def test_ca2_modeles_d_origine_en_tete_titres_listes(self):
        paragraphes = lire(self.exporter('CONVENTION')).paragraphs
        self.assertEqual(paragraphes[0].text, 'LOGO')
        self.assertTrue(paragraphes[1].text.startswith('{{org_nom}}\n{{org_adresse}}'))
        self.assertEqual(paragraphes[2].style.name, 'Heading 1')
        self.assertEqual(paragraphes[2].text, 'CONVENTION DE FORMATION PROFESSIONNELLE')
        self.assertEqual(paragraphes[3].alignment, WD_ALIGN_PARAGRAPH.CENTER)
        self.assertIn('Heading 3', {p.style.name for p in paragraphes})
        self.assertIn('List Bullet', {p.style.name for p in paragraphes})

    def test_ca3_rg9_variables_ecrites_code_jamais_valeur(self):
        self.enregistrer(MIS_EN_FORME)
        document = lire(self.exporter('CONVOCATION'))
        texte = '\n'.join(p.text for p in document.paragraphs)
        for code in ('{{apprenant_prenom}}', '{{session_date_debut}}', '{{session_lieu}}'):
            self.assertIn(code, texte)
        # Chaque variable dans un seul morceau de texte (reconnue au réimport)
        self.assertIn('{{apprenant_prenom}}', [r.text for p in document.paragraphs for r in p.runs])
        self.assertNotIn('Lucas', texte)  # valeur d'exemple d'apprenant_prenom
        self.assertNotIn('Prénom', texte)  # libellé

    def test_ca4_export_puis_reimport_variables_retrouvees(self):
        self.enregistrer(MIS_EN_FORME)
        fichier = self.exporter('CONVOCATION').content
        reponse = self.client.post('/modeles/CONVOCATION/import',
                                   {'fichier': SimpleUploadedFile('Modèle - Convocation.docx', fichier)})
        self.assertEqual(reponse.status_code, 200)
        contenu = reponse.json()['contenu']
        self.assertIn('<h1>Convocation</h1><h3>Informations pratiques</h3>', contenu)
        self.assertIn('<strong>{{apprenant_prenom}}</strong>', contenu)
        self.assertIn('<u>le {{session_date_debut}}</u>', contenu)
        self.assertIn('<li>Lieu : {{session_lieu}}</li>', contenu)
        self.assertIn('<ol><li>Arriver</li><li>Signer</li></ol>', contenu)
        modele = self.client.get('/modeles/CONVOCATION').json()
        self.assertEqual(modele['statut'], 'PERSONNALISE')  # le réimport n'enregistre rien (RG8)

    def test_ca4_modele_d_origine_exporte_puis_reimporte(self):
        origine = ModeleOrigine.objects.get(type='CONVENTION')
        fichier = self.exporter('CONVENTION').content
        contenu = self.client.post('/modeles/CONVENTION/import',
                                   {'fichier': SimpleUploadedFile('modele.docx', fichier)}).json()['contenu']
        codes = lambda html: set(re.findall(r'\{\{\w+\}\}', html))
        self.assertEqual(codes(contenu), codes(origine.contenu))

    def test_pas_de_log_metier_pour_un_telechargement_reussi(self):
        with self.assertNoLogs('quali_formation.metier', level='INFO'):
            self.assertEqual(self.exporter().status_code, 200)

    def test_echec_de_generation_500_et_log_error_sans_contenu(self):
        self.enregistrer('<p>Texte confidentiel {{apprenant_nom}}</p>')
        with patch('quali_formation.services.docx_depuis_html', side_effect=RuntimeError('Texte confidentiel')), \
                self.assertLogs('quali_formation.metier', level='ERROR') as logs:
            reponse = self.exporter('CONVOCATION')
        self.assertEqual(reponse.status_code, 500)
        self.assertEqual(reponse.json()['code'], 'EXPORT_IMPOSSIBLE')
        self.assertEqual(len(logs.records), 1)
        ligne = logs.records[0]
        self.assertEqual(ligne.levelname, 'ERROR')
        self.assertEqual(ligne.getMessage(), 'Export Word en échec')
        self.assertEqual(ligne.layer, 'service')
        self.assertEqual(ligne.type_modele, 'CONVOCATION')
        self.assertEqual(getattr(ligne, 'utilisateur.organisme_id'), str(self.compte.organisme_id))
        self.assertEqual(ligne.error, 'RuntimeError')
        # Ligne écrite sur stdout : type de l'erreur seulement, ni son message ni sa trace
        ecrite = JsonFormatter().format(ligne)
        self.assertNotIn('confidentiel', ecrite)
        self.assertNotIn('Traceback', ecrite)
        self.assertNotIn('apprenant_nom', ecrite)


class DocxDepuisHtmlTests(TestCase):
    """Le générateur seul (réutilisé par les modèles de la formation, SCRUM-219)."""

    def document(self, html):
        return Document(io.BytesIO(docx_depuis_html(html, 'Essai')))

    def test_couleurs_rgb_et_courtes_et_couleur_invalide_ignoree(self):
        document = self.document('<p><span style="color: rgb(3, 105, 161)">a</span><span style="color:#f00">b</span>'
                                 '<span style="color: url(x)">c</span></p>')
        a, b, c = document.paragraphs[0].runs
        self.assertEqual(a.font.color.rgb, RGBColor(3, 105, 161))
        self.assertEqual(b.font.color.rgb, RGBColor(255, 0, 0))
        self.assertIsNone(c.font.color.rgb)

    def test_script_ignore_lien_et_image_reduits_au_texte(self):
        document = self.document('<p>Voir <a href="https://exemple.fr">le site</a><img src="x.png"></p>'
                                 '<script>alert(1)</script><style>p{}</style>')
        self.assertEqual([p.text for p in document.paragraphs], ['Voir le site'])

    def test_marge_haute_puce_hors_liste_listes_imbriquees_texte_sans_paragraphe(self):
        document = self.document('Texte libre<p style="margin-top:18px">Après</p><li>Seule</li>'
                                 '<ul><li><p>A</p><p>suite</p><ul><li>A1</li></ul></li></ul><ol><li>1</li></ol>')
        styles = [(p.style.name, p.text) for p in document.paragraphs]
        self.assertEqual(styles, [('Normal', 'Texte libre'), ('Normal', 'Après'), ('List Bullet', 'Seule'),
                                  ('List Bullet', 'A'), ('List Continue', 'suite'), ('List Bullet 2', 'A1'),
                                  ('List Number', '1')])
        self.assertEqual(document.paragraphs[1].paragraph_format.space_before.pt, 13.5)

    def test_balises_mal_fermees_et_contenu_vide(self):
        self.assertEqual([p.text for p in self.document('<p><b>gras</i> fin</p></div>').paragraphs], ['gras fin'])
        self.assertEqual(self.document('').paragraphs, [])
        self.assertEqual(self.document(None).paragraphs, [])
