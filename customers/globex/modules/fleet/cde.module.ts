import { defineModule } from '@cde/sdk';

export default defineModule({
  name: 'fleet',
  label: 'Fleet',
  description: 'Fleet numbers, depots and rental status, with odometer rules',
  server: './src/server.ts',
  web: './src/web.ts',
  extends: {
    Car: {
      fields: {
        fleetNumber: { type: 'string', required: true, label: 'Fleet #', example: 'GX-0042', searchable: ['filter', 'text'], list: true },
        depot: { type: 'enum', values: ['north', 'south', 'airport'], label: 'Depot', searchable: 'filter', list: true },
        status: { type: 'enum', values: ['available', 'rented', 'maintenance'], label: 'Status', required: true, searchable: 'filter', list: true },
        odometer: { type: 'int', min: 0, label: 'Odometer (km)', searchable: 'range' },
      },
    },
    Customer: {
      fields: {
        licenseNumber: { type: 'string', label: 'Driver licence #', searchable: ['filter', 'text'], list: true },
        licenseExpiry: { type: 'date', label: 'Licence expiry', searchable: 'range' },
      },
    },
  },
});
