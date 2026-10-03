"""Create (or reset) the public demo account with realistic sample data.

Safe to run repeatedly: the demo user's existing pipeline is wiped and rebuilt, and
nobody else's data is touched. Credentials come from DEMO_EMAIL / DEMO_PASSWORD.
"""

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from pipeline import services
from pipeline.models import Company, JobApplication

User = get_user_model()

# name -> (website, notes). All companies are fictional.
COMPANIES = {
    "Northwind Labs": (
        "https://northwind-labs.example.com",
        "Series B dev-tools startup. Remote-first.",
    ),
    "Lumen Health": (
        "https://lumenhealth.example.com",
        "Health-tech. Referred by a former colleague.",
    ),
    "Brightside Retail": (
        "https://brightside-retail.example.com",
        "Large e-commerce platform team.",
    ),
    "Quillpad": ("https://quillpad.example.com", "Small team, Django + React stack."),
    "Harborline Logistics": (
        "https://harborline.example.com",
        "Hybrid, 2 days a week in the office.",
    ),
    "Pixelforge Studios": (
        "https://pixelforge.example.com",
        "Game tooling. Great engineering blog.",
    ),
    "Meridian Bank": (
        "https://meridianbank.example.com",
        "Graduate programme. Slow, formal process.",
    ),
    "Tandem Cloud": (
        "https://tandemcloud.example.com",
        "Platform engineering. Salary range shared up front.",
    ),
    "Orchard Analytics": (
        "https://orchard-analytics.example.com",
        "Data products for agriculture.",
    ),
    "Fernway Education": ("https://fernway.example.com", "Ed-tech non-profit. Mission-driven."),
}

# (company, job title, stage, days since applying or None, description)
APPLICATIONS = [
    (
        "Quillpad",
        "Junior Backend Developer",
        "Wishlist",
        None,
        "Build and maintain Django REST APIs. Work closely with the frontend team.",
    ),
    (
        "Orchard Analytics",
        "Junior Software Engineer",
        "Wishlist",
        None,
        "Python services and data pipelines. Mentorship from senior engineers.",
    ),
    (
        "Fernway Education",
        "Full Stack Developer (Graduate)",
        "Wishlist",
        None,
        "React + Django. Small team with a lot of ownership.",
    ),
    (
        "Pixelforge Studios",
        "Tools Engineer, Junior",
        "Wishlist",
        None,
        "Create internal tools used by game designers. Python and TypeScript.",
    ),
    (
        "Lumen Health",
        "Software Engineer I",
        "Applied",
        3,
        "Develop patient-facing features in a regulated environment. Python, PostgreSQL.",
    ),
    (
        "Brightside Retail",
        "Junior Full Stack Engineer",
        "Applied",
        6,
        "Work across checkout and catalogue services. TypeScript, Django.",
    ),
    (
        "Harborline Logistics",
        "Junior Python Developer",
        "Applied",
        9,
        "Route optimisation services and internal dashboards.",
    ),
    (
        "Meridian Bank",
        "Graduate Software Engineer",
        "Applied",
        14,
        "Two-year rotational graduate programme across platform and product teams.",
    ),
    (
        "Northwind Labs",
        "Junior Backend Engineer",
        "Interviewing",
        12,
        "Own small features end to end on the API team. Take-home exercise completed.",
    ),
    (
        "Tandem Cloud",
        "Associate Platform Engineer",
        "Interviewing",
        21,
        "Support internal developer tooling. Technical interview scheduled.",
    ),
    (
        "Lumen Health",
        "Junior Frontend Engineer",
        "Interviewing",
        18,
        "React + TypeScript component library and patient dashboards.",
    ),
    (
        "Orchard Analytics",
        "Software Engineer (Entry Level)",
        "Offer",
        34,
        "Verbal offer received; written offer pending. Remote within the country.",
    ),
    (
        "Brightside Retail",
        "Junior Backend Engineer",
        "Rejected",
        40,
        "Rejected after the technical screen. Asked for feedback.",
    ),
    (
        "Harborline Logistics",
        "Junior Full Stack Developer",
        "Rejected",
        28,
        "Position filled internally.",
    ),
    (
        "Meridian Bank",
        "Junior QA Automation Engineer",
        "Rejected",
        45,
        "No response after the first round.",
    ),
    (
        "Pixelforge Studios",
        "Junior Gameplay Tools Developer",
        "Rejected",
        25,
        "Moved forward with candidates with more C++ experience.",
    ),
    (
        "Fernway Education",
        "Junior Web Developer",
        "Applied",
        2,
        "Part of the new learning-platform squad.",
    ),
    (
        "Northwind Labs",
        "Developer Advocate (Junior)",
        "Rejected",
        31,
        "Role requires more public speaking experience.",
    ),
]


class Command(BaseCommand):
    help = "Create or reset the demo account (DEMO_EMAIL / DEMO_PASSWORD) with sample data."

    @transaction.atomic
    def handle(self, *args, **options):
        email = settings.DEMO_EMAIL
        user, created = User.objects.get_or_create(email=email)
        user.set_password(settings.DEMO_PASSWORD)
        user.save()

        # Wipe the demo user's pipeline (applications first: stages/companies are PROTECTed),
        # then rebuild it from scratch so repeated runs give identical data.
        JobApplication.objects.filter(user=user).delete()
        Company.objects.filter(user=user).delete()
        user.stages.all().delete()
        services.create_default_stages(user)

        stages = {stage.name: stage for stage in user.stages.all()}
        companies = {
            name: Company.objects.create(user=user, name=name, website=website, notes=notes)
            for name, (website, notes) in COMPANIES.items()
        }

        today = timezone.localdate()
        for company_name, title, stage_name, days_ago, description in APPLICATIONS:
            services.create_application(
                user,
                stages[stage_name],
                company=companies[company_name],
                job_title=title,
                job_description=description,
                listing_url=f"{COMPANIES[company_name][0]}/careers/{slugify(title)}",
                date_applied=None if days_ago is None else today - timedelta(days=days_ago),
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Created' if created else 'Reset'} demo account {email}: "
                f"{len(companies)} companies, {len(APPLICATIONS)} applications."
            )
        )
