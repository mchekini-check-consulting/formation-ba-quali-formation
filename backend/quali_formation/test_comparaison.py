"""SCRUM-219 (RG18 bis) : comparaison du texte « nettoyé » de deux modèles (comparaison.py)."""

import json
from pathlib import Path

from django.test import SimpleTestCase, TestCase

from quali_formation.comparaison import meme_document
from quali_formation.models import ModeleOrigine

# Les 4 modèles d'origine tels que l'éditeur (TipTap) les renvoie après une modification annulée
REECRITS = json.loads((Path(__file__).parent / 'donnees_tests' / 'modeles-origine-reecrits-par-l-editeur.json')
                      .read_text(encoding='utf-8'))


class MemeDocumentTests(SimpleTestCase):
    def test_meme_texte(self):
        self.assertTrue(meme_document('<p>Bonjour {{apprenant_nom}}</p>', '<p>Bonjour {{apprenant_nom}}</p>'))

    def test_ecriture_des_styles_et_des_classes(self):
        self.assertTrue(meme_document('<p style="text-align:center;color:#DC2626">x</p>',
                                      '<p style="color: #dc2626; text-align: center;">x</p>'))
        self.assertTrue(meme_document('<div class="eh  logo">x</div>', '<div class="logo eh">x</div>'))

    def test_attributs_vides_et_balises_sans_contenu(self):
        self.assertTrue(meme_document('<p>x</p>', '<p style="" class="">x</p><p></p><p>  </p><strong></strong>'))

    def test_espaces_en_trop(self):
        self.assertTrue(meme_document('<p>Bonjour   {{apprenant_nom}}\n</p>', '<p>Bonjour {{apprenant_nom}}</p>'))

    def test_balises_equivalentes_et_paragraphe_dans_une_puce(self):
        self.assertTrue(meme_document('<p><b>Gras</b> <i>it</i></p><ul><li>Lieu</li></ul>',
                                      '<p><strong>Gras</strong> <em>it</em></p><ul><li><p>Lieu</p></li></ul>'))

    def test_vraies_differences(self):
        base = '<h1>Convocation</h1><p style="text-align:center"><b>{{formation_intitule}}</b></p>'
        for autre in ('<h1>Convocation modifiée</h1><p style="text-align:center"><b>{{formation_intitule}}</b></p>',
                      '<h1>Convocation</h1><p style="text-align:right"><b>{{formation_intitule}}</b></p>',
                      '<h1>Convocation</h1><p style="text-align:center"><em>{{formation_intitule}}</em></p>',
                      '<h1>Convocation</h1><p style="text-align:center"><b>{{formation_lieu}}</b></p>',
                      '<h3>Convocation</h3><p style="text-align:center"><b>{{formation_intitule}}</b></p>',
                      '<h1>Convocation</h1><p style="text-align:center"><b>{{formation_intitule}}</b><br></p>'):
            self.assertFalse(meme_document(base, autre), autre)

    def test_contenu_vide(self):
        self.assertTrue(meme_document('', None))
        self.assertFalse(meme_document('', '<p>x</p>'))


class ModelesReecritsParLEditeurTests(TestCase):
    def test_les_4_modeles_d_origine_reecrits_par_l_editeur_restent_le_meme_document(self):
        for origine in ModeleOrigine.objects.all():
            with self.subTest(origine.type):
                self.assertNotEqual(REECRITS[origine.type], origine.contenu)  # l'éditeur a bien réécrit le HTML
                self.assertTrue(meme_document(origine.contenu, REECRITS[origine.type]))
                self.assertFalse(meme_document(origine.contenu, REECRITS[origine.type].replace('</h1>', ' modifié</h1>', 1)))
