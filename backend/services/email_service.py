"""
Email Service - SMTP Email Gönderimi
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
import logging
from typing import List, Optional, Dict, Any
import asyncio
from functools import partial

logger = logging.getLogger(__name__)

# SMTP Configuration
SMTP_CONFIG = {
    "host": os.getenv("SMTP_HOST", "smtp.hostinger.com"),
    "port": int(os.getenv("SMTP_PORT", 465)),
    "username": os.getenv("SMTP_USERNAME", "auth@healmedy.tech"),
    "password": os.getenv("SMTP_PASSWORD", "Mhacare1."),
    "from_email": os.getenv("SMTP_FROM_EMAIL", "auth@healmedy.tech"),
    "from_name": os.getenv("SMTP_FROM_NAME", "HealMedy HBYS"),
    "use_ssl": True
}


class EmailService:
    def __init__(self):
        self.config = SMTP_CONFIG
    
    def _get_connection(self):
        """Create SMTP connection"""
        if self.config["use_ssl"]:
            server = smtplib.SMTP_SSL(self.config["host"], self.config["port"])
        else:
            server = smtplib.SMTP(self.config["host"], self.config["port"])
            server.starttls()
        
        server.login(self.config["username"], self.config["password"])
        return server
    
    def _create_message(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None
    ) -> MIMEMultipart:
        """Create email message"""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self.config['from_name']} <{self.config['from_email']}>"
        msg["To"] = to_email
        
        # Plain text version
        if body_text:
            part1 = MIMEText(body_text, "plain", "utf-8")
            msg.attach(part1)
        
        # HTML version
        part2 = MIMEText(body_html, "html", "utf-8")
        msg.attach(part2)
        
        return msg
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None
    ) -> bool:
        """Send email synchronously"""
        try:
            msg = self._create_message(to_email, subject, body_html, body_text)
            
            with self._get_connection() as server:
                server.sendmail(
                    self.config["from_email"],
                    to_email,
                    msg.as_string()
                )
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
    
    async def send_email_async(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None
    ) -> bool:
        """Send email asynchronously"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            partial(self.send_email, to_email, subject, body_html, body_text)
        )
    
    async def send_bulk_emails(
        self,
        recipients: List[Dict[str, str]],
        subject: str,
        body_template: str,
        personalize: bool = False
    ) -> Dict[str, bool]:
        """Send emails to multiple recipients"""
        results = {}
        for recipient in recipients:
            email = recipient.get("email")
            if not email:
                continue
            
            body = body_template
            if personalize:
                # Replace placeholders like {{name}}
                for key, value in recipient.items():
                    body = body.replace(f"{{{{{key}}}}}", str(value))
            
            result = await self.send_email_async(email, subject, body)
            results[email] = result
        
        return results


# Singleton instance
email_service = EmailService()


# ============================================================================
# TEMPLATE FUNCTIONS
# ============================================================================

def get_approval_code_email_template(
    user_name: str,
    code: str,
    context: str,
    expires_in: str = "5 dakika"
) -> str:
    """Onay kodu email şablonu"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #dc2626, #991b1b); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
            .code-box {{ background: #fff; border: 2px dashed #dc2626; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px; }}
            .code {{ font-size: 32px; font-weight: bold; color: #dc2626; letter-spacing: 5px; }}
            .footer {{ background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 10px 10px; }}
            .warning {{ background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏥 HealMedy HBYS</h1>
                <p>Onay Kodu</p>
            </div>
            <div class="content">
                <p>Merhaba <strong>{user_name}</strong>,</p>
                <p>Aşağıdaki onay kodu <strong>{context}</strong> için gereklidir:</p>
                
                <div class="code-box">
                    <p class="code">{code}</p>
                </div>
                
                <p>Bu kod <strong>{expires_in}</strong> içinde geçerliliğini yitirecektir.</p>
                
                <div class="warning">
                    ⚠️ <strong>Güvenlik Uyarısı:</strong> Bu kodu kimseyle paylaşmayın. HealMedy yetkilileri asla şifrenizi veya onay kodunuzu sormaz.
                </div>
            </div>
            <div class="footer">
                <p>Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
                <p>© 2024 HealMedy HBYS - Tüm hakları saklıdır.</p>
            </div>
        </div>
    </body>
    </html>
    """


