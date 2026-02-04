
export interface ClientRecord {
  id: string;
  name: string;
  address: string;
  type: 'client';
}

export const MOCK_CLIENTS: ClientRecord[] = [
  { id: '1', name: 'Supermercado Silva', address: 'Avenida Paulista, 1000, São Paulo, SP', type: 'client' },
  { id: '2', name: 'Farmácia Central', address: 'Rua Augusta, 500, São Paulo, SP', type: 'client' },
  { id: '3', name: 'João da Silva', address: 'Rua Haddock Lobo, 200, São Paulo, SP', type: 'client' },
  { id: '4', name: 'Restaurante Sabor Real', address: 'Alameda Santos, 1500, São Paulo, SP', type: 'client' },
  { id: '5', name: 'Oficina do Giba', address: 'Rua da Consolação, 2500, São Paulo, SP', type: 'client' }
];
