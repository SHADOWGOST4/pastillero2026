from django.contrib import admin

from .models import DispositivoFabrica


@admin.register(DispositivoFabrica)
class DispositivoFabricaAdmin(admin.ModelAdmin):
    list_display = ('identificador', 'creado_en')