def get_shift_handover_email_template(
    receiver_name: str,
    giver_name: str,
    vehicle_plate: str,
    code: str,
    shift_date: str,
    shift_time: str
) -> str:
    """Vardiya devir teslim email şablonu"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
            .info-box {{ background: #fff; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 10px; }}
            .info-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }}
            .info-row:last-child {{ border-bottom: none; }}
            .code-box {{ background: #dbeafe; border: 2px solid #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px; }}
            .code {{ font-size: 32px; font-weight: bold; color: #1d4ed8; letter-spacing: 5px; }}
            .footer {{ background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 10px 10px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚑 Vardiya Devir Teslim</h1>
                <p>HealMedy HBYS</p>
            </div>
            <div class="content">
                <p>Merhaba <strong>{receiver_name}</strong>,</p>
                <p><strong>{giver_name}</strong> size aşağıdaki araç için vardiya devri yapmak istiyor:</p>
                
                <div class="info-box">
                    <div class="info-row">
                        <span>🚗 Araç Plakası:</span>
                        <strong>{vehicle_plate}</strong>
                    </div>
                    <div class="info-row">
                        <span>📅 Tarih:</span>
                        <strong>{shift_date}</strong>
                    </div>
                    <div class="info-row">
                        <span>⏰ Saat:</span>
                        <strong>{shift_time}</strong>
                    </div>
                    <div class="info-row">
                        <span>👤 Teslim Eden:</span>
                        <strong>{giver_name}</strong>
                    </div>
                </div>
                
                <p>Devir teslimi onaylamak için aşağıdaki kodu kullanın:</p>
                
                <div class="code-box">
                    <p class="code">{code}</p>
                </div>
                
                <p>Bu kodu <strong>{giver_name}</strong>'a vererek devir teslimi onaylayabilirsiniz.</p>
            </div>
            <div class="footer">
                <p>Bu email otomatik olarak gönderilmiştir.</p>
                <p>© 2024 HealMedy HBYS</p>
            </div>
        </div>
    </body>
    </html>
    """


def get_manager_approval_email_template(
    manager_name: str,
    requester_name: str,
    action: str,
    vehicle_plate: str,
    code: str,
    details: str = ""
) -> str:
    """Yönetici onay email şablonu"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #7c3aed, #5b21b6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
            .alert-box {{ background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; }}
            .code-box {{ background: #ede9fe; border: 2px solid #7c3aed; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px; }}
            .code {{ font-size: 32px; font-weight: bold; color: #5b21b6; letter-spacing: 5px; }}
            .footer {{ background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 10px 10px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚠️ Onay Bekliyor</h1>
                <p>HealMedy HBYS</p>
            </div>
            <div class="content">
                <p>Merhaba <strong>{manager_name}</strong>,</p>
                
                <div class="alert-box">
                    <strong>{requester_name}</strong>, <strong>{action}</strong> için onayınızı bekliyor.
                </div>
                
                <p><strong>Detaylar:</strong></p>
                <ul>
                    <li>Araç: {vehicle_plate}</li>
                    <li>Talep Eden: {requester_name}</li>
                    <li>İşlem: {action}</li>
                    {f"<li>{details}</li>" if details else ""}
                </ul>
                
                <p>Onaylamak için aşağıdaki kodu paylaşın:</p>
                
                <div class="code-box">
                    <p class="code">{code}</p>
                </div>
            </div>
            <div class="footer">
                <p>Bu email otomatik olarak gönderilmiştir.</p>
                <p>© 2024 HealMedy HBYS</p>
            </div>
        </div>
    </body>
    </html>
    """

