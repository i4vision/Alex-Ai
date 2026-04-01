const axios = require('axios');

const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5YTYyNGRmMC0xMmYxLTQ0OGUtYjg4NC00MzY3ODBhNWQzY2QiLCJqdGkiOiIwYTFlY2I5ZjVhNzZhYTg5MzQwZGU2YjI5NzM2NWUwMjZlZjBkYWNiZTMxYzVlYTE5NGE1MjYxZDBjYjljNzQxNjQwOGEwZDA0OWJlZjZjZSIsImlhdCI6MTc1ODIzNjUxMC45OTk5NSwibmJmIjoxNzU4MjM2NTEwLjk5OTk1MywiZXhwIjoxNzg5NzcyNTEwLjk5MTI0NSwic3ViIjoiNDAxNTUyIiwic2NvcGVzIjpbInBhdDpyZWFkIiwicGF0OndyaXRlIl19.dw9SnluNKPVLUlw9OB_QAAd9JiyWg9PfFJpI7oKGgf6pcS1ODBvuGfdO6wCFxI2dRYagJ-OLONA3T9xAmrZXDIzXfhESzJGzuKyoF_DWF_EBTQb4RbTs4AT181zOr-LhE02AXymRUIiXAMQtKsB2xCobv-AvZl1O4WGBHg7EPBmOdxyNvBzOuZmlvvqiWu6UJETzx4qsZyFUNcFR7naNZm0pDcsMhWyDYiYHvxLTzp5NiprJiyq02YtD2XFUvtKNHTh7JVZGxNbEqNHfZRuhHMeSQc0k5X0YwX6jX5gs8WjpJR49jqx4utgbhfSozcUjK62NbXXthNnNY3hc_MEVgFsoNxGSUxvXmqWVXQvNDKDzW2OBbpJrvsjvWwo-oJP2KSfgIQLltArx37_nD9cs7EDwRAcCCr-7F7KU7TkJ7PuuXAmv_a003KzOd8w8lQ1mNh-vzlCkuM4loUTGFaWtV7Q3YEFX6-4DdxsBeLuNWFTIohcCL2aX2O0a0EPDhaYx6UFJj59DeMojgUvjL5cmKpJD9PqrUJApswx7Ml2yoWkVCjRc9Ep3z837s0rN5pr-2IQPEtts1QhX1OG0B7eGSFV4sO9eF358EpWzCJvwOeLCtzLswR4LunJ5ljMngp-MKuBCpUE5EmZWkU-4G0VPV73TdlEQQH7vKS1aVTCRF9s';

async function test() {
  try {
    console.log("Fetching API...");
    const res = await axios.get('https://api.hospitable.com/v2/reservations', {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json'
      }
    });
    console.log("Success! Data length:", res.data?.data?.length);
    console.log("First item:", JSON.stringify(res.data?.data?.[0], null, 2));
  } catch (error) {
    console.error("API Error:");
    if (error.response) {
      console.error(error.response.status, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

test();
