"""Cuando cambia un horario o un medicamento, el teléfono del dueño recibe sus alarmas actualizadas."""
from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Horario, Medicamento
from .notifications import sincronizar_alarmas_del_usuario


def _avisar(usuario_id):
    transaction.on_commit(lambda: sincronizar_alarmas_del_usuario(usuario_id))


@receiver([post_save, post_delete], sender=Horario)
def horario_cambio(sender, instance, **kwargs):
    _avisar(instance.id_medicamento.id_usuario_id)


@receiver(pre_save, sender=Medicamento)
def medicamento_antes(sender, instance, **kwargs):
    instance._nombre_anterior = (
        Medicamento.objects.filter(pk=instance.pk).values_list('nombre', flat=True).first() if instance.pk else None
    )


@receiver(post_save, sender=Medicamento)
def medicamento_cambio(sender, instance, created, **kwargs):
    # Solo el nombre aparece en la alarma: descontar stock en cada toma no debe mandar nada al teléfono.
    anterior = getattr(instance, '_nombre_anterior', None)
    if not created and anterior is not None and anterior != instance.nombre:
        _avisar(instance.id_usuario_id)
