/**
 * Utility helper to safely extract and calculate platform fee from an order.
 * Supports both the dedicated `platform_fee` column and fallback pattern in `note`.
 */
export function getOrderPlatformFee(order?: {
  platform_fee?: number | null;
  note?: string | null;
} | null): number {
  if (!order) return 0;

  // 1. Check direct platform_fee property
  if (
    order.platform_fee !== undefined &&
    order.platform_fee !== null &&
    !isNaN(Number(order.platform_fee))
  ) {
    const fee = Number(order.platform_fee);
    if (fee > 0) return fee;
  }

  // 2. Fallback check from order note (e.g., "[Biaya Platform: Rp 12.600]" or "[Biaya Platform: 12600]")
  if (order.note) {
    const match = order.note.match(
      /\[(?:Biaya Platform|Platform Fee|Potongan Marketplace):\s*(?:Rp\s*)?([0-9.,]+)\]/i,
    );
    if (match && match[1]) {
      const num = parseInt(match[1].replace(/[.,]/g, ""), 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  return 0;
}

/**
 * Calculates net revenue for an order (subtotal or grand_total minus discount and platform fee).
 */
export function getOrderNetRevenue(order?: {
  subtotal?: number | null;
  grand_total?: number | null;
  discount_amount?: number | null;
  platform_fee?: number | null;
  note?: string | null;
} | null): number {
  if (!order) return 0;
  const gross = Number(order.subtotal || order.grand_total || 0);
  const discount = Number(order.discount_amount || 0);
  const platformFee = getOrderPlatformFee(order);
  return Math.max(0, gross - discount - platformFee);
}

