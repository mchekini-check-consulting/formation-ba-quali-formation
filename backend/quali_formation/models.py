from django.db import models


class Item(models.Model):
    """Ressource générique exposée par /items, modèle à renommer par l'équipe."""

    nom = models.CharField(max_length=200)
    description = models.CharField(max_length=1000, null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "item"
        ordering = ("id",)
