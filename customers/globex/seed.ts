import type { SeedApi } from '@cde/core-server';

export default async function seed({ create, prisma }: SeedApi) {
  const renters = [];
  for (const [firstName, lastName, licenseNumber, licenseExpiry] of [
    ['Olivia', 'Smith', 'S1234-5678', '2028-04-30'],
    ['Noah', 'Johnson', 'J9876-5432', '2026-12-31'],
    ['Emma', 'Brown', 'B5555-0101', '2027-07-15'],
    ['Liam', 'Davis', 'D2468-1357', '2026-11-01'],
  ]) {
    renters.push(await create('Customer', { firstName, lastName, email: `${firstName.toLowerCase()}@example.net`, ext: { fleet: { licenseNumber, licenseExpiry } } }));
  }
  const cars = [
    ['gx 0001', 'Toyota', 'Corolla', 2023, 'airport', 'rented', 41200, 0],
    ['GX-0002', 'Toyota', 'Corolla', 2023, 'airport', 'available', 38950, null],
    ['GX-0003', 'Kia', 'Sportage', 2024, 'north', 'rented', 12010, 1],
    ['GX-0004', 'Nissan', 'Leaf', 2022, 'south', 'maintenance', 65300, null],
    ['GX-0005', 'Ford', 'Transit', 2021, 'south', 'available', 98100, null],
    ['GX-0006', 'Skoda', 'Octavia', 2024, 'north', 'rented', 8700, 2],
    ['GX-0007', 'Tesla', 'Model Y', 2025, 'airport', 'available', 3100, null],
  ] as const;
  const created = [];
  for (const [i, [fleetNumber, make, model, year, depot, status, odometer, renter]] of cars.entries()) {
    created.push(
      await create('Car', {
        vin: `GLBX${String(i + 1).padStart(13, '0')}`,
        make,
        model,
        year,
        color: 'White',
        customerId: renter === null ? null : renters[renter].id,
        ext: { fleet: { fleetNumber, depot, status, odometer }, serviceHistory: { intervalMonths: 6 } },
      }),
    );
  }
  const d = (m: number) => {
    const t = new Date();
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - m, 1));
  };
  for (const [car, ago, description] of [
    [0, 1, 'Pre-rental inspection'],
    [1, 2, 'Valet + tyre check'],
    [2, 9, 'Annual service'],
    [6, 1, 'Software update'],
  ] as const) {
    await prisma.serviceRecord.create({ data: { carId: created[car].id, date: d(ago), description } });
  }
}
