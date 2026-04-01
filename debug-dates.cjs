const axios = require('axios');
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5YTYyNGRmMC0xMmYxLTQ0OGUtYjg4NC00MzY3ODBhNWQzY2QiLCJqdGkiOiIwYTFlY2I5ZjVhNzZhYTg5MzQwZGU2YjI5NzM2NWUwMjZlZjBkYWNiZTMxYzVlYTE5NGE1MjYxZDBjYjljNzQxNjQwOGEwZDA0OWJlZjZjZSIsImlhdCI6MTc1ODIzNjUxMC45OTk5NSwibmJmIjoxNzU4MjM2NTEwLjk5OTk1MywiZXhwIjoxNzg5NzcyNTEwLjk5MTI0NSwic3ViIjoiNDAxNTUyIiwic2NvcGVzIjpbInBhdDpyZWFkIiwicGF0OndyaXRlIl19.dw9SnluNKPVLUlw9OB_QAAd9JiyWg9PfFJpI7oKGgf6pcS1ODBvuGfdO6wCFxI2dRYagJ-OLONA3T9xAmrZXDIzXfhESzJGzuKyoF_DWF_EBTQb4RbTs4AT181zOr-LhE02AXymRUIiXAMQtKsB2xCobv-AvZl1O4WGBHg7EPBmOdxyNvBzOuZmlvvqiWu6UJETzx4qsZyFUNcFR7naNZm0pDcsMhWyDYiYHvxLTzp5NiprJiyq02YtD2XFUvtKNHTh7JVZGxNbEqNHfZRuhHMeSQc0k5X0YwX6jX5gs8WjpJR49jqx4utgbhfSozcUjK62NbXXthNnNY3hc_MEVgFsoNxGSUxvXmqWVXQvNDKDzW2OBbpJrvsjvWwo-oJP2KSfgIQLltArx37_nD9cs7EDwRAcCCr-7F7KU7TkJ7PuuXAmv_a003KzOd8w8lQ1mNh-vzlCkuM4loUTGFaWtV7Q3YEFX6-4DdxsBeLuNWFTIohcCL2aX2O0a0EPDhaYx6UFJj59DeMojgUvjL5cmKpJD9PqrUJApswx7Ml2yoWkVCjRc9Ep3z837s0rN5pr-2IQPEtts1QhX1OG0B7eGSFV4sO9eF358EpWzCJvwOeLCtzLswR4LunJ5ljMngp-MKuBCpUE5EmZWkU-4G0VPV73TdlEQQH7vKS1aVTCRF9s';

async function run() {
  try {
    const headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
    const props = await axios.get('https://public.api.hospitable.com/v2/properties', { headers });
    const ids = props.data.data.map(p => p.id);
    const params = new URLSearchParams();
    ids.forEach(id => params.append('properties[]', id));
    params.append('per_page', '100');
    
    // Add start_date and end_date to fetch past reservations
    const past90 = new Date();
    past90.setDate(past90.getDate() - 90);
    params.append('start_date', past90.toISOString().split('T')[0]);
    params.append('end_date', '2027-01-01');

    const resUrl = `https://public.api.hospitable.com/v2/reservations?${params.toString()}`;
    const res = await axios.get(resUrl, { headers });
    
    const dates = res.data.data.map(r => r.start_date || r.check_in).sort();
    console.log("Total Reservations fetched:", dates.length);
    if(dates.length > 0) {
      console.log("Earliest Check-in:", dates[0]);
      console.log("Latest Check-in:", dates[dates.length - 1]);
    }
  } catch (e) {
    console.error(e.message);
  }
}
run();
