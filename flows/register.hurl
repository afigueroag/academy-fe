POST {{URL}}register
[Options]
output: -
{
  "academy_name": "My Sport Academy",
  "academy_type": "martial_arts_academy",
  "academy_primary_color": "1F2937",
  "academy_secondary_color": "EC4899",
  "academy_accent_color": "06B6D4",
  "email": "admin1@example.com",
  "first_name": "Administrador",
  "last_name": "Prueba",
  "password": "password123",
  "phone": "55-5555-5555",
  "address": "Dirección del Administrador",
  "date_of_birth": "1980-01-01",
  "academy_plan": "professional"
}
HTTP 201

POST {{URL}}login
[Options]
output: -
[Form]
username: admin1@example.com
password: password123
HTTP 200
[Captures]
token: jsonpath "$.access_token"