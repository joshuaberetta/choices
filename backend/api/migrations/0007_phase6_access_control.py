from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0006_project_slug_unique_per_owner'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='is_public',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='choicelist',
            name='require_auth',
            field=models.BooleanField(
                default=True,
                help_text='If False, /add and /remove are openly writable without credentials',
            ),
        ),
        migrations.CreateModel(
            name='ProjectShare',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('project', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='shares',
                    to='api.project',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='shared_projects',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'unique_together': {('project', 'user')},
            },
        ),
    ]
