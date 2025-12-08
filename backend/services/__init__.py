from .notification_service import (
    notification_service,
    NotificationType,
    NotificationChannel,
    send_case_notification,
    send_shift_reminder,
    send_stock_alert,
    send_master_code
)

from .email_service import (
    email_service,
    get_approval_code_email_template,
    get_shift_handover_email_template,
    get_manager_approval_email_template
)

from .sms_service import (
    sms_service,
    get_approval_code_sms,
    get_shift_handover_sms,
    get_manager_approval_sms
)

from .approval_service import (
    approval_service,
    create_shift_handover_approval,
    create_manager_shift_approval
)

__all__ = [
    # Notification Service
    "notification_service",
    "NotificationType",
    "NotificationChannel",
    "send_case_notification",
    "send_shift_reminder",
    "send_stock_alert",
    "send_master_code",
    
    # Email Service
    "email_service",
    "get_approval_code_email_template",
    "get_shift_handover_email_template",
    "get_manager_approval_email_template",
    
    # SMS Service
    "sms_service",
    "get_approval_code_sms",
    "get_shift_handover_sms",
    "get_manager_approval_sms",
    
    # Approval Service
    "approval_service",
    "create_shift_handover_approval",
    "create_manager_shift_approval"
]
