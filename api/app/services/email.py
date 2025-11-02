"""
Service d'envoi d'emails
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


def send_email(to_email: str, subject: str, html_body: str, text_body: str = "") -> None:
    """
    Envoie un email via SMTP Gmail
    """
    try:
        # Créer le message
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
        msg['To'] = to_email
        msg['Subject'] = subject

        # Ajouter les versions texte et HTML
        if text_body:
            part1 = MIMEText(text_body, 'plain', 'utf-8')
            msg.attach(part1)

        part2 = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(part2)

        # Connexion au serveur SMTP
        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.starttls()
            server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
            server.send_message(msg)

        print(f"Email envoyé avec succès à {to_email}")

    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email à {to_email}: {str(e)}")
        raise


def send_verification_email(to_email: str, verification_token: str, user_name: str) -> None:
    """
    Envoie un email de vérification d'adresse email
    """
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"

    subject = "Vérifiez votre adresse email - Santé Rurale"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
            .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }}
            .button {{ display: inline-block; padding: 12px 30px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .footer {{ margin-top: 20px; text-align: center; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏥 Santé Rurale</h1>
            </div>
            <div class="content">
                <h2>Bonjour {user_name},</h2>
                <p>Merci de vous être inscrit sur Santé Rurale !</p>
                <p>Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous :</p>
                <p style="text-align: center;">
                    <a href="{verification_url}" class="button">Vérifier mon email</a>
                </p>
                <p>Ou copiez-collez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; font-size: 12px; background: #fff; padding: 10px; border-radius: 3px;">
                    {verification_url}
                </p>
                <p><strong>Ce lien est valide pendant 24 heures.</strong></p>
                <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                <p>&copy; 2025 Santé Rurale - Système de gestion des soins de santé</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_body = f"""
    Santé Rurale - Vérification d'email

    Bonjour {user_name},

    Merci de vous être inscrit sur Santé Rurale !

    Pour activer votre compte, veuillez cliquer sur ce lien :
    {verification_url}

    Ce lien est valide pendant 24 heures.

    Si vous n'avez pas créé de compte, ignorez cet email.

    ---
    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
    © 2025 Santé Rurale
    """

    send_email(to_email, subject, html_body, text_body)


def send_password_reset_email(to_email: str, reset_token: str, user_name: str) -> None:
    """
    Envoie un email de réinitialisation de mot de passe
    """
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    subject = "Réinitialisation de mot de passe - Santé Rurale"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
            .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }}
            .button {{ display: inline-block; padding: 12px 30px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .footer {{ margin-top: 20px; text-align: center; font-size: 12px; color: #666; }}
            .warning {{ background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔒 Santé Rurale</h1>
            </div>
            <div class="content">
                <h2>Bonjour {user_name},</h2>
                <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
                <p>Pour créer un nouveau mot de passe, cliquez sur le bouton ci-dessous :</p>
                <p style="text-align: center;">
                    <a href="{reset_url}" class="button">Réinitialiser mon mot de passe</a>
                </p>
                <p>Ou copiez-collez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; font-size: 12px; background: #fff; padding: 10px; border-radius: 3px;">
                    {reset_url}
                </p>
                <div class="warning">
                    <strong>⚠️ Important :</strong> Ce lien est valide pendant 1 heure seulement.
                </div>
                <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe actuel reste inchangé.</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                <p>&copy; 2025 Santé Rurale - Système de gestion des soins de santé</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_body = f"""
    Santé Rurale - Réinitialisation de mot de passe

    Bonjour {user_name},

    Vous avez demandé la réinitialisation de votre mot de passe.

    Pour créer un nouveau mot de passe, cliquez sur ce lien :
    {reset_url}

    ⚠️ Ce lien est valide pendant 1 heure seulement.

    Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.

    ---
    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
    © 2025 Santé Rurale
    """

    send_email(to_email, subject, html_body, text_body)
