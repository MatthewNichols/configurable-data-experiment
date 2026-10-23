import { defineModule } from '@cde/sdk';

export default defineModule({
  name: 'serviceHistory',
  label: 'Service history',
  description: 'Workshop service records per car, with due-for-service tracking',
  prismaSchema: './prisma/service-history.prisma',
  sql: './sql/service-history.sql',
  server: './src/server.ts',
  web: './src/web/index.ts',
  extends: {
    Car: {
      prismaFields: ['serviceRecords ServiceRecord[]'],
      fields: {
        intervalMonths: { type: 'int', min: 1, max: 36, label: 'Service interval (months)', example: 12 },
      },
      computed: {
        lastServiceDate: { type: 'date', label: 'Last service', list: true },
        serviceCount: { type: 'int', label: 'Services' },
        due: { type: 'bool', label: 'Service due' },
      },
      filters: {
        serviceDue: { type: 'bool', label: 'Service due' },
      },
    },
  },
});
