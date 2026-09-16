'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { buildOrderMessage, whatsAppLink, type WhatsAppOrderLine } from '@/lib/whatsapp';

interface Props {
  lines: WhatsAppOrderLine[];
  total?: number;
  label?: string;
  /** When set, the button is shown but inert, e.g. until compliance is ticked. */
  disabled?: boolean;
  className?: string;
}

/**
 * Opens WhatsApp with the order already typed out. Renders nothing until a
 * number is saved and switched on in Dashboard > Storefront.
 */
export default function WhatsAppOrderButton({
  lines,
  total,
  label = 'Order on WhatsApp',
  disabled = false,
  className = '',
}: Props) {
  const number = useWhatsApp();
  if (!number || lines.length === 0) return null;

  const content = (
    <>
      <MessageCircle className="h-4 w-4" />
      <span>{label}</span>
    </>
  );

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`btn-whatsapp cursor-not-allowed opacity-50 ${className}`}
      >
        {content}
      </span>
    );
  }

  return (
    <a
      href={whatsAppLink(number, buildOrderMessage(lines, total))}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn-whatsapp ${className}`}
    >
      {content}
    </a>
  );
}
