import type { SeedApi } from '@cde/core-server';

export default async function seed({ create, prisma }: SeedApi) {
  const people = [
    ['Maria', 'Gonzalez', 'gold', 2450, 'Sam Patel'],
    ['James', 'Okafor', 'silver', 820, 'Sam Patel'],
    ['Priya', 'Raman', 'platinum', 6100, 'Lee Chen'],
    ['Tom', 'Becker', 'bronze', 90, 'Lee Chen'],
    ['Aiko', 'Tanaka', null, 0, null],
    ['Dan', 'Murphy', 'silver', 1300, 'Sam Patel'],
  ] as const;
  const customers = [];
  for (const [firstName, lastName, tier, points, rep] of people) {
    customers.push(
      await create('Customer', {
        firstName,
        lastName,
        email: `${firstName}.${lastName}@example.com`.toLowerCase(),
        phone: '+1 555 0100',
        ext: {
          loyalty: tier ? { tier, points, memberSince: '2021-05-01', marketingOptIn: points > 1000 } : {},
          sales: { salesRep: rep, preferredContact: points > 1000 ? 'email' : 'phone' },
        },
      }),
    );
  }
  const cars = [
    ['1HGCM82633A004352', 'Honda', 'Accord', 2019, 'Silver', 0, 18995, 'used', true],
    ['5YJ3E1EA7KF317000', 'Tesla', 'Model 3', 2022, 'White', 2, 33950, 'certified', false],
    ['WBA8E9G51GNT40000', 'BMW', '330i', 2016, 'Black', 1, 14500, 'used', true],
    ['JTDKN3DU0A0200000', 'Toyota', 'Prius', 2020, 'Blue', 3, 21900, 'used', false],
    ['1FTFW1ET5DFC10000', 'Ford', 'F-150', 2024, 'Red', null, 48990, 'new', true],
    ['3VW2B7AJ5HM300000', 'Volkswagen', 'Jetta', 2017, 'Grey', 5, 11250, 'used', false],
    ['KM8J3CA46JU600000', 'Hyundai', 'Tucson', 2025, 'Green', null, 31500, 'new', true],
  ] as const;
  const created = [];
  for (const [vin, make, model, year, color, owner, listPrice, condition, onLot] of cars) {
    created.push(
      await create('Car', {
        vin,
        make,
        model,
        year,
        color,
        customerId: owner === null ? null : customers[owner].id,
        ext: { sales: { listPrice, condition, onLot }, serviceHistory: { intervalMonths: 12 } },
      }),
    );
  }
  const today = new Date();
  const monthsAgo = (m: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m, 15));
  const services: [number, number, string, number][] = [
    [0, 2, 'Oil and filter change', 89],
    [0, 14, '30k mile service', 420],
    [1, 3, 'Tyre rotation', 45],
    [2, 20, 'Brake pads (front)', 310],
    [3, 5, 'Hybrid battery check', 120],
    [5, 30, 'Timing belt', 780],
  ];
  for (const [car, ago, description, cost] of services) {
    await prisma.serviceRecord.create({
      data: { carId: created[car].id, date: monthsAgo(ago), description, cost, mileage: 20000 + ago * 1000 },
    });
  }
}
