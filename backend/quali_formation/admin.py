from django.contrib import admin

from quali_formation.models import Formation, Sequence, Session


class SequenceInline(admin.TabularInline):
    model = Sequence
    extra = 0


class SessionInline(admin.TabularInline):
    model = Session
    extra = 0


@admin.register(Formation)
class FormationAdmin(admin.ModelAdmin):
    list_display = ('reference', 'intitule', 'statut', 'publication', 'version', 'date_mise_a_jour')
    list_filter = ('statut', 'publication', 'modalite')
    search_fields = ('reference', 'intitule')
    inlines = (SequenceInline, SessionInline)
