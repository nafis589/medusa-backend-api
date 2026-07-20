/** Total unités vendues pour le vendeur `v` (hors commandes annulées/refusées/retournées). */
export const SQL_VENDOR_TOTAL_SALES = `(
  SELECT COALESCE(SUM(oi.quantity), 0)
  FROM order_items oi
  INNER JOIN orders o ON o.id = oi.order_id
  WHERE o.vendor_id = v.id
    AND o.status NOT IN ('CANCELLED', 'RETURNED', 'REFUSED')
)`;
