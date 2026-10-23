import type { SeedApi } from '@cde/core-server';

export default async function seed({ create }: SeedApi) {
  const ada = await create('Customer', { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.org', notes: 'First programmer' });
  const alan = await create('Customer', { firstName: 'Alan', lastName: 'Turing', email: 'alan@example.org' });
  await create('Car', { vin: 'BARE0000000000001', make: 'Morris', model: 'Minor', year: 1956, color: 'Green', customerId: ada.id });
  await create('Car', { vin: 'BARE0000000000002', make: 'Austin', model: 'Seven', year: 1931, color: 'Black', customerId: alan.id });
  await create('Car', { vin: 'BARE0000000000003', make: 'Mini', model: 'Cooper', year: 1965, color: 'Red' });
}
