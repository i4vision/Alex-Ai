import axios from 'axios';

const API_BASE = 'https://public.api.hospitable.com/v2';
// In a real production app this should be in an env variable
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5YTYyNGRmMC0xMmYxLTQ0OGUtYjg4NC00MzY3ODBhNWQzY2QiLCJqdGkiOiIwYTFlY2I5ZjVhNzZhYTg5MzQwZGU2YjI5NzM2NWUwMjZlZjBkYWNiZTMxYzVlYTE5NGE1MjYxZDBjYjljNzQxNjQwOGEwZDA0OWJlZjZjZSIsImlhdCI6MTc1ODIzNjUxMC45OTk5NSwibmJmIjoxNzU4MjM2NTEwLjk5OTk1MywiZXhwIjoxNzg5NzcyNTEwLjk5MTI0NSwic3ViIjoiNDAxNTUyIiwic2NvcGVzIjpbInBhdDpyZWFkIiwicGF0OndyaXRlIl19.dw9SnluNKPVLUlw9OB_QAAd9JiyWg9PfFJpI7oKGgf6pcS1ODBvuGfdO6wCFxI2dRYagJ-OLONA3T9xAmrZXDIzXfhESzJGzuKyoF_DWF_EBTQb4RbTs4AT181zOr-LhE02AXymRUIiXAMQtKsB2xCobv-AvZl1O4WGBHg7EPBmOdxyNvBzOuZmlvvqiWu6UJETzx4qsZyFUNcFR7naNZm0pDcsMhWyDYiYHvxLTzp5NiprJiyq02YtD2XFUvtKNHTh7JVZGxNbEqNHfZRuhHMeSQc0k5X0YwX6jX5gs8WjpJR49jqx4utgbhfSozcUjK62NbXXthNnNY3hc_MEVgFsoNxGSUxvXmqWVXQvNDKDzW2OBbpJrvsjvWwo-oJP2KSfgIQLltArx37_nD9cs7EDwRAcCCr-7F7KU7TkJ7PuuXAmv_a003KzOd8w8lQ1mNh-vzlCkuM4loUTGFaWtV7Q3YEFX6-4DdxsBeLuNWFTIohcCL2aX2O0a0EPDhaYx6UFJj59DeMojgUvjL5cmKpJD9PqrUJApswx7Ml2yoWkVCjRc9Ep3z837s0rN5pr-2IQPEtts1QhX1OG0B7eGSFV4sO9eF358EpWzCJvwOeLCtzLswR4LunJ5ljMngp-MKuBCpUE5EmZWkU-4G0VPV73TdlEQQH7vKS1aVTCRF9s';

export interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  picture_url?: string;
  phone_number?: string;
}

export interface Reservation {
  id: string;
  code: string;
  start_date: string;
  end_date: string;
  status: string;
  property_name?: string;
  guest: Guest;
}

export const fetchReservations = async (): Promise<Reservation[]> => {
  try {
    const headers = {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
    };

    // 1. Fetch properties first as Hospitable v2 requires properties[] filter
    const propsRes = await axios.get(`${API_BASE}/properties`, { headers });
    const properties = propsRes.data.data;

    if (!properties || properties.length === 0) {
      return [];
    }
    
    // Default Hospitable API only fetches from today onwards. We must ask for past reservations.
    const pastDays = new Date();
    pastDays.setDate(pastDays.getDate() - 120); // fetch last 120 days of history
    const startStr = pastDays.toISOString().split('T')[0];
    
    const futureDays = new Date();
    futureDays.setDate(futureDays.getDate() + 365); // fetch up to 1 year in future
    const endStr = futureDays.toISOString().split('T')[0];

    const propertyPromises = properties.map(async (prop: any) => {
      let propReservations: any[] = [];
      let page = 1;
      const maxPages = 5;

      while (page <= maxPages) {
        const params = new URLSearchParams();
        params.append('properties[]', prop.id);
        params.append('include', 'guest');
        params.append('per_page', '100');
        params.append('start_date', startStr);
        params.append('end_date', endStr);
        params.append('page', page.toString());
        
        const resUrl = `${API_BASE}/reservations?${params.toString()}`;
        const res = await axios.get(resUrl, { headers });
        
        const items = res.data?.data || [];
        const mappedItems = items.map((item: any) => ({
          ...item,
          injected_property_name: prop.name || prop.id
        }));
        
        propReservations = [...propReservations, ...mappedItems];
        
        if (items.length < 100 || !res.data?.meta || page >= (res.data.meta.last_page || 1)) {
          break;
        }
        page++;
      }
      return propReservations;
    });

    const results = await Promise.all(propertyPromises);
    const allReservations = results.flat();

    return allReservations;
  } catch (error) {
    console.error('Error fetching Hospitable reservations:', error);
    // Return mock data fallback ONLY if API completely fails
    return [
      {
        id: '1',
        code: 'RES-001',
        start_date: '2023-10-01',
        end_date: '2023-10-05',
        status: 'accepted',
        guest: { id: 'g1', first_name: 'Ahsan', last_name: 'Mohammed' }
      },
      {
        id: '2',
        code: 'RES-002',
        start_date: '2023-10-05',
        end_date: '2023-10-10',
        status: 'accepted',
        guest: { id: 'g2', first_name: 'Eustolio', last_name: 'Salinas' }
      },
      {
        id: '3',
        code: 'RES-003',
        start_date: '2023-10-10',
        end_date: '2023-10-15',
        status: 'accepted',
        guest: { id: 'g3', first_name: 'Francisco', last_name: 'Aguirre' }
      },
      {
        id: '4',
        code: 'RES-004',
        start_date: '2023-10-15',
        end_date: '2023-10-20',
        status: 'accepted',
        guest: { id: 'g4', first_name: 'Greg', last_name: 'Mendiola' }
      },
      {
        id: '5',
        code: 'RES-005',
        start_date: '2023-10-20',
        end_date: '2023-10-25',
        status: 'accepted',
        guest: { id: 'g5', first_name: 'John', last_name: 'Lindseth' }
      }
    ];
  }
};
