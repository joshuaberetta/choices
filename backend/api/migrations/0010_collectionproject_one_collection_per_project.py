from django.db import migrations, models
import django.db.models.deletion


def remove_duplicate_memberships(apps, schema_editor):
    """Keep only the earliest (lowest id) CollectionProject row per project; delete extras."""
    CollectionProject = apps.get_model('api', 'CollectionProject')
    seen = set()
    for cp in CollectionProject.objects.order_by('id'):
        if cp.project_id in seen:
            cp.delete()
        else:
            seen.add(cp.project_id)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_phase7_collections'),
    ]

    operations = [
        # 1. Remove old unique_together constraint
        migrations.AlterUniqueTogether(
            name='collectionproject',
            unique_together=set(),
        ),
        # 2. Data migration: remove duplicates so the unique constraint below can be applied
        migrations.RunPython(remove_duplicate_memberships, migrations.RunPython.noop),
        # 3. Change project FK → OneToOneField (adds db unique constraint, changes related_name)
        migrations.AlterField(
            model_name='collectionproject',
            name='project',
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='collection_membership',
                to='api.project',
            ),
        ),
    ]
