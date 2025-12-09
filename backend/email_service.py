import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "HealMedy HBYS")

async def send_email(to_email: str, subject: str, html_content: str):
    """Send email via SMTP"""
    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        
        html_part = MIMEText(html_content, "html", "utf-8")
        message.attach(html_part)
        
        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
            use_tls=True
        )
        
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False

def create_case_notification_email(case_data: dict, recipient_role: str) -> str:
    """Create HTML email for case notification"""
    
    priority_colors = {
        "yuksek": "#dc2626",
        "orta": "#f59e0b",
        "dusuk": "#16a34a"
    }
    
    priority_labels = {
        "yuksek": "Yüksek",
        "orta": "Orta",
        "dusuk": "Düşük"
    }
    
    priority_color = priority_colors.get(case_data.get("priority", "orta"))
    priority_label = priority_labels.get(case_data.get("priority", "orta"))
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
            .priority-badge {{ display: inline-block; padding: 4px 12px; border-radius: 4px; background: {priority_color}; color: white; font-weight: bold; }}
            .info-section {{ background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #2563eb; }}
            .info-label {{ font-weight: bold; color: #6b7280; }}
            .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>🚑 Yeni Vaka Bildirimi</h2>
                <p>Vaka No: {case_data.get('case_number', 'N/A')}</p>
            </div>
            
            <div class="content">
                <div style="margin-bottom: 15px;">
                    <span class="priority-badge">Öncelik: {priority_label}</span>
                </div>
                
                <div class="info-section">
                    <h3>👤 Hasta Bilgileri</h3>
                    <p><span class="info-label">Ad Soyad:</span> {case_data.get('patient', {}).get('name', '')} {case_data.get('patient', {}).get('surname', '')}</p>
                    <p><span class="info-label">Yaş:</span> {case_data.get('patient', {}).get('age', '')}</p>
                    <p><span class="info-label">Cinsiyet:</span> {case_data.get('patient', {}).get('gender', '').title()}</p>
                    <p><span class="info-label">Şikayet:</span> {case_data.get('patient', {}).get('complaint', '')}</p>
                </div>
                
                <div class="info-section">
                    <h3>📞 Arayan Bilgileri</h3>
                    <p><span class="info-label">Ad Soyad:</span> {case_data.get('caller', {}).get('name', '')}</p>
                    <p><span class="info-label">Telefon:</span> {case_data.get('caller', {}).get('phone', '')}</p>
                    <p><span class="info-label">Yakınlık:</span> {case_data.get('caller', {}).get('relationship', '')}</p>
                </div>
                
                <div class="info-section">
                    <h3>📍 Konum Bilgileri</h3>
                    <p><span class="info-label">Adres:</span> {case_data.get('location', {}).get('address', '')}</p>
                    {f'<p><span class="info-label">İlçe:</span> {case_data.get("location", {}).get("district", "")}</p>' if case_data.get('location', {}).get('district') else ''}
                    {f'<p><span class="info-label">Köy/Mahalle:</span> {case_data.get("location", {}).get("village_or_neighborhood", "")}</p>' if case_data.get('location', {}).get('village_or_neighborhood') else ''}
                </div>
                
                {f'''
                <div class="info-section">
                    <h3>🚗 Atanan Araç</h3>
                    <p><span class="info-label">Araç:</span> {case_data.get('vehicle_plate', 'Atanmadı')}</p>
                </div>
                ''' if case_data.get('vehicle_plate') else ''}
                
                <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 6px;">
                    <p style="margin: 0;"><strong>⚠️ Lütfen derhal gerekli aksiyonu alınız.</strong></p>
                </div>
            </div>
            
            <div class="footer">
                <p>HealMedy HBYS - Saha Sağlık Yönetim Sistemi</p>
                <p>Bu otomatik bir bildirimdir.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html

async def send_case_notifications(case_data: dict, users_collection, vehicle_id: str = None):
    """Send notifications to relevant users"""
    
    # Roles to notify
    notification_roles = ["merkez_ofis", "operasyon_muduru", "doktor", "hemsire"]
    
    # Get all users with these roles
    recipients = await users_collection.find({
        "role": {"$in": notification_roles},
        "email": {"$exists": True}
    }).to_list(100)
    
    # If vehicle is assigned, add team members
    if vehicle_id and case_data.get('assigned_team'):
        team_ids = []
        team = case_data['assigned_team']
        if team.get('driver_id'): team_ids.append(team['driver_id'])
        if team.get('paramedic_id'): team_ids.append(team['paramedic_id'])
        if team.get('att_id'): team_ids.append(team['att_id'])
        if team.get('nurse_id'): team_ids.append(team['nurse_id'])
        
        if team_ids:
            team_members = await users_collection.find({
                "_id": {"$in": team_ids},
                "email": {"$exists": True}
            }).to_list(10)
            recipients.extend(team_members)
    
    # Send emails
    subject = f"🚑 Yeni Vaka: {case_data.get('case_number')} - {case_data.get('priority', 'orta').upper()} ÖNCELİK"
    
    sent_count = 0
    for user in recipients:
        email = user.get('email')
        if email:
            role = user.get('role', 'kullanıcı')
            html_content = create_case_notification_email(case_data, role)
            success = await send_email(email, subject, html_content)
            if success:
                sent_count += 1
    
    logger.info(f"Sent {sent_count} notifications for case {case_data.get('case_number')}")
    return sent_count
