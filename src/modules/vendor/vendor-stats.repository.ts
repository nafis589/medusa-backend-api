import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';

export type ChartPeriod = 'week' | 'month' | 'year';

export interface VendorStatsRow {
  monthly_revenue: number;
  pending_orders: number;
  active_products: number;
  monthly_views: number;
}

export interface ChartDataPoint {
  date: string;
  label: string;
  revenue: number;
}

export class VendorStatsRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async getStats(vendorId: string): Promise<VendorStatsRow> {
    const [revenueRows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount), 0) AS monthly_revenue
       FROM orders
       WHERE vendor_id = ?
         AND status NOT IN ('CANCELLED', 'RETURNED')
         AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [vendorId],
    );

    const [pendingRows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS pending_orders
       FROM orders
       WHERE vendor_id = ? AND status = 'PENDING'`,
      [vendorId],
    );

    const [activeRows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS active_products
       FROM products
       WHERE vendor_id = ? AND status = 'ACTIVE'`,
      [vendorId],
    );

    const [viewsRows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT COALESCE(SUM(views_count), 0) AS monthly_views
       FROM products
       WHERE vendor_id = ?
         AND status = 'ACTIVE'
         AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [vendorId],
    );

    return {
      monthly_revenue: Number(revenueRows[0]?.monthly_revenue ?? 0),
      pending_orders: Number(pendingRows[0]?.pending_orders ?? 0),
      active_products: Number(activeRows[0]?.active_products ?? 0),
      monthly_views: Number(viewsRows[0]?.monthly_views ?? 0),
    };
  }

  async getChartData(vendorId: string, period: ChartPeriod): Promise<ChartDataPoint[]> {
    if (period === 'week') {
      const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
        `SELECT DATE(created_at) AS bucket,
                COALESCE(SUM(total_amount), 0) AS revenue
         FROM orders
         WHERE vendor_id = ?
           AND status NOT IN ('CANCELLED', 'RETURNED')
           AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(created_at)
         ORDER BY bucket ASC`,
        [vendorId],
      );
      return this.fillDailyGaps(rows, 7);
    }

    if (period === 'year') {
      const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
        `SELECT MONTH(created_at) AS bucket,
                COALESCE(SUM(total_amount), 0) AS revenue
         FROM orders
         WHERE vendor_id = ?
           AND status NOT IN ('CANCELLED', 'RETURNED')
           AND YEAR(created_at) = YEAR(NOW())
         GROUP BY MONTH(created_at)
         ORDER BY bucket ASC`,
        [vendorId],
      );
      const monthNames = [
        'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
        'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
      ];
      const byMonth = new Map<number, number>();
      for (const row of rows) {
        byMonth.set(Number(row.bucket), Number(row.revenue));
      }
      const currentMonth = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      return Array.from({ length: currentMonth }, (_, i) => {
        const month = i + 1;
        return {
          date: new Date(year, month - 1, 1).toISOString(),
          label: monthNames[i],
          revenue: byMonth.get(month) ?? 0,
        };
      });
    }

    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT DAY(created_at) AS bucket,
              COALESCE(SUM(total_amount), 0) AS revenue
       FROM orders
       WHERE vendor_id = ?
         AND status NOT IN ('CANCELLED', 'RETURNED')
         AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
       GROUP BY DAY(created_at)
       ORDER BY bucket ASC`,
      [vendorId],
    );

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const currentDay = today.getDate();
    const byDay = new Map<number, number>();
    for (const row of rows) {
      byDay.set(Number(row.bucket), Number(row.revenue));
    }

    return Array.from({ length: currentDay }, (_, i) => {
      const day = i + 1;
      const dDate = new Date(year, month, day);
      return {
        date: dDate.toISOString(),
        label: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(dDate),
        revenue: byDay.get(day) ?? 0,
      };
    });
  }

  private fillDailyGaps(rows: mysql.RowDataPacket[], days: number): ChartDataPoint[] {
    const formatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });
    const byDate = new Map<string, number>();
    for (const row of rows) {
      const d = new Date(row.bucket as string);
      const key = d.toISOString().slice(0, 10);
      byDate.set(key, Number(row.revenue));
    }

    const result: ChartDataPoint[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({
        date: d.toISOString(),
        label: formatter.format(d),
        revenue: byDate.get(key) ?? 0,
      });
    }
    return result;
  }
}
