const axios = require('axios');
const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5YTYyNGRmMC0xMmYxLTQ0OGUtYjg4NC00MzY3ODBhNWQzY2QiLCJqdGkiOiIwYTFlY2I5ZjVhNzZhYTg5MzQwZGU2YjI5NzM2NWUwMjZlZjBkYWNiZTMxYzVlYTE5NGE1MjYxZDBjYjljNzQxNjQwOGEwZDA0OWJlZjZjZSIsImlhdCI6MTc1ODIzNjUxMC45OTk5NSwibmJmIjoxNzU4MjM2NTEwLjk5OTk1MywiZXhwIjoxNzg5NzcyNTEwLjk5MTI0NSwic3ViIjoiNDAxNTUyIiwic2NvcGVzIjpbInBhdDpyZWFkIiwicGF0OndyaXRlIl19.dw9SnluNKPVLUlw9OB_QAAd9JiyWg9PfFJpI7oKGgf6pcS1ODBvuGfdO6wCFxI2dRYagJ-OLONA3T9xAmrZXDIzXfhESzJGzuKyoF_DWF_EBTQb4RbTs4AT181zOr-LhE02AXymRUIiXAMQtKsB2xCobv-AvZl1O4WGBHg7EPBmOdxyNvBzOuZmlvvqiWu6UJETzx4qsZyFUNcFR7naNZm0pDcsMhWyDYiYHvxLTzp5NiprJiyq02YtD2XFUvtKNHTh7JVZGxNbEqNHfZRuhHMeSQc0k5X0YwX6jX5gs8WjpJR49jqx4utgbhfSozcUjK62NbXXthNnNY3hc_MEVgFsoNxGSUxvXmqWVXQvNDKDzW2OBbpJrvsjvWwo-oJP2KSfgIQLltArx37_nD9cs7EDwRAcCCr-7F7KU7TkJ7PuuXAmv_a003KzOd8w8lQ1mNh-vzlCkuM4loUTGFaWtV7Q3YEFX6-4DdxsBeLuNWFTIohcCL2aX2O0a0EPDhaYx6UFJj59DeMojgUvjL5cmKpJD9PqrUJApswx7Ml2yoWkVCjRc9Ep3z837s0rN5pr-2IQPEtts1QhX1OG0B7eGSFV4sO9eF358EpWzCJvwOeLCtzLswR4LunJ5ljMngp-MKuBCpUE5EmZWkU-4G0VPV73TdlEQQH7vKS1aVTCRF9s';

async function test() {
  try {
    const res = await axios.get('https://public.api.hospitable.com/v2/properties', {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }
    });
    const propertyIds = res.data.data.map(p => p.id);
    
    // Try sending one property id using array query param style
    const url = `https://public.api.hospitable.com/v2/reservations?properties[]=${propertyIds[0]}&include=guest`;
    const res2 = await axios.get(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }
    });
    console.log("Guest Object:", JSON.stringify(res2.data.data[0].guest, null, 2));
  } catch (e) {
    console.log("API Error:", e.response?.data || e.message);
  }
}
test();
