"""SCRUM-215 « Importer son propre document Word » : POST /modeles/<type>/import (RG4, RG8, RG11)."""

import io
import json
import zipfile
from types import SimpleNamespace
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from quali_formation.models import ModeleGenerique, Organisme
from quali_formation.services import TAILLE_MAX_WORD, html_depuis_word
from quali_formation.tests import connecter

IMPORTE = ModeleGenerique.Statut.IMPORTE
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
STYLES = (f'<w:styles xmlns:w="{W}"><w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/></w:style>'
          f'<w:style w:type="paragraph" w:styleId="Titre2"><w:name w:val="heading 2"/></w:style></w:styles>')


def paragraphe(*runs, style=None):
    proprietes = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    return f'<w:p>{proprietes}{"".join(runs)}</w:p>'


def texte(contenu, *formats):
    proprietes = ''.join(f'<w:{f}/>' if f != 'u' else '<w:u w:val="single"/>' for f in formats)
    return f'<w:r><w:rPr>{proprietes}</w:rPr><w:t xml:space="preserve">{contenu}</w:t></w:r>'


def docx(*paragraphes):
    """Un vrai .docx minimal (archive Word) avec ces paragraphes, fabriqué en mémoire."""
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, 'w') as archive:
        archive.writestr('[Content_Types].xml',
                         '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                         '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                         '<Default Extension="xml" ContentType="application/xml"/>'
                         '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                         '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
                         '</Types>')
        archive.writestr('_rels/.rels',
                         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                         '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
                         '</Relationships>')
        archive.writestr('word/_rels/document.xml.rels',
                         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                         '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                         '</Relationships>')
        archive.writestr('word/styles.xml', STYLES)
        archive.writestr('word/document.xml', f'<w:document xmlns:w="{W}"><w:body>{"".join(paragraphes)}</w:body></w:document>')
    return tampon.getvalue()


CONVOCATION = docx(
    paragraphe(texte('Convocation à la formation'), style='Titre1'),
    paragraphe(texte('Informations pratiques'), style='Titre2'),
    paragraphe(texte('Bonjour '), texte('{{apprenant_nom}}', 'b'), texte(', voici votre '), texte('convocation', 'i'),
               texte(' pour la session '), texte('{{code_inconnu}}', 'u'), texte(' ; '), texte('ancien tarif', 'strike')),
)


class ImporterWordTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)

    def importer(self, contenu=CONVOCATION, nom='Convocation Camille Exemple.docx', type_modele='CONVOCATION'):
        return self.client.post(f'/modeles/{type_modele}/import', {'fichier': SimpleUploadedFile(nom, contenu)})

    def test_ca1_texte_avec_sa_mise_en_forme_principale(self):
        reponse = self.importer()
        self.assertEqual(reponse.status_code, 200)
        corps = reponse.json()
        self.assertEqual(corps['nom_fichier'], 'Convocation Camille Exemple.docx')
        self.assertEqual(corps['contenu'],
                         '<h1>Convocation à la formation</h1><h3>Informations pratiques</h3>'
                         '<p>Bonjour <strong>{{apprenant_nom}}</strong>, voici votre <em>convocation</em> pour la session '
                         '<u>{{code_inconnu}}</u> ; <s>ancien tarif</s></p>')

    def test_docx_avec_apprenant_nom_variable_reconnue(self):
        # Les {{code}} restent tels quels : l'éditeur en fait des étiquettes (inconnue : étiquette avec son code)
        contenu = self.importer().json()['contenu']
        self.assertIn('{{apprenant_nom}}', contenu)
        self.assertIn('{{code_inconnu}}', contenu)

    def test_rg8_import_ne_sauvegarde_rien(self):
        self.importer()
        self.assertFalse(ModeleGenerique.objects.exists())
        self.assertEqual(self.client.get('/modeles/CONVOCATION').json()['statut'], ModeleGenerique.Statut.ORIGINE)

    def test_ca4_rg11_pdf_ou_doc_400(self):
        for nom in ('convocation.pdf', 'convocation.doc', 'convocation', 'convocation.docx.exe'):
            reponse = self.importer(nom=nom)
            self.assertEqual(reponse.status_code, 400, nom)
            self.assertEqual(reponse.json(), {'code': 'FORMAT_INVALIDE', 'detail': 'Seuls les fichiers Word (.docx) sont acceptés.'})

    def test_extension_en_majuscules_acceptee(self):
        self.assertEqual(self.importer(nom='CONVOCATION.DOCX').status_code, 200)

    def test_sans_fichier_400(self):
        reponse = self.client.post('/modeles/CONVOCATION/import', {})
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'FORMAT_INVALIDE'))

    def test_rg11_plus_de_10_mo_400(self):
        reponse = self.importer(contenu=CONVOCATION + b'0' * (TAILLE_MAX_WORD + 1 - len(CONVOCATION)))
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json()['code'], 'FICHIER_TROP_VOLUMINEUX')
        self.assertEqual(self.importer(contenu=CONVOCATION + b'0' * 1000).status_code, 200)

    def test_docx_illisible_400(self):
        for contenu in (b'pas un document Word', zipfile.ZipFile.__name__.encode()):
            reponse = self.importer(contenu=contenu)
            self.assertEqual(reponse.status_code, 400)
            self.assertEqual(reponse.json()['code'], 'FICHIER_ILLISIBLE')

    def test_type_inconnu_404_et_sans_connexion_401(self):
        self.assertEqual(self.importer(type_modele='DEVIS').status_code, 404)
        self.client.logout()
        self.assertEqual(self.importer().status_code, 401)


