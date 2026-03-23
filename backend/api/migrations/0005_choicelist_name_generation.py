from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_choicelist_label_column_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='choicelist',
            name='name_generation',
            field=models.CharField(
                choices=[('uuid', 'Random UUID'), ('from_label', 'Derived from label')],
                default='uuid',
                help_text='How to auto-generate the choice name/value when adding a new choice',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='choicelist',
            name='name_max_length',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Maximum length for label-derived names (0 = no limit)',
            ),
        ),
    ]
