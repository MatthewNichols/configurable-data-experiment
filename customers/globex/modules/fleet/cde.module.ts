import { defineModule } from '@cde/sdk';

export default defineModule({
  name: 'fleet',
  label: 'Fleet',
  description: 'Fleet numbers, depots, garages and rental status, with odometer rules',
  server: './src/server.ts',
  web: './src/web.ts',
  entities: {
    Garage: {
      label: 'Garage',
      icon: 'pi pi-building',
      titleFields: ['name'],
      fields: {
        name: { type: 'string', label: 'Name', required: true, searchable: ['text', 'filter'], list: true },
        depot: { type: 'enum', values: ['north', 'south', 'airport'], label: 'Depot', required: true, searchable: 'filter', list: true },
        bays: { type: 'int', min: 1, max: 50, label: 'Bays', required: true, list: true },
        address: { type: 'text', label: 'Address', searchable: 'text' },
        phone: { type: 'string', label: 'Phone' },
      },
    },
  },
  extends: {
    Car: {
      fields: {
        fleetNumber: { type: 'string', required: true, label: 'Fleet #', example: 'GX-0042', searchable: ['filter', 'text'], list: true },
        depot: { type: 'enum', values: ['north', 'south', 'airport'], label: 'Depot', searchable: 'filter', list: true },
        status: { type: 'enum', values: ['available', 'rented', 'maintenance'], label: 'Status', required: true, searchable: 'filter', list: true },
        odometer: { type: 'int', min: 0, label: 'Odometer (km)', searchable: 'range' },
        // a car is kept at no garage or exactly one
        garage: { type: 'reference', ref: 'Garage', label: 'Garage', searchable: 'filter', list: true },
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