class NettoyageTests(TestCase):
    def test_securite_ni_script_ni_lien_ni_image_ni_attribut(self):
        dangereux = ('<p onclick="alert(1)" style="color:red">Texte <a href="javascript:alert(1)">lien</a></p>'
                     '<script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://exemple.fr"></iframe>'
                     '<table><tr><td><p>Case 1</p></td><td><p>Case 2</p></td></tr></table><h2>Sous-titre</h2>')
        with patch('quali_formation.services.mammoth.convert_to_html', return_value=SimpleNamespace(value=dangereux)):
            html = html_depuis_word(io.BytesIO(b''))
        # Tableaux : chaque case garde son paragraphe ; balise inconnue (h2) : son texte seulement
        self.assertEqual(html, '<p>Texte lien</p><p>Case 1</p><p>Case 2</p>Sous-titre')

    def test_texte_qui_ressemble_a_du_code_reste_du_texte(self):
        html = html_depuis_word(io.BytesIO(docx(paragraphe(texte('&lt;script&gt;alert(1)&lt;/script&gt;')))))
        self.assertNotIn('<script', html)
        self.assertEqual(html, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')


class EnregistrerMonDocumentTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)

    def put(self, corps):
        return self.client.put('/modeles/CONVOCATION', data=json.dumps(corps), content_type='application/json')

    def test_ca5_rg4_importe_puis_enregistre_statut_mon_document(self):
        contenu = self.client.post('/modeles/CONVOCATION/import',
                                   {'fichier': SimpleUploadedFile('ma-convocation.docx', CONVOCATION)}).json()['contenu']
        reponse = self.put({'contenu': contenu, 'nom_fichier_importe': 'ma-convocation.docx'})
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual((reponse.json()['statut'], reponse.json()['nom_fichier_importe']), (IMPORTE, 'ma-convocation.docx'))
        statuts = {m['type']: m['statut'] for m in self.client.get('/modeles/').json()['modeles']}
        self.assertEqual(statuts['CONVOCATION'], IMPORTE)
        self.assertEqual(self.client.get('/modeles/CONVOCATION').json()['nom_fichier_importe'], 'ma-convocation.docx')

    def test_mon_document_retouche_sans_nouvel_import_reste_mon_document(self):
        self.put({'contenu': '<p>Import</p>', 'nom_fichier_importe': 'ma-convocation.docx'})
        reponse = self.put({'contenu': '<p>Import retouché</p>'})
        modele = ModeleGenerique.objects.get(proprietaire=self.compte, type='CONVOCATION')
        self.assertEqual((modele.statut, modele.nom_fichier_importe, modele.contenu),
                         (IMPORTE, 'ma-convocation.docx', '<p>Import retouché</p>'))
        self.assertEqual(reponse.json()['statut'], IMPORTE)

    def test_modele_retouche_sans_import_reste_personnalise(self):
        self.put({'contenu': '<p>Retouche</p>'})
        modele = ModeleGenerique.objects.get(proprietaire=self.compte, type='CONVOCATION')
        self.assertEqual((modele.statut, modele.nom_fichier_importe), (ModeleGenerique.Statut.PERSONNALISE, None))

    def test_nom_de_fichier_illisible_400(self):
        reponse = self.put({'contenu': '<p>x</p>', 'nom_fichier_importe': 12})
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'CONTENU_INVALIDE'))


class LogsImportTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client, 'marie.dupont@organisme.fr')
        self.compte.organisme = Organisme.objects.create(**{
            f.name: '12345678900012' if f.name == 'siret' else 'x'
            for f in Organisme._meta.concrete_fields if f.name != 'id' and not f.null and not f.has_default()})
        self.compte.save()

    def importer(self, nom, contenu=CONVOCATION):
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.client.post('/modeles/CONVOCATION/import', {'fichier': SimpleUploadedFile(nom, contenu)})
        (ligne,) = logs.records  # le service seulement
        return ligne

    def verifier_sans_donnee_personnelle(self, ligne, nom):
        texte = json.dumps(ligne.__dict__, default=str)
        for interdit in (nom, 'Camille', 'marie.dupont', 'apprenant_nom', 'Bonjour'):
            self.assertNotIn(interdit, texte)

    def test_import_word_reussi_info(self):
        ligne = self.importer('Convocation Camille Exemple.docx')
        self.assertEqual((ligne.levelname, ligne.layer, ligne.method), ('INFO', 'service', 'importer_word'))
        self.assertEqual((getattr(ligne, 'utilisateur.organisme_id'), ligne.type_modele, ligne.extension, ligne.taille),
                         (str(self.compte.organisme_id), 'CONVOCATION', '.docx', str(len(CONVOCATION))))
        self.verifier_sans_donnee_personnelle(ligne, 'Convocation Camille Exemple.docx')

    def test_import_word_refuse_warning_avec_motif(self):
        for nom, contenu, motif in (('Camille Exemple.pdf', CONVOCATION, 'FORMAT_INVALIDE'),
                                    ('Camille Exemple.docx', b'illisible', 'FICHIER_ILLISIBLE'),
                                    ('Camille Exemple.docx', b'0' * (TAILLE_MAX_WORD + 1), 'FICHIER_TROP_VOLUMINEUX')):
            ligne = self.importer(nom, contenu)
            self.assertEqual((ligne.levelname, ligne.errorCode), ('WARNING', motif), motif)
            self.verifier_sans_donnee_personnelle(ligne, nom)
