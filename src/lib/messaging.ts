export type MessageChannel = 'sms' | 'whatsapp';

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);

export const sanitizePhoneNumber = (phone: string) => {
  const trimmed = phone.trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

export const canMessagePhone = (phone?: string | null) => Boolean(phone && sanitizePhoneNumber(phone));

export const buildMessageUrl = ({
  channel,
  phone,
  message,
}: {
  channel: MessageChannel;
  phone: string;
  message: string;
}) => {
  const safePhone = sanitizePhoneNumber(phone);
  const encodedMessage = encodeURIComponent(message);

  if (channel === 'whatsapp') {
    const whatsappPhone = safePhone.replace(/^\+/, '');
    return `https://wa.me/${whatsappPhone}?text=${encodedMessage}`;
  }

  return `sms:${safePhone}?body=${encodedMessage}`;
};

export const openMessageComposer = ({
  channel,
  phone,
  message,
}: {
  channel: MessageChannel;
  phone?: string | null;
  message: string;
}) => {
  if (!phone || !canMessagePhone(phone)) return false;

  window.open(buildMessageUrl({ channel, phone, message }), '_blank', 'noopener,noreferrer');
  return true;
};
