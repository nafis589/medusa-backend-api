import type { ChartPeriod, VendorStatsRepository } from './vendor-stats.repository';

export class VendorStatsService {
  constructor(private readonly repo: VendorStatsRepository) {}

  getStats(vendorId: string) {
    return this.repo.getStats(vendorId);
  }

  getChartData(vendorId: string, period: ChartPeriod) {
    return this.repo.getChartData(vendorId, period);
  }
}
