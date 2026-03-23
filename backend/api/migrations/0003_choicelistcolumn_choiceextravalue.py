from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_project_owner'),
    ]

    operations = [
        migrations.CreateModel(
            name='ChoiceListColumn',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('order', models.PositiveIntegerField(default=0)),
                ('choice_list', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='columns', to='api.choicelist')),
            ],
            options={
                'ordering': ['order', 'id'],
                'unique_together': {('choice_list', 'name')},
            },
        ),
        migrations.CreateModel(
            name='ChoiceExtraValue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.TextField(blank=True, default='')),
                ('choice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='extra_values', to='api.choice')),
                ('column', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='values', to='api.choicelistcolumn')),
            ],
            options={
                'unique_together': {('choice', 'column')},
            },
        ),
    ]
